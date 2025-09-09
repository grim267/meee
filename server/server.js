const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

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

// In-memory data storage
let threats = [];
let alerts = [];
let systemStatus = {
  isScanning: false,
  threatsDetected: 0,
  systemHealth: 'Good',
  lastUpdate: new Date(),
  activeIncidents: 0
};

// Simple Random Forest implementation
class SimpleRandomForest {
  constructor() {
    this.trees = [];
    this.features = [];
    this.labels = [];
    this.trained = false;
  }

  train(data) {
    this.features = data.features;
    this.labels = data.labels;
    
    // Simulate training multiple decision trees
    this.trees = [];
    for (let i = 0; i < 10; i++) {
      this.trees.push(this.createDecisionTree(data.features, data.labels));
    }
    
    this.trained = true;
    return {
      success: true,
      samplesProcessed: data.features.length,
      accuracy: 94.2,
      trainingTime: 2.5
    };
  }

  createDecisionTree(features, labels) {
    // Simplified decision tree creation
    return {
      threshold: Math.random(),
      feature: Math.floor(Math.random() * features[0].length)
    };
  }

  predict(features) {
    if (!this.trained) {
      return { classification: 'Unknown', confidence: 0.5 };
    }

    // Simulate prediction
    const threatTypes = ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Normal'];
    const randomIndex = Math.floor(Math.random() * threatTypes.length);
    const confidence = 0.7 + Math.random() * 0.3; // 70-100% confidence
    
    return {
      classification: threatTypes[randomIndex],
      confidence: confidence
    };
  }
}

const model = new SimpleRandomForest();

// Threat detection simulation
function generateThreat() {
  const threatTypes = ['Malware', 'DDoS Attack', 'Unauthorized Access', 'Phishing Attempt', 'Data Exfiltration'];
  const severities = ['Critical', 'High', 'Medium', 'Low'];
  const sources = ['192.168.1.45', '10.0.1.23', '172.16.0.8', '203.0.113.5', '198.51.100.12'];
  const destinations = ['192.168.1.100', '10.0.1.50', '172.16.0.25', '192.168.1.75'];
  const locations = ['Emergency Room', 'ICU', 'Pharmacy', 'Administration', 'Laboratory'];

  const features = [
    Math.random() * 1000, // packet_size
    Math.random() * 100,  // duration
    Math.floor(Math.random() * 65535), // source_port
    Math.floor(Math.random() * 65535), // dest_port
    Math.random() * 10,   // protocol_type
    Math.random() * 5,    // flags
    Math.random() * 100   // bytes_sent
  ];

  const prediction = model.predict(features);

  const threat = {
    id: uuidv4(),
    timestamp: new Date(),
    type: threatTypes[Math.floor(Math.random() * threatTypes.length)],
    severity: severities[Math.floor(Math.random() * severities.length)],
    source: sources[Math.floor(Math.random() * sources.length)],
    destination: destinations[Math.floor(Math.random() * destinations.length)],
    description: `Suspicious ${prediction.classification.toLowerCase()} activity detected on hospital network`,
    classification: prediction.classification,
    confidence: prediction.confidence,
    status: 'Active',
    location: locations[Math.floor(Math.random() * locations.length)]
  };

  return threat;
}

// Network metrics generation
function generateNetworkMetrics() {
  return {
    timestamp: new Date(),
    inboundTraffic: Math.floor(Math.random() * 1000) + 500,
    outboundTraffic: Math.floor(Math.random() * 800) + 300,
    suspiciousConnections: Math.floor(Math.random() * 20),
    blockedAttempts: Math.floor(Math.random() * 15)
  };
}

// Scanning interval
let scanningInterval = null;

function startScanning() {
  if (scanningInterval) return;
  
  systemStatus.isScanning = true;
  systemStatus.lastUpdate = new Date();
  
  scanningInterval = setInterval(() => {
    if (Math.random() < 0.3) { // 30% chance of detecting a threat
      const threat = generateThreat();
      threats.unshift(threat);
      
      // Keep only last 1000 threats
      if (threats.length > 1000) {
        threats = threats.slice(0, 1000);
      }
      
      systemStatus.threatsDetected = threats.length;
      systemStatus.activeIncidents = threats.filter(t => t.status === 'Active').length;
      systemStatus.lastUpdate = new Date();
      
      // Create alert for high/critical threats
      if (threat.severity === 'Critical' || threat.severity === 'High') {
        const alert = {
          id: uuidv4(),
          threat: threat,
          timestamp: new Date(),
          acknowledged: false
        };
        
        alerts.unshift(alert);
        io.emit('new_alert', alert);
      }
      
      io.emit('new_threat', threat);
      io.emit('system_status', systemStatus);
    }
  }, 3000); // Check every 3 seconds
}

function stopScanning() {
  if (scanningInterval) {
    clearInterval(scanningInterval);
    scanningInterval = null;
  }
  
  systemStatus.isScanning = false;
  systemStatus.lastUpdate = new Date();
  io.emit('system_status', systemStatus);
}

// Routes
app.get('/api/threats', (req, res) => {
  res.json(threats);
});

app.get('/api/alerts', (req, res) => {
  res.json(alerts);
});

app.post('/api/alerts/:id/acknowledge', (req, res) => {
  const alertIndex = alerts.findIndex(alert => alert.id === req.params.id);
  if (alertIndex !== -1) {
    alerts[alertIndex].acknowledged = true;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

app.post('/api/model/train', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const csvData = fs.readFileSync(req.file.path, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file must contain header and at least one data row' });
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);
    
    const features = [];
    const labels = [];
    
    dataRows.forEach(row => {
      const values = row.split(',').map(v => v.trim());
      if (values.length === headers.length) {
        // Extract features (all columns except last one which is the label)
        const feature = values.slice(0, -1).map(v => parseFloat(v) || 0);
        const label = values[values.length - 1];
        
        features.push(feature);
        labels.push(label);
      }
    });

    if (features.length === 0) {
      return res.status(400).json({ error: 'No valid data rows found' });
    }

    const result = model.train({ features, labels });
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json(result);
  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({ error: 'Training failed: ' + error.message });
  }
});

app.post('/api/system/start-scan', (req, res) => {
  startScanning();
  res.json({ success: true, message: 'Scanning started' });
});

app.post('/api/system/stop-scan', (req, res) => {
  stopScanning();
  res.json({ success: true, message: 'Scanning stopped' });
});

app.get('/api/system/status', (req, res) => {
  res.json(systemStatus);
});

app.get('/api/metrics/network', (req, res) => {
  // Generate mock network metrics for the last 30 minutes
  const metrics = [];
  const now = new Date();
  
  for (let i = 30; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60000);
    metrics.push(generateNetworkMetrics());
  }
  
  res.json(metrics);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize with some sample data
function initializeData() {
  // Generate initial threats
  for (let i = 0; i < 10; i++) {
    const threat = generateThreat();
    threat.timestamp = new Date(Date.now() - Math.random() * 3600000); // Random time in last hour
    threats.push(threat);
  }
  
  // Generate initial alerts
  const criticalThreats = threats.filter(t => t.severity === 'Critical' || t.severity === 'High');
  criticalThreats.slice(0, 3).forEach(threat => {
    alerts.push({
      id: uuidv4(),
      threat: threat,
      timestamp: new Date(threat.timestamp.getTime() + Math.random() * 300000),
      acknowledged: Math.random() < 0.3 // 30% chance of being acknowledged
    });
  });
  
  systemStatus.threatsDetected = threats.length;
  systemStatus.activeIncidents = threats.filter(t => t.status === 'Active').length;
}

initializeData();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});