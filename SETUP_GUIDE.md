# 🛡️ CyberSecure Hospital Defense System - Setup Guide

## 📋 Prerequisites

### System Requirements
- **Node.js 16+** (for backend and frontend)
- **Root/sudo access** (required for network packet capture)
- **tcpdump** (network packet analyzer)
- **Supabase account** (for database)
- **Email provider** (Gmail, Outlook, etc. for SMTP)

### Operating System Support
- **Linux** (Ubuntu, CentOS, Debian) - Recommended
- **macOS** (with Homebrew)
- **Windows** (with WSL2 recommended)

## 🚀 Step-by-Step Setup

### 1. Install System Dependencies

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install tcpdump nodejs npm build-essential python3
```

#### CentOS/RHEL:
```bash
sudo yum install tcpdump nodejs npm gcc-c++ make python3
```

#### macOS:
```bash
brew install tcpdump node
```

#### Windows (WSL2):
```bash
sudo apt update
sudo apt install tcpdump nodejs npm build-essential python3
```

### 2. Clone and Install Project

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 3. Setup Supabase Database

#### Option A: Use Existing Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign in and select your project
3. Go to Settings → API
4. Copy your Project URL and anon key

#### Option B: Create New Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and create project
4. Wait for setup to complete
5. Go to Settings → API
6. Copy your Project URL and anon key

### 4. Configure Environment Variables

Create `.env` file in the `server` directory:

```bash
cd server
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Email Configuration (REQUIRED for alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Default Admin User
DEFAULT_ADMIN_EMAIL=admin@yourhospital.com

# Network Interfaces (adjust for your system)
NETWORK_INTERFACES=eth0,wlan0

# Threat Detection Settings
THREAT_THRESHOLD=0.7
SCAN_INTERVAL=5000

# System Configuration
NODE_ENV=development
PORT=3001
```

### 5. Setup Email Provider

#### For Gmail:
1. Enable 2-Factor Authentication
2. Generate App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification
   - App passwords → Generate password
   - Use this password in SMTP_PASS

#### For Outlook/Hotmail:
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### 6. Setup Database Schema

The system will automatically create database tables when you connect to Supabase. The migration files are already prepared.

### 7. Identify Network Interfaces

Find your network interfaces:

```bash
# Linux/macOS
ip link show
# or
ifconfig

# Common interface names:
# - eth0, eth1 (Ethernet)
# - wlan0, wlan1 (WiFi)
# - enp0s3, enp0s8 (Modern Linux Ethernet)
# - wlp2s0, wlp3s0 (Modern Linux WiFi)
```

Update `NETWORK_INTERFACES` in your `.env` file with the correct interface names.

## 🏃‍♂️ Running the System

### 1. Start the Backend (with sudo for network access)

```bash
cd server
sudo npm start
```

**Why sudo?** The system needs root privileges to capture network packets using tcpdump.

### 2. Start the Frontend (in a new terminal)

```bash
# From project root directory
npm run dev
```

### 3. Access the System

Open your browser and go to: `http://localhost:5173`

## 🔧 Initial Configuration

### 1. Connect to Supabase
- Click "Connect to Supabase" button in the top right
- This will create all necessary database tables

### 2. Verify System Status
- Check the header for connection status indicators
- Green dots indicate healthy connections

### 3. Add Users (User Management Tab)
- Add security team members
- Configure their alert preferences
- Test email functionality

### 4. Train the Model (ML Model Tab)
- Upload training data CSV file, or
- Use "Train with DB Data" for initial training
- Wait for training to complete

### 5. Start Threat Monitoring (System Controls Tab)
- Click "Start Scanning" to begin network monitoring
- Monitor real-time threat detection

## 📊 System Verification

### Check Network Monitoring
```bash
# Verify tcpdump is working
sudo tcpdump -i eth0 -c 5

# Check if interfaces exist
ip link show eth0
ip link show wlan0
```

### Test Email System
1. Go to User Management tab
2. Click "Test Email Configuration"
3. Check if test emails are received

### Verify Database Connection
- Check browser console for any database errors
- Verify users are being created in Supabase dashboard

## 🐛 Troubleshooting

### Common Issues

#### 1. "Permission denied" for network interfaces
```bash
# Solution: Run backend with sudo
sudo npm start
```

#### 2. "Interface not found" errors
```bash
# Check available interfaces
ip link show

# Update .env file with correct interface names
NETWORK_INTERFACES=your-actual-interface-names
```

#### 3. Email not sending
- Verify SMTP credentials
- Check if 2FA is enabled (use app password)
- Test with "Test Email Configuration" button

#### 4. Database connection errors
- Verify Supabase URL and keys
- Check internet connection
- Ensure Supabase project is active

#### 5. Model training fails
- Ensure sufficient training data (minimum 10 samples)
- Check browser console for detailed errors
- Verify TensorFlow.js is properly installed

### Log Files
```bash
# Backend logs
cd server
npm start 2>&1 | tee system.log

# Check system logs
tail -f system.log
```

## 🔒 Security Considerations

### Network Security
- Run on isolated network segment if possible
- Monitor system resource usage
- Regular security updates

### Access Control
- Use strong passwords for admin accounts
- Limit user access based on roles
- Regular audit of user permissions

### Data Protection
- Secure Supabase credentials
- Use HTTPS in production
- Regular database backups

## 📈 Production Deployment

### 1. Environment Setup
```env
NODE_ENV=production
SUPABASE_URL=your-production-supabase-url
# Use production email credentials
```

### 2. Process Management
```bash
# Install PM2 for process management
npm install -g pm2

# Start backend with PM2
cd server
sudo pm2 start npm --name "cybersecurity-backend" -- start

# Start frontend build
npm run build
```

### 3. Monitoring
- Set up log rotation
- Monitor system resources
- Configure alerting for system failures

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review system logs for error messages
3. Verify all prerequisites are installed
4. Ensure proper network permissions

The system is now ready to provide real-time cybersecurity monitoring with ML-powered threat detection and email alerting!