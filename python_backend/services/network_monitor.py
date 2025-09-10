"""
Network Monitor Service
Monitors network traffic and captures packets for threat analysis
"""

import os
import logging
import threading
import time
import subprocess
import json
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

class NetworkMonitor:
    def __init__(self):
        self.is_monitoring = False
        self.interfaces = os.getenv('NETWORK_INTERFACES', 'eth0,wlan0').split(',')
        self.interfaces = [iface.strip() for iface in self.interfaces]
        self.packet_handler = None
        self.monitor_threads = []
        self.packet_buffer = []
        self.buffer_size = 1000
        self.scan_interval = int(os.getenv('SCAN_INTERVAL', 5))
        
        logger.info(f"NetworkMonitor initialized for interfaces: {self.interfaces}")

    def is_available(self):
        """Check if network monitoring is available"""
        try:
            # Check if tcpdump is available
            result = subprocess.run(['which', 'tcpdump'], capture_output=True, text=True)
            if result.returncode != 0:
                logger.warning("tcpdump not found - network monitoring not available")
                return False
            
            # Check if we have permission (this would need to be run with sudo)
            return True
        except Exception as e:
            logger.error(f"Error checking network monitor availability: {e}")
            return False

    def set_packet_handler(self, handler):
        """Set the packet handler function"""
        self.packet_handler = handler

    def start_monitoring(self):
        """Start network monitoring"""
        if self.is_monitoring:
            logger.info("Network monitoring already active")
            return
        
        if not self.is_available():
            logger.error("Network monitoring not available")
            return
        
        logger.info(f"Starting network monitoring on interfaces: {self.interfaces}")
        self.is_monitoring = True
        
        # Start monitoring thread for each interface
        for interface in self.interfaces:
            thread = threading.Thread(
                target=self.monitor_interface,
                args=(interface,),
                daemon=True
            )
            thread.start()
            self.monitor_threads.append(thread)
        
        logger.info("Network monitoring started")

    def stop_monitoring(self):
        """Stop network monitoring"""
        if not self.is_monitoring:
            return
        
        logger.info("Stopping network monitoring")
        self.is_monitoring = False
        
        # Wait for threads to finish
        for thread in self.monitor_threads:
            if thread.is_alive():
                thread.join(timeout=2)
        
        self.monitor_threads.clear()
        logger.info("Network monitoring stopped")

    def monitor_interface(self, interface):
        """Monitor a specific network interface"""
        try:
            logger.info(f"Starting monitoring on interface: {interface}")
            
            # Use tcpdump to capture packets
            cmd = [
                'tcpdump',
                '-i', interface,
                '-n',  # Don't resolve hostnames
                '-t',  # Don't print timestamps
                '-l',  # Line buffered output
                '-c', '0',  # Capture indefinitely
                'tcp or udp or icmp'
            ]
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            
            while self.is_monitoring:
                try:
                    line = process.stdout.readline()
                    if line:
                        packet = self.parse_packet_line(line.strip(), interface)
                        if packet:
                            self.handle_packet(packet)
                    else:
                        time.sleep(0.1)
                except Exception as e:
                    logger.error(f"Error reading packet on {interface}: {e}")
                    break
            
            # Terminate process
            process.terminate()
            process.wait()
            
        except Exception as e:
            logger.error(f"Error monitoring interface {interface}: {e}")

    def parse_packet_line(self, line, interface):
        """Parse tcpdump output line into packet data"""
        try:
            # Example tcpdump output:
            # IP 192.168.1.100.52345 > 8.8.8.8.53: UDP, length 32
            
            if not line.startswith('IP '):
                return None
            
            # Extract IP addresses and ports
            parts = line.split()
            if len(parts) < 6:
                return None
            
            # Parse source and destination
            src_dst = parts[1]  # "192.168.1.100.52345"
            arrow = parts[2]    # ">"
            dst_part = parts[3].rstrip(':')  # "8.8.8.8.53"
            protocol = parts[4] if len(parts) > 4 else "Unknown"
            
            # Extract source IP and port
            src_parts = src_dst.rsplit('.', 1)
            if len(src_parts) == 2:
                source_ip = src_parts[0]
                source_port = int(src_parts[1]) if src_parts[1].isdigit() else 0
            else:
                source_ip = src_dst
                source_port = 0
            
            # Extract destination IP and port
            dst_parts = dst_part.rsplit('.', 1)
            if len(dst_parts) == 2:
                dest_ip = dst_parts[0]
                dest_port = int(dst_parts[1]) if dst_parts[1].isdigit() else 0
            else:
                dest_ip = dst_part
                dest_port = 0
            
            # Extract packet size
            packet_size = 0
            for i, part in enumerate(parts):
                if part == 'length' and i + 1 < len(parts):
                    try:
                        packet_size = int(parts[i + 1])
                    except:
                        pass
                    break
            
            packet = {
                'id': str(uuid.uuid4()),
                'timestamp': datetime.now().isoformat(),
                'sourceIP': source_ip,
                'sourcePort': source_port,
                'destinationIP': dest_ip,
                'destinationPort': dest_port,
                'protocol': protocol.lower(),
                'packetSize': packet_size,
                'networkInterface': interface,
                'rawLine': line
            }
            
            return packet
            
        except Exception as e:
            logger.error(f"Error parsing packet line: {e}")
            return None

    def handle_packet(self, packet):
        """Handle captured packet"""
        try:
            # Add to buffer
            self.packet_buffer.append(packet)
            
            # Keep buffer size manageable
            if len(self.packet_buffer) > self.buffer_size:
                self.packet_buffer.pop(0)
            
            # Call packet handler if set
            if self.packet_handler:
                self.packet_handler(packet)
                
        except Exception as e:
            logger.error(f"Error handling packet: {e}")

    def get_recent_packets(self, count=100):
        """Get recent packets from buffer"""
        return self.packet_buffer[-count:] if self.packet_buffer else []

    def get_metrics(self):
        """Get network metrics"""
        try:
            # Generate metrics from packet buffer
            now = datetime.now()
            metrics = []
            
            # Create 30 minutes of metrics (1 per minute)
            for i in range(30, -1, -1):
                timestamp = datetime.fromtimestamp(now.timestamp() - i * 60)
                
                # Filter packets for this minute
                minute_packets = [
                    p for p in self.packet_buffer
                    if abs(datetime.fromisoformat(p['timestamp']).timestamp() - timestamp.timestamp()) < 30
                ]
                
                # Calculate metrics
                inbound_traffic = sum(
                    p.get('packetSize', 0) for p in minute_packets
                    if self.is_inbound_traffic(p)
                ) // 1024  # Convert to KB
                
                outbound_traffic = sum(
                    p.get('packetSize', 0) for p in minute_packets
                    if self.is_outbound_traffic(p)
                ) // 1024  # Convert to KB
                
                metrics.append({
                    'timestamp': timestamp.isoformat(),
                    'inboundTraffic': inbound_traffic,
                    'outboundTraffic': outbound_traffic,
                    'suspiciousConnections': len(minute_packets) // 10,  # Placeholder
                    'blockedAttempts': len(minute_packets) // 20  # Placeholder
                })
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error getting network metrics: {e}")
            return []

    def is_inbound_traffic(self, packet):
        """Check if packet is inbound traffic"""
        dest_ip = packet.get('destinationIP', '')
        return (dest_ip.startswith('192.168.') or 
                dest_ip.startswith('10.') or 
                any(dest_ip.startswith(f'172.{i}.') for i in range(16, 32)))

    def is_outbound_traffic(self, packet):
        """Check if packet is outbound traffic"""
        source_ip = packet.get('sourceIP', '')
        return (source_ip.startswith('192.168.') or 
                source_ip.startswith('10.') or 
                any(source_ip.startswith(f'172.{i}.') for i in range(16, 32)))

    def get_packet_stats(self):
        """Get packet statistics"""
        try:
            stats = {
                'totalPackets': len(self.packet_buffer),
                'protocols': {},
                'topSources': {},
                'topDestinations': {},
                'interfaces': {}
            }
            
            for packet in self.packet_buffer:
                # Protocol stats
                protocol = packet.get('protocol', 'unknown')
                stats['protocols'][protocol] = stats['protocols'].get(protocol, 0) + 1
                
                # Source stats
                source = packet.get('sourceIP', 'unknown')
                stats['topSources'][source] = stats['topSources'].get(source, 0) + 1
                
                # Destination stats
                dest = packet.get('destinationIP', 'unknown')
                stats['topDestinations'][dest] = stats['topDestinations'].get(dest, 0) + 1
                
                # Interface stats
                interface = packet.get('networkInterface', 'unknown')
                stats['interfaces'][interface] = stats['interfaces'].get(interface, 0) + 1
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting packet stats: {e}")
            return {
                'totalPackets': 0,
                'protocols': {},
                'topSources': {},
                'topDestinations': {},
                'interfaces': {}
            }