# 🛡️ CyberSecure Hospital Defense System - Python Backend

A powerful Python-based backend for real-time cybersecurity threat detection using Random Forest machine learning.

## 🚀 Features

- **Random Forest ML Model**: Scikit-learn based threat classification
- **Real-time Network Monitoring**: Packet capture and analysis
- **Email Alerting System**: Configurable SMTP notifications
- **User Management**: Complete user CRUD operations
- **Persistent Learning**: Model remembers all training data
- **RESTful API**: Flask-based API for frontend integration
- **WebSocket Support**: Real-time updates via Socket.IO

## 📋 Prerequisites

- **Python 3.8+**
- **Root/sudo access** (for network packet capture)
- **tcpdump** (network packet analyzer)
- **Supabase account** (for database)

## 🔧 Installation

### 1. Install System Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip tcpdump

# macOS
brew install python tcpdump

# CentOS/RHEL
sudo yum install python3 python3-pip tcpdump
```

### 2. Install Python Dependencies

```bash
cd python_backend
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your configuration
nano .env
```

**Required Environment Variables:**
```env
# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Email Configuration (REQUIRED for alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Network Interfaces (adjust for your system)
NETWORK_INTERFACES=eth0,wlan0

# System Configuration
FLASK_ENV=development
FLASK_PORT=3001
```

## 🚀 Running the Backend

### Quick Start
```bash
cd python_backend
sudo python run.py
```

### Alternative Methods
```bash
# Direct Flask run
sudo python app.py

# Development mode (no network monitoring)
python app.py

# With specific port
FLASK_PORT=3002 sudo python run.py
```

### Why Sudo is Required
- **Network Packet Capture**: Uses `tcpdump` for real-time monitoring
- **Raw Socket Access**: Needs root privileges for network interfaces
- **Security Monitoring**: Essential for threat detection

## 🧠 Machine Learning Model

### Random Forest Classifier
- **Algorithm**: Scikit-learn RandomForestClassifier
- **Features**: 9 numerical features extracted from network data
- **Classes**: 7 threat types (Normal, Malware, DDoS, Intrusion, Phishing, Port_Scan, Brute_Force)
- **Persistence**: Model and scaler saved to disk with joblib

### Feature Engineering
The system automatically converts network data to ML features:
1. **packet_size** - Size of network packet
2. **source_port** - Source port number
3. **dest_port** - Destination port number
4. **protocol** - Protocol number (TCP=6, UDP=17, ICMP=1)
5. **hour** - Hour of day (0-23)
6. **port_category** - Port classification (well-known/registered/dynamic)
7. **size_category** - Packet size classification
8. **source_ip_type** - Source IP type (private/public)
9. **dest_ip_type** - Destination IP type (private/public)

### Training Process
1. **Data Validation**: Ensures 9 features per sample
2. **Feature Scaling**: StandardScaler normalization
3. **Train/Test Split**: 80/20 split with stratification
4. **Model Training**: Random Forest with 100 estimators
5. **Evaluation**: Accuracy and classification report
6. **Persistence**: Model, scaler, and metadata saved

## 📧 Email System

### Configuration
- **SMTP Support**: Gmail, Outlook, custom SMTP servers
- **HTML Templates**: Rich HTML email alerts with styling
- **Queue System**: Background email processing
- **User Preferences**: Per-user alert configuration

### Alert Types
- **Threat Alerts**: Real-time security notifications
- **Test Emails**: Configuration verification
- **System Alerts**: Administrative notifications

### Email Features
- **Priority Handling**: Critical threats sent immediately
- **Rich Formatting**: HTML emails with threat details
- **User Filtering**: Alerts based on user preferences
- **Delivery Tracking**: Email sent status tracking

## 👥 User Management

### User Roles
- **admin**: Full system access
- **security_analyst**: Threat analysis and response
- **it_manager**: System management
- **viewer**: Read-only access

### User Features
- **CRUD Operations**: Create, read, update, delete users
- **Alert Preferences**: Configurable notification settings
- **Role-based Access**: Different permission levels
- **Active/Inactive Status**: User account management

### Alert Preferences
```json
{
  "emailEnabled": true,
  "severityLevels": ["Critical", "High"],
  "threatTypes": ["Malware", "DDoS", "Intrusion"],
  "immediateAlert": true,
  "dailySummary": true,
  "weeklySummary": false
}
```

## 🔌 API Endpoints

### Health & Status
- `GET /api/health` - System health check
- `GET /api/system/status` - Current system status
- `POST /api/system/start-scan` - Start network scanning
- `POST /api/system/stop-scan` - Stop network scanning

### Threats & Alerts
- `GET /api/threats` - Get threats with pagination
- `GET /api/alerts` - Get all alerts
- `POST /api/alerts/:id/acknowledge` - Acknowledge alert

### Machine Learning
- `GET /api/model/info` - Get model information
- `POST /api/model/train` - Train model (with optional CSV upload)
- `POST /api/model/retrain` - Retrain with all data

### User Management
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Email System
- `GET /api/email/settings` - Get email configuration
- `POST /api/email/configure` - Configure email settings
- `POST /api/email/test` - Test email configuration
- `POST /api/email/send-test-threat` - Send test threat alert

### Network Monitoring
- `GET /api/metrics/network` - Get network metrics

## 🔄 WebSocket Events

### Client → Server
- `connect` - Client connection
- `disconnect` - Client disconnection

### Server → Client
- `system_status` - System status updates
- `new_threat` - New threat detected
- `new_alert` - New alert created
- `training_status` - Training progress updates
- `training_progress` - Training epoch progress

## 📊 Database Schema

The system uses Supabase with the following main tables:
- **users** - User accounts and preferences
- **threats** - Detected security threats
- **alerts** - Alert notifications
- **training_data** - ML training samples
- **learning_sessions** - Training session history
- **model_metadata** - Model version and statistics

## 🐛 Troubleshooting

### Common Issues

#### 1. Permission Denied
```bash
# Solution: Run with sudo
sudo python run.py
```

#### 2. Missing Dependencies
```bash
# Reinstall requirements
pip install -r requirements.txt
```

#### 3. Network Interface Not Found
```bash
# Check available interfaces
ip link show

# Update .env file
NETWORK_INTERFACES=your-actual-interface-names
```

#### 4. Supabase Connection Error
- Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
- Check internet connection
- Ensure Supabase project is active

#### 5. Email Configuration Issues
- Use app passwords for Gmail (not regular password)
- Check SMTP settings for your provider
- Test with "Test Email Configuration" endpoint

### Logging
```bash
# View logs
tail -f logs/cybersecure.log

# Check for errors
grep -i error logs/cybersecure.log
```

## 🔒 Security Considerations

- **Network Monitoring**: Requires root privileges
- **Database Security**: Use service role key for backend
- **Email Security**: Use app passwords, not regular passwords
- **API Security**: Implement authentication in production
- **Data Privacy**: Secure handling of network traffic data

## 🚀 Production Deployment

### Environment Setup
```env
FLASK_ENV=production
SUPABASE_URL=your-production-url
# Use production credentials
```

### Process Management
```bash
# Install supervisor or systemd service
# Configure log rotation
# Set up monitoring and alerting
```

The Python backend provides a robust, scalable foundation for real-time cybersecurity threat detection with machine learning!