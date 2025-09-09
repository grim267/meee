const EventEmitter = require('events');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
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
    this.modelMetadata = null;
    this.trainingHistory = [];
    this.modelVersion = 1;
    this.lastTrainingDate = null;
    this.totalSamplesTrained = 0;
    
    // Initialize label encoder with known threat types
    this.initializeLabelEncoder();
    
    // Load existing model and metadata on startup
    this.initializeModel();
  }

  initializeLabelEncoder() {
    const labels = ['Normal', 'Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'];
    labels.forEach((label, index) => {
      this.labelEncoder.set(label, index);
      this.labelEncoder.set(index, label);
    });
  }

  async initializeModel() {
    try {
      // Try to load existing model
      const modelLoaded = await this.loadModel();
      if (modelLoaded) {
        console.log('✅ Existing model loaded successfully');
        await this.loadModelMetadata();
      } else {
        console.log('ℹ️ No existing model found - ready for initial training');
      }
    } catch (error) {
      console.error('Error initializing model:', error);
    }
  }
  async loadModel() {
    try {
      const modelPath = './server/models/threat_model/model.json';
      if (!fs.existsSync(modelPath)) {
        return false;
      }
      
      this.model = await tf.loadLayersModel('file://./server/models/threat_model/model.json');
      
      // Load feature scaler
      await this.loadFeatureScaler();
      
      console.log('✅ Threat detection model loaded successfully');
      return true;
    } catch (error) {
      console.log('ℹ️ No existing model found, will need to train first');
      return false;
    }
  }

  async loadFeatureScaler() {
    try {
      const scalerPath = './server/models/threat_model/scaler.json';
      if (fs.existsSync(scalerPath)) {
        const scalerData = JSON.parse(fs.readFileSync(scalerPath, 'utf8'));
        
        // Recreate tensors from saved data
        this.featureScaler = {
          mean: tf.tensor1d(scalerData.mean),
          std: tf.tensor1d(scalerData.std)
        };
        
        console.log('✅ Feature scaler loaded');
      }
    } catch (error) {
      console.error('Error loading feature scaler:', error);
    }
  }

  async saveFeatureScaler() {
    try {
      if (!this.featureScaler) return;
      
      const scalerData = {
        mean: await this.featureScaler.mean.data(),
        std: await this.featureScaler.std.data(),
        version: this.modelVersion,
        savedAt: new Date().toISOString()
      };
      
      const scalerPath = './server/models/threat_model/scaler.json';
      fs.writeFileSync(scalerPath, JSON.stringify(scalerData, null, 2));
      console.log('✅ Feature scaler saved');
    } catch (error) {
      console.error('Error saving feature scaler:', error);
    }
  }

  async loadModelMetadata() {
    try {
      const metadataPath = './server/models/threat_model/metadata.json';
      if (fs.existsSync(metadataPath)) {
        this.modelMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        this.modelVersion = this.modelMetadata.version || 1;
        this.lastTrainingDate = this.modelMetadata.lastTrainingDate;
        this.totalSamplesTrained = this.modelMetadata.totalSamplesTrained || 0;
        this.trainingHistory = this.modelMetadata.trainingHistory || [];
        
        console.log(`✅ Model metadata loaded - Version: ${this.modelVersion}, Samples: ${this.totalSamplesTrained}`);
      }
    } catch (error) {
      console.error('Error loading model metadata:', error);
    }
  }

  async saveModelMetadata(trainingResult) {
    try {
      this.modelMetadata = {
        version: this.modelVersion,
        lastTrainingDate: new Date().toISOString(),
        totalSamplesTrained: this.totalSamplesTrained,
        trainingHistory: this.trainingHistory,
        accuracy: trainingResult.accuracy,
        epochs: trainingResult.epochs,
        threatTypes: Array.from(this.labelEncoder.keys()).filter(k => typeof k === 'string'),
        features: [
          'packet_size', 'source_port', 'dest_port', 'protocol', 
          'hour', 'port_category', 'size_category', 'source_ip_type', 'dest_ip_type'
        ]
      };
      
      const metadataPath = './server/models/threat_model/metadata.json';
      fs.writeFileSync(metadataPath, JSON.stringify(this.modelMetadata, null, 2));
      console.log('✅ Model metadata saved');
    } catch (error) {
      console.error('Error saving model metadata:', error);
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
      
      // Increment version for new training
      this.modelVersion++;
      
      let data;
      if (trainingData) {
        console.log('Using provided training data:', trainingData.length, 'samples');
        console.log('Sample training data format:', trainingData[0]);
        data = trainingData;
      } else {
        console.log('Loading training data from database');
        // Load training data from database
        const dbData = await TrainingData.findAll();
        console.log('Loaded from database:', dbData.length, 'samples');
        console.log('Loaded from database:', data.length, 'samples');
        
        // Convert to simple format
        data = dbData.map(item => ({
          features: item.processed_features,
          label: item.threat_type
      // Add to total samples trained
      this.totalSamplesTrained += data.length;

        }));
        console.log('Sample database format:', JSON.stringify(data[0], null, 2));
      }

      if (data.length < 10) {
        throw new Error(`Insufficient training data. Need at least 10 samples, got ${data.length}.`);
      }

      console.log(`Training model with ${data.length} samples`);

      // Prepare features and labels
      console.log('=== FEATURE EXTRACTION ===');
      const features = data.map(item => item.features);
      const labels = data.map(item => this.labelEncoder.get(item.label) || 0);
      
      console.log('Features shape:', features.length, 'x', features[0]?.length);
      console.log('Sample features:', JSON.stringify(features[0]));
      console.log('Sample labels:', labels.slice(0, 5));
      console.log('Label distribution:', this.getLabelDistribution(data));
      console.log('Sample label mapping:', data[0]?.label, '→', this.labelEncoder.get(data[0]?.label));
      
      // Validate features
      console.log('=== VALIDATION ===');
      if (!this.model) {
        console.log('🏗️ Creating new model architecture...');
      const invalidFeatures = features.filter(f => !Array.isArray(f) || f.length !== 9);
      if (invalidFeatures.length > 0) {
        console.error('Invalid features found:', invalidFeatures);
        console.error('First invalid feature:', JSON.stringify(invalidFeatures[0]));
        throw new Error(`Invalid features found. Expected 9 features per sample, found samples with different lengths.`);
      }
      
      // Validate labels
      const invalidLabels = labels.filter(l => l === undefined || l === null);
      if (invalidLabels.length > 0) {
        console.error('Invalid labels found. Valid labels are:', Array.from(this.labelEncoder.keys()).filter(k => typeof k === 'string'));
        throw new Error(`Invalid labels found. Some labels could not be encoded.`);
      }

      // Check for NaN values in features
      const hasNaN = features.some(f => f.some(val => isNaN(val)));
      if (hasNaN) {
        console.error('NaN values found in features');
        throw new Error('Features contain NaN values');
      }
      // Normalize features
      console.log('=== TENSOR CREATION ===');
      console.log('Creating feature tensor...');
      const featureTensor = tf.tensor2d(features);
      console.log('Feature tensor shape:', featureTensor.shape);
      console.log('Feature tensor dtype:', featureTensor.dtype);
      
      const { normalizedFeatures, scaler } = this.normalizeFeatures(featureTensor);
      this.featureScaler = scaler;
      console.log('Features normalized');
      console.log('Normalized tensor shape:', normalizedFeatures.shape);

      // Convert labels to categorical
      console.log('Creating label tensor...');
      console.log('Label values before tensor:', labels.slice(0, 5));
      const labelTensor = tf.oneHot(tf.tensor1d(labels, 'int32'), this.labelEncoder.size / 2);
      console.log('Label tensor shape:', labelTensor.shape);
      console.log('Label tensor dtype:', labelTensor.dtype);

      // Create model architecture
      console.log('=== MODEL CREATION ===');
      console.log('Creating model architecture...');
      const numClasses = this.labelEncoder.size / 2;
      console.log('Number of classes:', numClasses);
      
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [9], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: numClasses, activation: 'softmax' })
        ]
      });
      console.log('Model created');
      console.log('Model summary:');
      this.model.summary();
      } else {
        console.log('🔄 Using existing model for incremental learning...');
      }

      // Compile model
      console.log('Compiling model...');
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
      console.log('Model compiled');

      // Train model
      console.log('=== MODEL TRAINING ===');
      console.log('Starting model training...');
      const batchSize = Math.min(16, Math.max(1, Math.floor(data.length / 4)));
      console.log('Batch size:', batchSize);
      console.log('Validation split: 0.2');
      
      const history = await this.model.fit(normalizedFeatures, labelTensor, {
        epochs: 30,
        batchSize: batchSize,
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
      console.log('=== MODEL SAVING ===');
      console.log('Saving model...');
      const modelDir = './models/threat_model';
      const modelsBaseDir = './models';
      
      // Ensure directories exist
      if (!fs.existsSync(modelsBaseDir)) {
        console.log('Creating models directory...');
        fs.mkdirSync(modelsBaseDir, { recursive: true });
      }
      
      if (!fs.existsSync(modelDir)) {
        console.log('Creating model directory...');
        fs.mkdirSync(modelDir, { recursive: true });
      }
      
      await this.model.save('file://./models/threat_model');
      console.log('Model saved');

      const finalAccuracy = history.history.val_acc[history.history.val_acc.length - 1];
      console.log('Final validation accuracy:', finalAccuracy);
      
      const result = {
        success: true,
        samplesProcessed: data.length,
        accuracy: (finalAccuracy * 100).toFixed(2),
        epochs: 30
      };
      
      // Add to training history
      this.trainingHistory.push({
        date: new Date().toISOString(),
        samples: data.length,
        accuracy: result.accuracy,
        version: this.modelVersion
      });
      
      // Save metadata
      await this.saveModelMetadata(result);
      console.log('Training result:', JSON.stringify(result, null, 2));
      console.log('=== TRAINING DEBUG END ===');
      
      this.emit('training_completed', result);

      // Cleanup tensors
      featureTensor.dispose();
      normalizedFeatures.dispose();
      labelTensor.dispose();

      return result;

    } catch (error) {
      console.error('Training failed:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', error);
      this.emit('training_failed', { error: error.message });
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  createModelArchitecture() {
    const numClasses = this.labelEncoder.size / 2;
    
    return tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [9], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: numClasses, activation: 'softmax' })
      ]
    });
  }

  async saveModel() {
    try {
      const modelDir = './server/models/threat_model';
      
      // Ensure directory exists
      if (!fs.existsSync('./server/models')) {
        fs.mkdirSync('./server/models', { recursive: true });
      }
      if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
      }
      
      // Save model
      await this.model.save('file://./server/models/threat_model');
      console.log('✅ Model saved successfully');
      
      // Save feature scaler
      await this.saveFeatureScaler();
      
    } catch (error) {
      console.error('❌ Error saving model:', error);
      throw error;
    }
  }
  getLabelDistribution(data) {
    const distribution = {};
    data.forEach(item => {
      distribution[item.label] = (distribution[item.label] || 0) + 1;
    });
    return distribution;
  }
  normalizeFeatures(featureTensor) {
    console.log('Normalizing features...');
    const mean = featureTensor.mean(0);
    const std = featureTensor.sub(mean).square().mean(0).sqrt();
    
    // Add small epsilon to prevent division by zero
    const epsilon = tf.scalar(1e-8);
    const normalizedFeatures = featureTensor.sub(mean).div(std.add(epsilon));
    
    console.log('Mean shape:', mean.shape);
    console.log('Std shape:', std.shape);
    console.log('Normalized shape:', normalizedFeatures.shape);
    
    epsilon.dispose();
    
    return {
      normalizedFeatures,
      scaler: { mean, std }
    };
  }

  async analyzePacket(packet) {
    if (!this.model || !this.featureScaler) {
      console.log('⚠️ Model or scaler not available for packet analysis');
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
        
        // Learn from detected threats (optional: add to training data)
        await this.learnFromThreat(packet, classification, confidence, features);
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

  async learnFromThreat(packet, classification, confidence, features) {
    try {
      // Only learn from high-confidence detections
      if (confidence > 0.9) {
        console.log(`🧠 Learning from high-confidence ${classification} detection`);
        
        // Add to training data for future retraining
        const trainingData = new TrainingData({
          source_ip: packet.sourceIP,
          dest_ip: packet.destinationIP,
          source_port: packet.sourcePort,
          dest_port: packet.destinationPort,
          protocol: packet.protocol?.toUpperCase(),
          packet_size: packet.packetSize,
          duration: 0,
          threat_type: classification,
          processed_features: features,
          source: 'live_detection',
          validated: false
        });
        
        await trainingData.save();
        console.log('✅ Added threat to training data for future learning');
      }
    } catch (error) {
      console.error('Error learning from threat:', error);
    }
  }

  getModelInfo() {
    return {
      version: this.modelVersion,
      lastTrainingDate: this.lastTrainingDate,
      totalSamplesTrained: this.totalSamplesTrained,
      trainingHistory: this.trainingHistory,
      isModelLoaded: !!this.model,
      isScalerLoaded: !!this.featureScaler,
      threatTypes: Array.from(this.labelEncoder.keys()).filter(k => typeof k === 'string')
    };
  }
  // Extract features from CSV row data
  extractFeaturesFromCSVData(csvRow) {
    console.log('Extracting features from CSV row:', csvRow);
    
    // Convert raw CSV data to numerical features for ML
    const features = [
      csvRow.packet_size || 0,                                    // features_0: packet size
      csvRow.source_port || 0,                                    // features_1: source port
      csvRow.dest_port || 0,                                      // features_2: dest port
      this.getProtocolNumber(csvRow.protocol),                    // features_3: protocol number
      this.getTimeFeatures(new Date()),                           // features_4: hour (current time for CSV)
      this.getPortCategoryFeature(csvRow.dest_port),              // features_5: port category
      this.getPacketSizeCategory(csvRow.packet_size),             // features_6: size category
      this.getIPTypeFromString(csvRow.source_ip),                 // features_7: source IP type
      this.getIPTypeFromString(csvRow.dest_ip)                    // features_8: dest IP type
    ];
    
    console.log('Extracted features:', features);
    return features;
  }

  getIPTypeFromString(ip) {
    if (!ip) return 0;
    // Check if IP is private (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (ip.startsWith('192.168.') || 
        ip.startsWith('10.') || 
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
      return 1; // Private
    }
    return 2; // Public
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