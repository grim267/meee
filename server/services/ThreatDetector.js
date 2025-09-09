const EventEmitter = require('events');
const tf = require('@tensorflow/tfjs-node');
const { v4: uuidv4 } = require('uuid');
const Threat = require('../models/Threat');
const TrainingData = require('../models/TrainingData');

class ThreatDetector extends EventEmitter {
  constructor() {
    super();
    this.model = null;
    this.isTraining = false;
    this.featureScaler = null;
    this.labelEncoder = new Map();
    this.threatThreshold = parseFloat(process.env.THREAT_THRESHOLD) || 0.7;
    
    // Initialize label encoder with known threat types
    this.initializeLabelEncoder();
  }

  initializeLabelEncoder() {
    const labels = ['Normal', 'Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'];
    labels.forEach((label, index) => {
      this.labelEncoder.set(label, index);
      this.labelEncoder.set(index, label);
    });
  }

  async loadModel() {
    try {
      this.model = await tf.loadLayersModel('file://./models/threat_model/model.json');
      console.log('Threat detection model loaded successfully');
      return true;
    } catch (error) {
      console.log('No existing model found, will need to train first');
      return false;
    }
  }

  async trainModel(trainingData = null) {
    if (this.isTraining) {
      throw new Error('Model is already training');
    }

    this.isTraining = true;
    this.emit('training_started');

    try {
      console.log('ThreatDetector: Starting training process');
      let data;
      if (trainingData) {
        console.log('Using provided training data:', trainingData.length, 'samples');
        data = trainingData;
      } else {
        console.log('Loading training data from database');
        // Load training data from database
        data = await TrainingData.find({}).lean();
        console.log('Loaded from database:', data.length, 'samples');
        
        // Convert to simple format
        data = data.map(item => ({
          features: item.features,
          label: item.label
        }));
      }

      if (data.length < 10) {
        throw new Error(`Insufficient training data. Need at least 10 samples, got ${data.length}.`);
      }

      console.log(`Training model with ${data.length} samples`);

      // Prepare features and labels
      const features = data.map(item => item.features);
      const labels = data.map(item => this.labelEncoder.get(item.label) || 0);
      
      console.log('Features shape:', features.length, 'x', features[0]?.length);
      console.log('Labels:', labels);
      
      // Validate features
      const invalidFeatures = features.filter(f => !Array.isArray(f) || f.length !== 9);
      if (invalidFeatures.length > 0) {
        throw new Error(`Invalid features found. Expected 9 features per sample, found samples with different lengths.`);
      }
      
      // Validate labels
      const invalidLabels = labels.filter(l => l === undefined || l === null);
      if (invalidLabels.length > 0) {
        throw new Error(`Invalid labels found. Some labels could not be encoded.`);
      }

      // Normalize features
      console.log('Creating feature tensor...');
      const featureTensor = tf.tensor2d(features);
      console.log('Feature tensor shape:', featureTensor.shape);
      
      const { normalizedFeatures, scaler } = this.normalizeFeatures(featureTensor);
      this.featureScaler = scaler;
      console.log('Features normalized');

      // Convert labels to categorical
      console.log('Creating label tensor...');
      const labelTensor = tf.oneHot(tf.tensor1d(labels, 'int32'), this.labelEncoder.size / 2);
      console.log('Label tensor shape:', labelTensor.shape);

      // Create model architecture
      console.log('Creating model architecture...');
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [9], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: this.labelEncoder.size / 2, activation: 'softmax' })
        ]
      });
      console.log('Model created');

      // Compile model
      console.log('Compiling model...');
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
      console.log('Model compiled');

      // Train model
      console.log('Starting model training...');
      const history = await this.model.fit(normalizedFeatures, labelTensor, {
        epochs: 30,
        batchSize: Math.min(16, Math.floor(data.length / 4)),
        validationSplit: 0.2,
        verbose: 1,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}/30 - loss: ${logs.loss.toFixed(4)}, accuracy: ${logs.acc.toFixed(4)}`);
            this.emit('training_progress', {
              epoch: epoch + 1,
              totalEpochs: 30,
              loss: logs.loss,
              accuracy: logs.acc,
              valLoss: logs.val_loss,
              valAccuracy: logs.val_acc
            });
          }
        }
      });
      console.log('Training completed');

      // Save model
      console.log('Saving model...');
      const modelDir = './models/threat_model';
      if (!fs.existsSync('./models')) {
        fs.mkdirSync('./models', { recursive: true });
      }
      await this.model.save('file://./models/threat_model');
      console.log('Model saved');

      const finalAccuracy = history.history.val_acc[history.history.val_acc.length - 1];
      
      this.emit('training_completed', {
        success: true,
        samplesProcessed: data.length,
        accuracy: (finalAccuracy * 100).toFixed(2),
        epochs: 30
      });

      // Cleanup tensors
      featureTensor.dispose();
      normalizedFeatures.dispose();
      labelTensor.dispose();

      return {
        success: true,
        samplesProcessed: data.length,
        accuracy: (finalAccuracy * 100).toFixed(2),
        epochs: 30
      };

    } catch (error) {
      console.error('Training failed:', error);
      console.error('Error stack:', error.stack);
      this.emit('training_failed', { error: error.message });
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  normalizeFeatures(featureTensor) {
    const mean = featureTensor.mean(0);
    const std = featureTensor.sub(mean).square().mean(0).sqrt();
    const normalizedFeatures = featureTensor.sub(mean).div(std.add(1e-8));
    
    return {
      normalizedFeatures,
      scaler: { mean, std }
    };
  }

  async analyzePacket(packet) {
    if (!this.model || !this.featureScaler) {
      return {
        classification: 'Unknown',
        confidence: 0.5,
        threat: null
      };
    }

    try {
      // Extract features from packet
      const features = this.extractFeatures(packet);
      
      // Normalize features
      const featureTensor = tf.tensor2d([features]);
      const normalizedFeatures = featureTensor.sub(this.featureScaler.mean).div(
        this.featureScaler.std.add(1e-8)
      );

      // Make prediction
      const prediction = this.model.predict(normalizedFeatures);
      const probabilities = await prediction.data();
      
      // Get the class with highest probability
      const maxProbIndex = probabilities.indexOf(Math.max(...probabilities));
      const classification = this.labelEncoder.get(maxProbIndex) || 'Unknown';
      const confidence = probabilities[maxProbIndex];

      // Cleanup tensors
      featureTensor.dispose();
      normalizedFeatures.dispose();
      prediction.dispose();

      // Determine if this is a threat
      const isThreat = classification !== 'Normal' && confidence > this.threatThreshold;

      let threat = null;
      if (isThreat) {
        threat = await this.createThreatRecord(packet, classification, confidence, features);
      }

      return {
        classification,
        confidence,
        threat,
        isThreat
      };

    } catch (error) {
      console.error('Error analyzing packet:', error);
      return {
        classification: 'Error',
        confidence: 0,
        threat: null
      };
    }
  }

  extractFeatures(packet) {
    // Extract numerical features from packet for ML analysis
    return [
      packet.packetSize || 0,
      packet.sourcePort || 0,
      packet.destinationPort || 0,
      this.getProtocolNumber(packet.protocol),
      this.getTimeFeatures(packet.timestamp),
      this.getPortCategoryFeature(packet.destinationPort),
      this.getPacketSizeCategory(packet.packetSize),
      this.getSourceIPCategory(packet.sourceIP),
      this.getDestinationIPCategory(packet.destinationIP)
    ];
  }

  getProtocolNumber(protocol) {
    const protocolMap = { 'tcp': 6, 'udp': 17, 'icmp': 1 };
    return protocolMap[protocol?.toLowerCase()] || 0;
  }

  getTimeFeatures(timestamp) {
    const hour = new Date(timestamp).getHours();
    return hour; // Hour of day as feature
  }

  getPortCategoryFeature(port) {
    if (!port) return 0;
    if (port < 1024) return 1; // Well-known ports
    if (port < 49152) return 2; // Registered ports
    return 3; // Dynamic/private ports
  }

  getPacketSizeCategory(size) {
    if (!size) return 0;
    if (size < 64) return 1;
    if (size < 512) return 2;
    if (size < 1024) return 3;
    return 4;
  }

  getSourceIPCategory(ip) {
    if (!ip) return 0;
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) return 1; // Private
    return 2; // Public
  }

  getDestinationIPCategory(ip) {
    if (!ip) return 0;
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) return 1; // Private
    return 2; // Public
  }

  async createThreatRecord(packet, classification, confidence, features) {
    const threat = new Threat({
      id: uuidv4(),
      timestamp: packet.timestamp,
      type: this.getThreatType(classification),
      severity: this.getSeverity(classification, confidence),
      source: packet.sourceIP,
      destination: packet.destinationIP,
      sourcePort: packet.sourcePort,
      destinationPort: packet.destinationPort,
      protocol: packet.protocol,
      packetSize: packet.packetSize,
      description: this.getThreatDescription(classification, packet),
      classification,
      confidence,
      networkInterface: packet.networkInterface,
      rawPacketData: packet,
      features
    });

    await threat.save();
    return threat;
  }

  getThreatType(classification) {
    const typeMap = {
      'Malware': 'Malware Detection',
      'DDoS': 'DDoS Attack',
      'Intrusion': 'Unauthorized Access',
      'Phishing': 'Phishing Attempt',
      'Port_Scan': 'Port Scanning',
      'Brute_Force': 'Brute Force Attack'
    };
    return typeMap[classification] || 'Unknown Threat';
  }

  getSeverity(classification, confidence) {
    if (confidence > 0.9) return 'Critical';
    if (confidence > 0.8) return 'High';
    if (confidence > 0.7) return 'Medium';
    return 'Low';
  }

  getThreatDescription(classification, packet) {
    const descriptions = {
      'Malware': `Malicious activity detected from ${packet.sourceIP} targeting ${packet.destinationIP}`,
      'DDoS': `Potential DDoS attack detected from ${packet.sourceIP}`,
      'Intrusion': `Unauthorized access attempt from ${packet.sourceIP} to ${packet.destinationIP}:${packet.destinationPort}`,
      'Phishing': `Phishing attempt detected from ${packet.sourceIP}`,
      'Port_Scan': `Port scanning activity detected from ${packet.sourceIP}`,
      'Brute_Force': `Brute force attack detected against ${packet.destinationIP}:${packet.destinationPort}`
    };
    return descriptions[classification] || `Suspicious ${classification.toLowerCase()} activity detected`;
  }

  async addTrainingData(features, label, source = 'manual') {
    const trainingData = new TrainingData({
      features,
      label,
      source
    });
    
    await trainingData.save();
    return trainingData;
  }
}

module.exports = ThreatDetector;