# CyberSecure Hospital Defense System

A real-time cybersecurity monitoring and threat detection system designed for hospital networks. This system monitors network traffic on WiFi and Ethernet interfaces, uses machine learning for threat detection, and provides email alerting capabilities.

## Features

- **Real-time Network Monitoring**: Monitors WiFi and Ethernet interfaces using tcpdump
- **Machine Learning Threat Detection**: TensorFlow.js-based neural network for threat classification
- **Email Alerting System**: Automated email notifications for critical threats
- **Web Dashboard**: Real-time monitoring dashboard with threat visualization
- **Database Storage**: MongoDB for persistent threat and alert storage
- **Configurable Thresholds**: Adjustable threat detection sensitivity

## Prerequisites

- Node.js 16+ 
- MongoDB
- tcpdump (for network monitoring)
- Root/sudo access (for network interface monitoring)

## Installation

1. Clone the repository
2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Install backend dependencies:
   ```bash
   cd server
   npm install
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Start MongoDB service

6. Start the backend server:
   ```bash
   cd server
   sudo node server.js  # Requires sudo for network monitoring
   ```

7. Start the frontend:
   ```bash
   npm run dev
   ```

## Configuration

### Environment Variables (.env)

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAIL=security-team@hospital.com

# Database
MONGODB_URI=mongodb://localhost:27017/cybersecurity

# Network Interfaces (comma separated)
NETWORK_INTERFACES=eth0,wlan0

# Threat Detection
THREAT_THRESHOLD=0.7
SCAN_INTERVAL=5000
```

### Network Interface Setup

The system monitors specified network interfaces. Common interface names:
- `eth0`, `eth1` - Ethernet interfaces
- `wlan0`, `wlan1` - WiFi interfaces
- `enp0s3`, `wlp2s0` - Modern Linux naming

Use `ip link show` or `ifconfig` to list available interfaces.

## Usage

1. **Train the Model**: Upload training data CSV or use existing database data
2. **Start Monitoring**: Begin real-time network scanning
3. **Monitor Threats**: View detected threats in real-time dashboard
4. **Manage Alerts**: Acknowledge and track security alerts
5. **Review Metrics**: Analyze network traffic patterns

### Training Data Format

CSV files should contain:
- Network features (packet size, ports, protocol, etc.)
- Last column: threat label (Normal, Malware, DDoS, Intrusion, Phishing, Port_Scan, Brute_Force)

## Security Considerations

- Run backend with appropriate privileges for network monitoring
- Secure MongoDB instance
- Use strong SMTP credentials
- Configure firewall rules appropriately
- Regular model retraining with new threat data

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Database**: MongoDB
- **ML Framework**: TensorFlow.js
- **Network Monitoring**: tcpdump
- **Email**: Nodemailer

## License

MIT License