require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const supabase = require('./config/supabase');

// Import services and models
const NetworkMonitor = require('./services/NetworkMonitor');
const ThreatDetector = require('./services/ThreatDetector');
const EmailService = require('./services/EmailService');
const Threat = require('./models/Threat');
const Alert = require('./models/Alert');
const TrainingData = require('./models/TrainingData');
const User = require('./models/User');

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

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log('Connected to Supabase successfully');
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
}

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
    const offset = (page - 1) * limit;
    
    const threats = await Threat.findAll(limit, offset);
    
    res.json(threats.map(threat => threat.toAPI()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await Alert.findAll(100);
    
    res.json(alerts.map(alert => alert.toAPI()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alerts/:id/acknowledge', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    await alert.acknowledge(req.body.acknowledgedBy || 'System');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Model information route
app.get('/api/model/info', async (req, res) => {
  try {
    const modelInfo = threatDetector.getModelInfo();
    const trainingDataCount = await TrainingData.countAll();
    
    res.json({
      ...modelInfo,
      trainingDataCount,
      isReady: modelInfo.isModelLoaded && modelInfo.isScalerLoaded
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Incremental training route
app.post('/api/model/retrain', async (req, res) => {
  try {
    if (systemStatus.isTraining) {
      return res.status(400).json({ error: 'Model is already training' });
    }
    
    console.log('Starting incremental retraining with latest data...');
    
    // Get all training data including new detections
    const allTrainingData = await TrainingData.findAll();
    
    if (allTrainingData.length < 10) {
      return res.status(400).json({ 
        error: `Insufficient training data for retraining. Need at least 10 samples, found ${allTrainingData.length}.` 
      });
    }
    
    // Convert to training format
    const trainingData = allTrainingData.map(item => ({
      features: item.processed_features,
      label: item.threat_type
    }));
    
    const result = await threatDetector.trainModel(trainingData);
    res.json(result);
    
  } catch (error) {
    console.error('Retraining error:', error);
    res.status(500).json({ error: 'Retraining failed: ' + error.message });
  }
});

app.post('/api/model/train', upload.single('file'), async (req, res) => {
  if (systemStatus.isTraining) {
    return res.status(400).json({ error: 'Model is already training' });
  }

  try {
    console.log('=== SERVER TRAINING REQUEST START ===');
    console.log('Starting model training...');
    let trainingData = [];

    if (req.file) {
      console.log('=== FILE PROCESSING ===');
      console.log('Processing uploaded CSV file:', req.file.filename);
      // Process uploaded CSV file
      const csvData = fs.readFileSync(req.file.path, 'utf8');
      console.log('CSV file size:', csvData.length, 'bytes');
      
      const lines = csvData.split('\n').filter(line => line.trim() !== '');
      console.log('CSV lines found:', lines.length);
      
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV file must contain header and at least one data row' });
      }

      const headers = lines[0].split(',').map(h => h.trim());
      console.log('CSV headers:', headers);
      const dataRows = lines.slice(1);
      console.log('Data rows to process:', dataRows.length);
      
      // Check if headers match new CSV format
      const expectedHeaders = ['source_ip', 'dest_ip', 'source_port', 'dest_port', 'protocol', 'packet_size', 'duration', 'threat_type'];
      const hasRequiredHeaders = expectedHeaders.every(header => headers.includes(header));
      
      console.log('Has required headers:', hasRequiredHeaders);
      
      if (!hasRequiredHeaders) {
        console.log('Headers do not match expected format.');
        console.log('Found headers:', headers);
        return res.status(400).json({ 
          error: 'Invalid CSV format. Expected headers: source_ip, dest_ip, source_port, dest_port, protocol, packet_size, duration, threat_type',
          foundHeaders: headers,
          expectedHeaders: expectedHeaders
        });
      }
      
      console.log('=== ROW PROCESSING ===');
      let validRows = 0;
      let invalidRows = 0;
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row.trim()) continue; // Skip empty rows
        
        const values = row.split(',').map(v => v.trim());
        
        if (values.length === headers.length) {
          // Parse CSV row into structured data
          const csvRow = {};
          headers.forEach((header, index) => {
            csvRow[header] = values[index];
          });
          
          // Validate required fields
          if (!csvRow.source_ip || !csvRow.dest_ip || !csvRow.threat_type) {
            console.warn(`Row ${i + 1} missing required fields`);
            invalidRows++;
            continue;
          }
          
          // Validate and convert data types
          const processedRow = {
            source_ip: csvRow.source_ip,
            dest_ip: csvRow.dest_ip,
            source_port: parseInt(csvRow.source_port) || 0,
            dest_port: parseInt(csvRow.dest_port) || 0,
            protocol: csvRow.protocol?.toUpperCase(),
            packet_size: parseInt(csvRow.packet_size) || 0,
            duration: parseFloat(csvRow.duration) || 0,
            threat_type: csvRow.threat_type
          };
          
          // Validate threat type
          const validLabels = ['Normal', 'Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'];
          if (!validLabels.includes(processedRow.threat_type)) {
            console.warn(`Row ${i + 1} has invalid threat_type:`, processedRow.threat_type);
            invalidRows++;
            continue;
          }
          
          // Extract ML features from CSV data
          const features = threatDetector.extractFeaturesFromCSVData(processedRow);
          const label = processedRow.threat_type;
          
          // Validate features
          if (features.length !== 9) {
            console.warn(`Row ${i + 1} has wrong number of features:`, features.length);
            invalidRows++;
            continue;
          }
          
          // Check for NaN in features
          if (features.some(f => isNaN(f))) {
            console.warn(`Row ${i + 1} has NaN features:`, features);
            invalidRows++;
            continue;
          }
          
          // Save to database
          try {
            const trainingRecord = new TrainingData({
              ...processedRow,
              processed_features: features,
              source: 'csv'
            });
            
            await trainingRecord.save();
            validRows++;
          } catch (dbError) {
            console.error(`Error saving training record ${i + 1}:`, dbError);
            invalidRows++;
            continue;
          }
          
          trainingData.push({ features, label });
        } else {
          console.warn(`Row ${i + 1} has wrong number of columns:`, values.length, 'expected:', headers.length);
          invalidRows++;
        }
      }

      console.log(`Processing complete: ${validRows} valid rows, ${invalidRows} invalid rows`);
      console.log('Total training samples for ML:', trainingData.length);
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
    } else {
      console.log('No file uploaded, using existing database data');
    }

    // Start training
    console.log('=== STARTING MODEL TRAINING ===');
    console.log('Starting model training with', trainingData.length, 'samples');
    
    if (trainingData.length === 0) {
      console.log('No training data from file, checking database...');
      const dbCount = await TrainingData.countAll();
      console.log('Database training samples:', dbCount);
      if (dbCount < 10) {
        return res.status(400).json({ 
          error: `Insufficient training data. Need at least 10 samples, found ${dbCount} in database and ${trainingData.length} from file.` 
        });
      }
    }
    
    const result = await threatDetector.trainModel(trainingData.length > 0 ? trainingData : null);
    console.log('Training completed:', result);
    console.log('=== SERVER TRAINING REQUEST END ===');
    res.json(result);

  } catch (error) {
    console.error('=== SERVER TRAINING REQUEST ERROR ===');
    console.error('Training error:', error);
    console.error('Error stack:', error.stack);
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
    const totalThreats = await Threat.countAll();
    const activeIncidents = await Threat.countByStatus('active');
    const trainingDataCount = await TrainingData.countAll();
    
    // Get model information
    const modelInfo = threatDetector.getModelInfo();
    
    systemStatus.threatsDetected = totalThreats;
    systemStatus.activeIncidents = activeIncidents;
    systemStatus.modelInfo = modelInfo;
    systemStatus.trainingDataCount = trainingDataCount;
    
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
    const data = await TrainingData.findAll(1000);
    
    res.json(data.map(item => item.toAPI()));
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
    res.json({ success: true, data: trainingData.toAPI() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User management routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.findAll();
    
    res.json(users.map(user => user.toAPI()));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    console.log('Creating user with data:', req.body);
    const { email, name, role, alertPreferences, isActive } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Map role to database format
    const roleMapping = {
      'admin': 'security_admin',
      'security_analyst': 'security_analyst', 
      'it_manager': 'security_manager',
      'viewer': 'security_viewer'
    };
    
    const dbRole = roleMapping[role] || 'security_viewer';
    
    const user = new User({
      email,
      full_name: name,
      username: email,
      role: dbRole,
      is_active: isActive !== undefined ? isActive : true,
      alert_preferences: JSON.stringify(alertPreferences || {
        emailEnabled: true,
        severityLevels: ['Critical', 'High'],
        threatTypes: ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'],
        immediateAlert: true,
        dailySummary: true,
        weeklySummary: false
      })
    });
    
    console.log('User object created:', user.toDatabase());
    
    const savedUser = await user.save();
    console.log('User created successfully:', savedUser.id);
    res.json({ success: true, user: savedUser.toAPI() });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.details || error.hint || 'Unknown database error'
    });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    console.log('Updating user:', req.params.id, 'with data:', req.body);
    const { name, role, alertPreferences, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Map role to database format
    const roleMapping = {
      'admin': 'security_admin',
      'security_analyst': 'security_analyst',
      'it_manager': 'security_manager', 
      'viewer': 'security_viewer'
    };
    
    const updates = {};
    if (name) updates.full_name = name;
    if (role) updates.role = roleMapping[role] || role;
    if (alertPreferences) updates.alert_preferences = JSON.stringify(alertPreferences);
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    
    const updatedUser = await user.update(updates);
    console.log('User updated successfully:', updatedUser.id);
    
    res.json({ success: true, user: updatedUser.toAPI() });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.details || error.hint || 'Unknown database error'
    });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    console.log('Deleting user:', req.params.id);
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await user.delete();
    console.log('User deleted successfully:', req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Email configuration and testing routes
app.post('/api/email/test', async (req, res) => {
  try {
    const result = await emailService.testEmailConfiguration();
    res.json(result);
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/send-test-threat', async (req, res) => {
  try {
    // Create a mock threat for testing
    const mockThreat = {
      id: uuidv4(),
      timestamp: new Date(),
      type: 'Test Threat Alert',
      severity: 'Medium',
      source: '192.168.1.100',
      destination: '8.8.8.8',
      sourcePort: 12345,
      destinationPort: 80,
      protocol: 'tcp',
      packetSize: 1024,
      description: 'This is a test threat alert to verify the email system is working correctly.',
      classification: 'Test',
      confidence: 0.85,
      networkInterface: 'eth0',
      location: 'Test Environment'
    };
    
    const result = await emailService.sendThreatAlert(mockThreat);
    res.json({ success: result, message: result ? 'Test threat alert sent' : 'Failed to send test alert' });
  } catch (error) {
    console.error('Error sending test threat alert:', error);
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
    
    // Create default admin user if none exists
    const adminCount = await User.countByRole('admin');
    if (adminCount === 0) {
      console.log('Creating default admin user...');
      const defaultAdmin = new User({
        email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@hospital.com',
        name: 'System Administrator',
        role: 'admin',
        alert_preferences: {
          emailEnabled: true,
          severityLevels: ['Critical', 'High', 'Medium', 'Low'],
          threatTypes: ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'],
          immediateAlert: true,
          dailySummary: true,
          weeklySummary: false
        }
      });
      
      const savedAdmin = await defaultAdmin.save();
      console.log('Created default admin user:', savedAdmin.email, 'with ID:', savedAdmin.id);
    } else {
      console.log('Admin user already exists, skipping creation');
    }
    
    // Initialize threat detector
    await testSupabaseConnection();
    await initializeThreatDetector();
    
    // Load initial system status
    const totalThreats = await Threat.countAll();
    const activeIncidents = await Threat.countByStatus('active');
    
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
  emailService.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initializeSystem();
});