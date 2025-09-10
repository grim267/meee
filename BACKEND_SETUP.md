# 🚀 Backend Setup and Run Guide

## 📋 Prerequisites

### System Requirements
- **Node.js 16+** (check with `node --version`)
- **NPM** (check with `npm --version`)
- **Root/sudo access** (required for network packet capture)
- **tcpdump** (network packet analyzer)
- **Supabase account** (for database)

### Install System Dependencies

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install tcpdump nodejs npm build-essential
```

#### CentOS/RHEL:
```bash
sudo yum install tcpdump nodejs npm gcc-c++ make
```

#### macOS:
```bash
brew install tcpdump node
```

## 🔧 Setup Steps

### 1. Navigate to Server Directory
```bash
cd server
```

### 2. Install Dependencies
```bash
npm install
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
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Email Configuration (REQUIRED for alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Network Interfaces (adjust for your system)
NETWORK_INTERFACES=eth0,wlan0

# System Configuration
NODE_ENV=development
PORT=3001
```

### 4. Check Network Interfaces
```bash
# List available network interfaces
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

## 🚀 Running the Backend

### Method 1: Direct Run (Recommended)
```bash
# From server directory
sudo npm start
```

### Method 2: Using Start Script
```bash
# Make script executable
chmod +x scripts/start-system.sh

# Run the script
sudo ./scripts/start-system.sh
```

### Method 3: Development Mode
```bash
# For development (no network monitoring)
npm run dev
```

## ⚠️ Important Notes

### Why Sudo is Required
- **Network Packet Capture**: The system uses `tcpdump` to monitor network traffic
- **Raw Socket Access**: Requires root privileges to access network interfaces
- **Security**: Only the backend needs sudo, not the frontend

### Checking if Backend is Running
```bash
# Check if server is listening on port 3001
netstat -tlnp | grep 3001

# Check process
ps aux | grep node
```

### Logs and Debugging
```bash
# View real-time logs
tail -f logs/system.log

# Check for errors
grep -i error logs/system.log
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Permission Denied
```bash
# Solution: Run with sudo
sudo npm start
```

#### 2. Network Interface Not Found
```bash
# Check available interfaces
ip link show

# Update .env file with correct interface names
NETWORK_INTERFACES=your-actual-interface-names
```

#### 3. Port Already in Use
```bash
# Find what's using port 3001
sudo lsof -i :3001

# Kill the process
sudo kill -9 <PID>
```

#### 4. Dependencies Missing
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### 5. Supabase Connection Error
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
- Check internet connection
- Ensure Supabase project is active

### System Check Script
```bash
# Run system check to verify setup
node scripts/check-system.js
```

## 📊 Verification

Once the backend is running, you should see:
```
✅ Supabase connected successfully
✅ Email service configured successfully  
🚀 Server running on port 3001
📡 Started monitoring on interface: eth0
📡 Started monitoring on interface: wlan0
```

The backend is now ready to:
- 🔍 Monitor network traffic
- 🧠 Detect threats using ML
- 📧 Send email alerts
- 💾 Store data in Supabase
- 🌐 Serve API endpoints for the frontend

## 🔗 Next Steps

1. **Start Frontend**: In a new terminal, run `npm run dev` from the project root
2. **Open Browser**: Navigate to `http://localhost:5173`
3. **Connect to Supabase**: Click "Connect to Supabase" in the dashboard
4. **Train Model**: Upload training data and train the ML model
5. **Start Monitoring**: Begin real-time threat detection