# Training Data Format Requirements

## 🔍 **What the Model Actually Expects**

Based on the code analysis, here's the exact format the machine learning model requires:

### **1. Database Format (training_data table)**
```sql
CREATE TABLE training_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  features numeric[],  -- Array of 9 numbers
  label text,         -- One of the valid threat types
  source text DEFAULT 'manual',
  validated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### **2. JavaScript Object Format (Internal)**
```javascript
{
  features: [1024, 80, 12345, 6, 14, 1, 3, 2, 1],  // Array of 9 numbers
  label: "Normal"                                    // String label
}
```

### **3. CSV Format Options**

#### **Option A: Feature Columns (Recommended)**
```csv
features_0,features_1,features_2,features_3,features_4,features_5,features_6,features_7,features_8,label
1024,80,12345,6,14,1,3,2,1,Normal
512,443,54321,6,10,1,2,2,1,Normal
```

#### **Option B: Legacy Format**
```csv
packet_size,source_port,dest_port,protocol,hour,port_category,size_category,source_ip_type,dest_ip_type,label
1024,80,12345,6,14,1,3,2,1,Normal
512,443,54321,6,10,1,2,2,1,Normal
```

## 📊 **Feature Definitions**

### **All 9 Features Must Be Present:**

1. **features_0 (packet_size)**: Size of network packet in bytes
   - Range: 1-65535
   - Example: 1024, 512, 64

2. **features_1 (source_port)**: Source port number
   - Range: 1-65535
   - Example: 80, 443, 22

3. **features_2 (dest_port)**: Destination port number
   - Range: 1-65535
   - Example: 12345, 54321, 8080

4. **features_3 (protocol)**: Network protocol as number
   - 6 = TCP
   - 17 = UDP
   - 1 = ICMP

5. **features_4 (hour)**: Hour of day when packet was captured
   - Range: 0-23
   - Example: 14 (2 PM), 2 (2 AM)

6. **features_5 (port_category)**: Port category
   - 1 = Well-known ports (<1024)
   - 2 = Registered ports (1024-49152)
   - 3 = Dynamic/private ports (>49152)

7. **features_6 (size_category)**: Packet size category
   - 1 = Small (<64 bytes)
   - 2 = Medium (64-512 bytes)
   - 3 = Large (512-1024 bytes)
   - 4 = Very large (>1024 bytes)

8. **features_7 (source_ip_type)**: Source IP address type
   - 1 = Private network (192.168.x.x, 10.x.x.x, 172.16.x.x)
   - 2 = Public internet

9. **features_8 (dest_ip_type)**: Destination IP address type
   - 1 = Private network
   - 2 = Public internet

## 🏷️ **Valid Labels**

The model accepts exactly these 7 threat classifications:

- **Normal** - Legitimate network traffic
- **Malware** - Malicious software communication
- **DDoS** - Distributed Denial of Service attack
- **Intrusion** - Unauthorized access attempt
- **Phishing** - Social engineering attack
- **Port_Scan** - Network reconnaissance activity
- **Brute_Force** - Password cracking attempt

## ⚠️ **Critical Requirements**

### **Data Validation Rules:**
1. **Exactly 9 features** per sample (no more, no less)
2. **All features must be numbers** (integers or floats)
3. **Labels must match exactly** (case-sensitive)
4. **No missing values** (use 0 for unknown values)
5. **Minimum 10 samples** required for training

### **Common Errors:**
- ❌ Wrong number of features (8 or 10 instead of 9)
- ❌ Invalid labels ("Malicious" instead of "Malware")
- ❌ Non-numeric features ("tcp" instead of 6)
- ❌ Missing header row in CSV
- ❌ Empty or malformed rows

## 🔄 **Processing Flow**

1. **CSV Upload** → Parse rows and validate format
2. **Feature Extraction** → Convert to numeric array [9 elements]
3. **Label Encoding** → Map string labels to numbers (0-6)
4. **Database Storage** → Save as training_data records
5. **Model Training** → Use features array and encoded labels
6. **Normalization** → Scale features for neural network
7. **Training** → 30 epochs with validation split

## 📝 **Example Valid CSV**

```csv
features_0,features_1,features_2,features_3,features_4,features_5,features_6,features_7,features_8,label
1024,80,12345,6,14,1,3,2,1,Normal
512,443,54321,6,10,1,2,2,1,Normal
256,22,33445,6,9,1,2,2,1,Normal
1024,135,12345,6,2,1,3,2,1,Malware
16,80,12345,6,14,1,1,1,2,DDoS
1024,22,12345,6,8,1,3,1,2,Intrusion
64,80,12345,6,14,1,1,1,2,Port_Scan
128,22,12345,6,2,1,2,1,2,Brute_Force
512,80,12345,6,14,1,2,1,2,Phishing
```

This format ensures the model can successfully train and achieve good accuracy for threat detection!