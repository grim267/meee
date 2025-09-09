# Training Data CSV Format

This CSV file contains network traffic data for training the machine learning threat detection model.

## Column Descriptions

1. **packet_size**: Size of the network packet in bytes
2. **source_port**: Source port number (0-65535)
3. **dest_port**: Destination port number (0-65535)
4. **protocol**: Network protocol (6=TCP, 17=UDP, 1=ICMP)
5. **hour**: Hour of day when packet was captured (0-23)
6. **port_category**: Port category (1=well-known <1024, 2=registered 1024-49152, 3=dynamic >49152)
7. **size_category**: Packet size category (1=<64, 2=64-512, 3=512-1024, 4=>1024)
8. **source_ip_type**: Source IP type (1=private network, 2=public internet)
9. **dest_ip_type**: Destination IP type (1=private network, 2=public internet)
10. **label**: Threat classification

## Threat Labels

- **Normal**: Legitimate network traffic
- **Malware**: Malicious software communication
- **DDoS**: Distributed Denial of Service attack
- **Intrusion**: Unauthorized access attempt
- **Port_Scan**: Network reconnaissance activity
- **Brute_Force**: Password cracking attempt
- **Phishing**: Social engineering attack

## Usage

1. Upload this CSV file through the ML Model tab in the dashboard
2. Click "Train with CSV" to train the model
3. The system will process the data and create a neural network
4. Once trained, the model will classify real network traffic

## Data Patterns

### Normal Traffic
- Standard web browsing (ports 80, 443)
- Email (port 25)
- DNS queries (port 53)
- SSH connections (port 22)
- Regular packet sizes and timing

### Malware Traffic
- Communication with command & control servers
- Unusual ports and protocols
- Often occurs at odd hours
- Suspicious packet patterns

### DDoS Attacks
- High volume of small packets
- Multiple sources targeting same destination
- Concentrated on specific ports (80, 443, 8080)
- Abnormal traffic patterns

### Intrusion Attempts
- Targeting administrative ports (22, 23, 3389, 1433)
- From external sources to internal networks
- Often during off-hours
- Systematic probing patterns

### Port Scanning
- Sequential port access from same source
- Small packet sizes
- Rapid succession of connections
- Targeting multiple ports on same host

### Brute Force Attacks
- Repeated attempts to same service
- Same source/destination pairs
- Targeting authentication services
- Persistent retry patterns

### Phishing
- Web traffic to suspicious domains
- Email-related traffic with unusual patterns
- Often mimics legitimate services
- Unusual timing or frequency

This training data provides a foundation for the ML model to learn and identify these different types of network threats in real-time.