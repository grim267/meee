#!/bin/bash

# CyberSecure Hospital Defense System - Python Backend Startup Script

echo "🛡️  Starting CyberSecure Hospital Defense System (Python Backend)"
echo "=================================================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ This script must be run as root (sudo)${NC}"
    echo -e "${YELLOW}   Network packet capture requires root privileges${NC}"
    echo -e "${BLUE}   Usage: sudo ./start.sh${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo -e "${YELLOW}   Please copy .env.example to .env and configure it${NC}"
    exit 1
fi

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${BLUE}🐍 Python version: $python_version${NC}"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found, creating one...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/upgrade requirements
echo -e "${BLUE}📦 Installing/updating Python packages...${NC}"
pip install -r requirements.txt

# Check if tcpdump is available
if ! command -v tcpdump &> /dev/null; then
    echo -e "${RED}❌ tcpdump not found${NC}"
    echo -e "${YELLOW}   Please install tcpdump:${NC}"
    echo -e "${BLUE}   Ubuntu/Debian: sudo apt install tcpdump${NC}"
    echo -e "${BLUE}   CentOS/RHEL: sudo yum install tcpdump${NC}"
    echo -e "${BLUE}   macOS: brew install tcpdump${NC}"
    exit 1
fi

# Load environment variables
source .env

# Check network interfaces
echo -e "${BLUE}📡 Checking network interfaces...${NC}"
IFS=',' read -ra INTERFACES <<< "$NETWORK_INTERFACES"
for interface in "${INTERFACES[@]}"; do
    if ip link show "$interface" &> /dev/null; then
        echo -e "${GREEN}✅ Interface $interface found${NC}"
    else
        echo -e "${YELLOW}⚠️  Interface $interface not found${NC}"
        echo -e "${BLUE}   Available interfaces:${NC}"
        ip link show | grep -E "^[0-9]+:" | cut -d: -f2 | sed 's/^ */   /'
    fi
done

# Create logs directory
mkdir -p logs

# Start the Python backend server
echo -e "${GREEN}🚀 Starting Python backend server...${NC}"
echo -e "${BLUE}   Server will run on port ${FLASK_PORT:-3001}${NC}"
echo -e "${BLUE}   Logs will be saved to logs/cybersecure.log${NC}"
echo -e "${BLUE}   Press Ctrl+C to stop the system${NC}"
echo ""

# Start server with logging
python run.py 2>&1 | tee logs/cybersecure.log