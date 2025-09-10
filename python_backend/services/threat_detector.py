"""
Random Forest Threat Detection Service
Uses scikit-learn Random Forest for network threat classification
"""

import os
import logging
import pandas as pd
import numpy as np
import joblib
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import uuid
import json

logger = logging.getLogger(__name__)

class ThreatDetector:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.label_encoder = None
        self.is_trained = False
        self.model_version = 1
        self.total_samples_trained = 0
        self.last_training_date = None
        self.training_history = []
        self.threat_threshold = float(os.getenv('THREAT_THRESHOLD', 0.7))
        
        # Model and scaler paths
        self.model_path = os.getenv('MODEL_PATH', './models/threat_model.pkl')
        self.scaler_path = os.getenv('SCALER_PATH', './models/feature_scaler.pkl')
        self.metadata_path = './models/model_metadata.json'
        
        # Ensure models directory exists
        os.makedirs('./models', exist_ok=True)
        
        # Initialize label encoder with known threat types
        self.label_encoder = LabelEncoder()
        self.threat_types = ['Normal', 'Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force']
        self.label_encoder.fit(self.threat_types)
        
        logger.info("ThreatDetector initialized")

    def initialize(self):
        """Initialize the threat detector and load existing model"""
        try:
            # Try to load existing model
            if self.load_model():
                logger.info("Existing Random Forest model loaded successfully")
                return True
            else:
                logger.info("No existing model found - ready for initial training")
                return False
        except Exception as e:
            logger.error(f"Error initializing threat detector: {e}")
            return False

    def load_model(self):
        """Load existing model and scaler"""
        try:
            if os.path.exists(self.model_path) and os.path.exists(self.scaler_path):
                # Load model and scaler
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                
                # Load metadata if exists
                self.load_metadata()
                
                self.is_trained = True
                logger.info(f"Model loaded - Version: {self.model_version}, Samples: {self.total_samples_trained}")
                return True
            else:
                logger.info("Model files not found")
                return False
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False

    def save_model(self):
        """Save model and scaler to disk"""
        try:
            # Save model and scaler
            joblib.dump(self.model, self.model_path)
            joblib.dump(self.scaler, self.scaler_path)
            
            # Save metadata
            self.save_metadata()
            
            logger.info(f"Model saved successfully - Version: {self.model_version}")
            return True
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            return False

    def load_metadata(self):
        """Load model metadata"""
        try:
            if os.path.exists(self.metadata_path):
                with open(self.metadata_path, 'r') as f:
                    metadata = json.load(f)
                
                self.model_version = metadata.get('version', 1)
                self.total_samples_trained = metadata.get('totalSamplesTrained', 0)
                self.last_training_date = metadata.get('lastTrainingDate')
                self.training_history = metadata.get('trainingHistory', [])
                
                logger.info("Model metadata loaded")
        except Exception as e:
            logger.error(f"Error loading metadata: {e}")

    def save_metadata(self):
        """Save model metadata"""
        try:
            metadata = {
                'version': self.model_version,
                'lastTrainingDate': self.last_training_date,
                'totalSamplesTrained': self.total_samples_trained,
                'trainingHistory': self.training_history,
                'threatTypes': self.threat_types,
                'features': [
                    'packet_size', 'source_port', 'dest_port', 'protocol',
                    'hour', 'port_category', 'size_category', 'source_ip_type', 'dest_ip_type'
                ]
            }
            
            with open(self.metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info("Model metadata saved")
        except Exception as e:
            logger.error(f"Error saving metadata: {e}")

    def process_csv_file(self, file):
        """Process uploaded CSV file and extract training data"""
        try:
            logger.info("Processing CSV file for training")
            
            # Read CSV file
            df = pd.read_csv(file)
            logger.info(f"CSV loaded with {len(df)} rows and columns: {list(df.columns)}")
            
            # Validate required columns
            required_columns = ['source_ip', 'dest_ip', 'source_port', 'dest_port', 
                              'protocol', 'packet_size', 'duration', 'threat_type']
            
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {missing_columns}")
            
            # Validate threat types
            valid_threats = set(self.threat_types)
            invalid_threats = set(df['threat_type'].unique()) - valid_threats
            if invalid_threats:
                logger.warning(f"Invalid threat types found: {invalid_threats}")
                # Filter out invalid threat types
                df = df[df['threat_type'].isin(valid_threats)]
            
            logger.info(f"Processing {len(df)} valid rows")
            
            # Extract features and labels
            training_data = []
            for _, row in df.iterrows():
                try:
                    features = self.extract_features_from_csv_row(row)
                    label = row['threat_type']
                    
                    # Validate features
                    if len(features) == 9 and not any(np.isnan(features)):
                        training_data.append({
                            'features': features,
                            'label': label,
                            'raw_data': row.to_dict()
                        })
                except Exception as e:
                    logger.warning(f"Error processing row: {e}")
                    continue
            
            logger.info(f"Extracted {len(training_data)} valid training samples")
            return training_data
            
        except Exception as e:
            logger.error(f"Error processing CSV file: {e}")
            raise

    def extract_features_from_csv_row(self, row):
        """Extract 9 numerical features from CSV row"""
        try:
            features = [
                float(row['packet_size']) if pd.notna(row['packet_size']) else 0,  # features_0
                float(row['source_port']) if pd.notna(row['source_port']) else 0,  # features_1
                float(row['dest_port']) if pd.notna(row['dest_port']) else 0,      # features_2
                self.get_protocol_number(row['protocol']),                         # features_3
                self.get_time_features(datetime.now()),                            # features_4
                self.get_port_category(row['dest_port']),                          # features_5
                self.get_packet_size_category(row['packet_size']),                 # features_6
                self.get_ip_type_from_string(row['source_ip']),                    # features_7
                self.get_ip_type_from_string(row['dest_ip'])                       # features_8
            ]
            
            return features
        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            return [0] * 9

    def get_protocol_number(self, protocol):
        """Convert protocol string to number"""
        if pd.isna(protocol):
            return 0
        protocol_map = {'TCP': 6, 'UDP': 17, 'ICMP': 1}
        return protocol_map.get(str(protocol).upper(), 0)

    def get_time_features(self, timestamp):
        """Extract hour from timestamp"""
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        return timestamp.hour

    def get_port_category(self, port):
        """Categorize port number"""
        if pd.isna(port):
            return 0
        port = int(port)
        if port < 1024:
            return 1  # Well-known ports
        elif port < 49152:
            return 2  # Registered ports
        else:
            return 3  # Dynamic/private ports

    def get_packet_size_category(self, size):
        """Categorize packet size"""
        if pd.isna(size):
            return 0
        size = int(size)
        if size < 64:
            return 1
        elif size < 512:
            return 2
        elif size < 1024:
            return 3
        else:
            return 4

    def get_ip_type_from_string(self, ip):
        """Determine if IP is private or public"""
        if pd.isna(ip) or not ip:
            return 0
        
        ip_str = str(ip)
        # Check if IP is private
        if (ip_str.startswith('192.168.') or 
            ip_str.startswith('10.') or 
            any(ip_str.startswith(f'172.{i}.') for i in range(16, 32))):
            return 1  # Private
        else:
            return 2  # Public

    def train_model(self, training_data=None):
        """Train the Random Forest model"""
        try:
            logger.info("=== RANDOM FOREST TRAINING START ===")
            
            # Increment version for new training
            self.model_version += 1
            
            # Get training data
            if training_data is None:
                # Load from database
                from models.database import Database
                db = Database()
                training_data = db.get_all_training_data()
                logger.info(f"Loaded {len(training_data)} samples from database")
            else:
                logger.info(f"Using provided training data: {len(training_data)} samples")
                
                # Save new data to database
                from models.database import Database
                db = Database()
                for sample in training_data:
                    db.save_training_data(sample)
            
            if len(training_data) < 10:
                raise ValueError(f"Insufficient training data. Need at least 10 samples, got {len(training_data)}")
            
            # Prepare features and labels
            X = np.array([sample['features'] for sample in training_data])
            y = np.array([sample['label'] for sample in training_data])
            
            logger.info(f"Features shape: {X.shape}")
            logger.info(f"Labels shape: {y.shape}")
            logger.info(f"Label distribution: {np.unique(y, return_counts=True)}")
            
            # Validate features
            if X.shape[1] != 9:
                raise ValueError(f"Expected 9 features, got {X.shape[1]}")
            
            # Check for NaN values
            if np.isnan(X).any():
                logger.warning("NaN values found in features, replacing with 0")
                X = np.nan_to_num(X)
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
            
            # Scale features
            self.scaler = StandardScaler()
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            logger.info("Features scaled successfully")
            
            # Encode labels
            y_train_encoded = self.label_encoder.transform(y_train)
            y_test_encoded = self.label_encoder.transform(y_test)
            
            # Train Random Forest model
            logger.info("Training Random Forest model...")
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            )
            
            self.model.fit(X_train_scaled, y_train_encoded)
            logger.info("Model training completed")
            
            # Evaluate model
            y_pred = self.model.predict(X_test_scaled)
            accuracy = accuracy_score(y_test_encoded, y_pred)
            
            logger.info(f"Model accuracy: {accuracy:.4f}")
            logger.info("Classification report:")
            logger.info(classification_report(y_test_encoded, y_pred, 
                                           target_names=self.label_encoder.classes_))
            
            # Update training statistics
            self.total_samples_trained += len(training_data)
            self.last_training_date = datetime.now().isoformat()
            self.is_trained = True
            
            # Add to training history
            training_record = {
                'date': self.last_training_date,
                'samples': len(training_data),
                'accuracy': f"{accuracy * 100:.2f}",
                'version': self.model_version
            }
            self.training_history.append(training_record)
            
            # Save model
            self.save_model()
            
            result = {
                'success': True,
                'samplesProcessed': len(training_data),
                'accuracy': f"{accuracy * 100:.2f}",
                'version': self.model_version,
                'epochs': 'N/A (Random Forest)'
            }
            
            logger.info(f"Training completed: {result}")
            logger.info("=== RANDOM FOREST TRAINING END ===")
            
            return result
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            raise

    def analyze_packet(self, packet_data):
        """Analyze network packet for threats"""
        if not self.is_trained or self.model is None:
            logger.warning("Model not trained, cannot analyze packet")
            return {
                'classification': 'Unknown',
                'confidence': 0.5,
                'threat': None,
                'isThreat': False
            }
        
        try:
            # Extract features from packet
            features = self.extract_features_from_packet(packet_data)
            
            # Scale features
            features_scaled = self.scaler.transform([features])
            
            # Make prediction
            prediction = self.model.predict(features_scaled)[0]
            probabilities = self.model.predict_proba(features_scaled)[0]
            
            # Get classification and confidence
            classification = self.label_encoder.inverse_transform([prediction])[0]
            confidence = probabilities[prediction]
            
            # Determine if this is a threat
            is_threat = classification != 'Normal' and confidence > self.threat_threshold
            
            threat = None
            if is_threat:
                threat = self.create_threat_record(packet_data, classification, confidence, features)
            
            return {
                'classification': classification,
                'confidence': float(confidence),
                'threat': threat,
                'isThreat': is_threat
            }
            
        except Exception as e:
            logger.error(f"Error analyzing packet: {e}")
            return {
                'classification': 'Error',
                'confidence': 0,
                'threat': None,
                'isThreat': False
            }

    def extract_features_from_packet(self, packet_data):
        """Extract features from network packet"""
        try:
            features = [
                packet_data.get('packetSize', 0),
                packet_data.get('sourcePort', 0),
                packet_data.get('destinationPort', 0),
                self.get_protocol_number(packet_data.get('protocol', '')),
                self.get_time_features(packet_data.get('timestamp', datetime.now())),
                self.get_port_category(packet_data.get('destinationPort', 0)),
                self.get_packet_size_category(packet_data.get('packetSize', 0)),
                self.get_source_ip_category(packet_data.get('sourceIP', '')),
                self.get_destination_ip_category(packet_data.get('destinationIP', ''))
            ]
            return features
        except Exception as e:
            logger.error(f"Error extracting packet features: {e}")
            return [0] * 9

    def get_source_ip_category(self, ip):
        """Categorize source IP"""
        return self.get_ip_type_from_string(ip)

    def get_destination_ip_category(self, ip):
        """Categorize destination IP"""
        return self.get_ip_type_from_string(ip)

    def create_threat_record(self, packet_data, classification, confidence, features):
        """Create threat record from packet analysis"""
        try:
            threat = {
                'id': str(uuid.uuid4()),
                'timestamp': packet_data.get('timestamp', datetime.now().isoformat()),
                'type': self.get_threat_type(classification),
                'severity': self.get_severity(classification, confidence),
                'source': packet_data.get('sourceIP', 'Unknown'),
                'destination': packet_data.get('destinationIP', 'Unknown'),
                'sourcePort': packet_data.get('sourcePort'),
                'destinationPort': packet_data.get('destinationPort'),
                'protocol': packet_data.get('protocol', 'Unknown'),
                'packetSize': packet_data.get('packetSize'),
                'description': self.get_threat_description(classification, packet_data),
                'classification': classification,
                'confidence': float(confidence),
                'networkInterface': packet_data.get('networkInterface', 'Unknown'),
                'rawPacketData': packet_data,
                'features': features
            }
            return threat
        except Exception as e:
            logger.error(f"Error creating threat record: {e}")
            return None

    def get_threat_type(self, classification):
        """Get human-readable threat type"""
        type_map = {
            'Malware': 'Malware Detection',
            'DDoS': 'DDoS Attack',
            'Intrusion': 'Unauthorized Access',
            'Phishing': 'Phishing Attempt',
            'Port_Scan': 'Port Scanning',
            'Brute_Force': 'Brute Force Attack'
        }
        return type_map.get(classification, 'Unknown Threat')

    def get_severity(self, classification, confidence):
        """Determine threat severity"""
        if confidence > 0.9:
            return 'Critical'
        elif confidence > 0.8:
            return 'High'
        elif confidence > 0.7:
            return 'Medium'
        else:
            return 'Low'

    def get_threat_description(self, classification, packet_data):
        """Generate threat description"""
        source = packet_data.get('sourceIP', 'Unknown')
        destination = packet_data.get('destinationIP', 'Unknown')
        dest_port = packet_data.get('destinationPort', 'N/A')
        
        descriptions = {
            'Malware': f"Malicious activity detected from {source} targeting {destination}",
            'DDoS': f"Potential DDoS attack detected from {source}",
            'Intrusion': f"Unauthorized access attempt from {source} to {destination}:{dest_port}",
            'Phishing': f"Phishing attempt detected from {source}",
            'Port_Scan': f"Port scanning activity detected from {source}",
            'Brute_Force': f"Brute force attack detected against {destination}:{dest_port}"
        }
        return descriptions.get(classification, f"Suspicious {classification.lower()} activity detected")

    def learn_from_detection(self, packet_data, analysis):
        """Learn from high-confidence threat detections"""
        try:
            if analysis['confidence'] > 0.9:
                logger.info(f"Learning from high-confidence {analysis['classification']} detection")
                
                # Prepare training sample
                features = self.extract_features_from_packet(packet_data)
                training_sample = {
                    'features': features,
                    'label': analysis['classification'],
                    'raw_data': {
                        'source_ip': packet_data.get('sourceIP'),
                        'dest_ip': packet_data.get('destinationIP'),
                        'source_port': packet_data.get('sourcePort'),
                        'dest_port': packet_data.get('destinationPort'),
                        'protocol': packet_data.get('protocol'),
                        'packet_size': packet_data.get('packetSize'),
                        'duration': 0,
                        'threat_type': analysis['classification']
                    }
                }
                
                # Save to database for future training
                from models.database import Database
                db = Database()
                db.save_training_data(training_sample, source='live_detection')
                
                logger.info("Added threat to training data for future learning")
                
        except Exception as e:
            logger.error(f"Error learning from detection: {e}")

    def get_model_info(self):
        """Get model information"""
        return {
            'version': self.model_version,
            'lastTrainingDate': self.last_training_date,
            'totalSamplesTrained': self.total_samples_trained,
            'trainingHistory': self.training_history,
            'isModelLoaded': self.is_trained,
            'isScalerLoaded': self.scaler is not None,
            'threatTypes': self.threat_types,
            'modelType': 'Random Forest',
            'threatThreshold': self.threat_threshold
        }

    def is_model_loaded(self):
        """Check if model is loaded and ready"""
        return self.is_trained and self.model is not None and self.scaler is not None