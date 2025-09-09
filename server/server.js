require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const csvParser = require('csv-parser');
const { v4: uuidv4 } = require('uuid');

// Import services and models
const NetworkMonitor = require('./services/NetworkMonitor');
const ThreatDetector = require('./services/ThreatDetector');
const EmailService = require('./services/EmailService');
const Threat = require('./models/Threat');
const Alert = require('./models/Alert');
const TrainingData = require('./models/TrainingData');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cybersecurity', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Storage for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Initialize services
const networkInterfaces = process.env.NETWORK_INTERFACES ? 
  process.env.NETWORK_INTERFACES.split(',').map(iface => iface.trim()) : 
  ['eth0', 'wlan0'];

const networkMonitor = new NetworkMonitor(networkInterfaces);
const threatDetector = new ThreatDetector();
const emailService = new EmailService();

// System status
let systemStatus = {
  isScanning: false,
  threatsDetected: 0,
  systemHealth: 'Good',
  lastUpdate: new Date(),
  activeIncidents: 0,
  modelTrained: false,
  networkInterfaces: networkInterfaces,
  isTraining: false
};

// Initialize threat detector
async function initializeThreatDetector() {
  try {
    const modelLoaded = await threatDetector.loadModel();
    systemStatus.modelTrained = modelLoaded;
    
    if (modelLoaded) {
      console.log('Threat detection model loaded and ready');
    } else {
      console.log('No trained model found. Please train the model first.');
    }
  } catch (error) {
    console.error('Error initializing threat detector:', error);
  }
}

// Event handlers
networkMonitor.on('packet_captured', async (packet) => {
  try {
    const analysis = await threatDetector.analyzePacket(packet);
    
    if (analysis.isThreat && analysis.threat) {
      // Update system status
      systemStatus.threatsDetected++;
      systemStatus.activeIncidents++;
      systemStatus.lastUpdate = new Date();
      
      // Create alert for high/critical threats
      if (analysis.threat.severity === 'Critical' || analysis.threat.severity === 'High') {
        const alert = new Alert({
          id: uuidv4(),
          threatId: analysis.threat.id,
          threat: analysis.threat.toObject(),
          timestamp: new Date(),
          acknowledged: false
        });
        
        await alert.save();
        
        // Send email alert
        const emailSent = await emailService.sendThreatAlert(analysis.threat);
        if (emailSent) {
          alert.emailSent = true;
          await alert.save();
        }
        
        io.emit('new_alert', alert);
      }
      
      io.emit('new_threat', analysis.threat);
      io.emit('system_status', systemStatus);
    }
  } catch (error) {
    console.error('Error processing packet:', error);
  }
});

networkMonitor.on('monitoring_started', () => {
  systemStatus.isScanning = true;
  systemStatus.lastUpdate = new Date();
  io.emit('system_status', systemStatus);
  console.log('Network monitoring started');
});

networkMonitor.on('monitoring_stopped', () => {
  systemStatus.isScanning = false;
  systemStatus.lastUpdate = new Date();
  io.emit('system_status', systemStatus);
  console.log('Network monitoring stopped');
});

networkMonitor.on('interface_error', (error) => {
  console.error('Network interface error:', error);
  io.emit('system_error', error);
});

threatDetector.on('training_started', () => {
  systemStatus.isTraining = true;
  io.emit('training_status', { status: 'started' });
});

threatDetector.on('training_progress', (progress) => {
  io.emit('training_progress', progress);
});

threatDetector.on('training_completed', (result) => {
  systemStatus.isTraining = false;
  systemStatus.modelTrained = true;
  io.emit('training_status', { status: 'completed', result });
});

threatDetector.on('training_failed', (error) => {
  systemStatus.isTraining = false;
  io.emit('training_status', { status: 'failed', error });
});

// Routes
app.get('/api/threats', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const threats = await Threat.find({})
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    res.json(threats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await Alert.find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alerts/:id/acknowledge', async (req, res) => {
  try {
    const alert = await Alert.findOne({ id: req.params.id });
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = req.body.acknowledgedBy || 'System';
    
    await alert.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/model/train', upload.single('file'), async (req, res) => {
  if (systemStatus.isTraining) {
    return res.status(400).json({ error: 'Model is already training' });
  }

  try {
    let trainingData = [];

    if (req.file) {
      // Process uploaded CSV file
      const csvData = fs.readFileSync(req.file.path, 'utf8');
      const lines = csvData.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV file must contain header and at least one data row' });
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const dataRows = lines.slice(1);
      
      for (const row of dataRows) {
        const values = row.split(',').map(v => v.trim());
        if (values.length === headers.length) {
          const features = values.slice(0, -1).map(v => parseFloat(v) || 0);
          const label = values[values.length - 1];
          
          // Save to database
          const trainingRecord = new TrainingData({
            features,
            label,
            source: 'csv'
          });
          
          await trainingRecord.save();
          trainingData.push({ features, label });
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
    }

    // Start training
    const result = await threatDetector.trainModel(trainingData.length > 0 ? trainingData : null);
    res.json(result);

  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({ error: 'Training failed: ' + error.message });
  }
});

app.post('/api/system/start-scan', async (req, res) => {
  try {
    if (!systemStatus.modelTrained) {
      return res.status(400).json({ 
        error: 'Cannot start scanning without a trained model. Please train the model first.' 
      });
    }
    
    networkMonitor.start();
    res.json({ success: true, message: 'Network scanning started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system/stop-scan', (req, res) => {
  try {
    networkMonitor.stop();
    res.json({ success: true, message: 'Network scanning stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/status', async (req, res) => {
  try {
    // Update threat counts from database
    const totalThreats = await Threat.countDocuments({});
    const activeIncidents = await Threat.countDocuments({ status: 'Active' });
    
    systemStatus.threatsDetected = totalThreats;
    systemStatus.activeIncidents = activeIncidents;
    
    res.json(systemStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metrics/network', (req, res) => {
  try {
    const stats = networkMonitor.getPacketStats();
    const recentPackets = networkMonitor.getRecentPackets(30);
    
    // Generate metrics from real packet data
    const metrics = [];
    const now = new Date();
    
    for (let i = 30; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000);
      const packetsInMinute = recentPackets.filter(p => 
        new Date(p.timestamp).getTime() > timestamp.getTime() - 60000 &&
        new Date(p.timestamp).getTime() <= timestamp.getTime()
      );
      
      const inboundTraffic = packetsInMinute
        .filter(p => p.destinationIP.startsWith('192.168.') || p.destinationIP.startsWith('10.'))
        .reduce((sum, p) => sum + (p.packetSize || 0), 0);
      
      const outboundTraffic = packetsInMinute
        .filter(p => p.sourceIP.startsWith('192.168.') || p.sourceIP.startsWith('10.'))
        .reduce((sum, p) => sum + (p.packetSize || 0), 0);
      
      metrics.push({
        timestamp,
        inboundTraffic: Math.floor(inboundTraffic / 1024), // Convert to KB
        outboundTraffic: Math.floor(outboundTraffic / 1024),
        suspiciousConnections: Math.floor(Math.random() * 5), // Placeholder
        blockedAttempts: Math.floor(Math.random() * 3)
      });
    }
    
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/network/stats', (req, res) => {
  try {
    const stats = networkMonitor.getPacketStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/test', async (req, res) => {
  try {
    const result = await emailService.testEmailConfiguration();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/training-data', async (req, res) => {
  try {
    const data = await TrainingData.find({})
      .sort({ timestamp: -1 })
      .limit(1000)
      .lean();
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/training-data', async (req, res) => {
  try {
    const { features, label } = req.body;
    
    if (!features || !label || !Array.isArray(features)) {
      return res.status(400).json({ error: 'Invalid training data format' });
    }
    
    const trainingData = new TrainingData({
      features,
      label,
      source: 'manual'
    });
    
    await trainingData.save();
    res.json({ success: true, data: trainingData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current system status
  socket.emit('system_status', systemStatus);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize system
async function initializeSystem() {
  try {
    // Create models directory if it doesn't exist
    const modelsDir = path.join(__dirname, 'models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    
    // Initialize threat detector
    await initializeThreatDetector();
    
    // Load initial system status
    const totalThreats = await Threat.countDocuments({});
    const activeIncidents = await Threat.countDocuments({ status: 'Active' });
    
    systemStatus.threatsDetected = totalThreats;
    systemStatus.activeIncidents = activeIncidents;
    
    console.log('System initialized successfully');
    console.log(`Network interfaces configured: ${networkInterfaces.join(', ')}`);
    console.log(`Email alerts configured: ${emailService.isConfigured ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error('Error initializing system:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  networkMonitor.stop();
  mongoose.connection.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initializeSystem();
});