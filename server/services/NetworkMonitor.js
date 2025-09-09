const { spawn } = require('child_process');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class NetworkMonitor extends EventEmitter {
  constructor(interfaces = ['eth0', 'wlan0']) {
    super();
    this.interfaces = interfaces;
    this.isMonitoring = false;
    this.processes = new Map();
    this.packetBuffer = [];
    this.bufferSize = 1000;
  }

  start() {
    if (this.isMonitoring) {
      console.log('Network monitoring already active');
      return;
    }

    console.log('Starting network monitoring on interfaces:', this.interfaces);
    this.isMonitoring = true;

    this.interfaces.forEach(iface => {
      this.startInterfaceMonitoring(iface);
    });

    this.emit('monitoring_started');
  }

  stop() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Stopping network monitoring');
    this.isMonitoring = false;

    // Kill all tcpdump processes
    this.processes.forEach((process, iface) => {
      console.log(`Stopping monitoring on ${iface}`);
      process.kill('SIGTERM');
    });

    this.processes.clear();
    this.emit('monitoring_stopped');
  }

  startInterfaceMonitoring(iface) {
    try {
      // Use tcpdump to capture packets
      const tcpdump = spawn('tcpdump', [
        '-i', iface,
        '-n', // Don't resolve hostnames
        '-t', // Don't print timestamps
        '-l', // Line buffered output
        '-c', '0', // Capture indefinitely
        'tcp or udp or icmp'
      ]);

      this.processes.set(iface, tcpdump);

      tcpdump.stdout.on('data', (data) => {
        this.processPacketData(data.toString(), iface);
      });

      tcpdump.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('listening on')) {
          console.error(`tcpdump error on ${iface}:`, error);
        }
      });

      tcpdump.on('close', (code) => {
        console.log(`tcpdump process for ${iface} exited with code ${code}`);
        this.processes.delete(iface);
        
        // Restart if monitoring is still active
        if (this.isMonitoring) {
          setTimeout(() => {
            this.startInterfaceMonitoring(iface);
          }, 5000);
        }
      });

      tcpdump.on('error', (error) => {
        console.error(`Failed to start tcpdump on ${iface}:`, error);
        this.emit('interface_error', { interface: iface, error: error.message });
      });

      console.log(`Started monitoring on interface: ${iface}`);

    } catch (error) {
      console.error(`Error starting monitoring on ${iface}:`, error);
      this.emit('interface_error', { interface: iface, error: error.message });
    }
  }

  processPacketData(data, networkInterface) {
    const lines = data.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      try {
        const packet = this.parsePacketLine(line, networkInterface);
        if (packet) {
          this.packetBuffer.push(packet);
          
          // Keep buffer size manageable
          if (this.packetBuffer.length > this.bufferSize) {
            this.packetBuffer.shift();
          }

          this.emit('packet_captured', packet);
        }
      } catch (error) {
        console.error('Error parsing packet:', error);
      }
    });
  }

  parsePacketLine(line, networkInterface) {
    // Parse tcpdump output format
    // Example: "IP 192.168.1.100.52345 > 8.8.8.8.53: UDP, length 32"
    
    const ipMatch = line.match(/IP\s+(\d+\.\d+\.\d+\.\d+)\.(\d+)\s+>\s+(\d+\.\d+\.\d+\.\d+)\.(\d+):\s+(\w+).*length\s+(\d+)/);
    
    if (ipMatch) {
      const [, sourceIP, sourcePort, destIP, destPort, protocol, length] = ipMatch;
      
      return {
        id: uuidv4(),
        timestamp: new Date(),
        sourceIP,
        sourcePort: parseInt(sourcePort),
        destinationIP: destIP,
        destinationPort: parseInt(destPort),
        protocol: protocol.toLowerCase(),
        packetSize: parseInt(length),
        networkInterface,
        rawLine: line
      };
    }

    return null;
  }

  getRecentPackets(count = 100) {
    return this.packetBuffer.slice(-count);
  }

  getPacketStats() {
    const stats = {
      totalPackets: this.packetBuffer.length,
      protocols: {},
      topSources: {},
      topDestinations: {},
      interfaces: {}
    };

    this.packetBuffer.forEach(packet => {
      // Protocol stats
      stats.protocols[packet.protocol] = (stats.protocols[packet.protocol] || 0) + 1;
      
      // Source stats
      stats.topSources[packet.sourceIP] = (stats.topSources[packet.sourceIP] || 0) + 1;
      
      // Destination stats
      stats.topDestinations[packet.destinationIP] = (stats.topDestinations[packet.destinationIP] || 0) + 1;
      
      // Interface stats
      stats.interfaces[packet.networkInterface] = (stats.interfaces[packet.networkInterface] || 0) + 1;
    });

    return stats;
  }
}

module.exports = NetworkMonitor;