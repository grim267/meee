"""
Database Service
Handles all database operations using Supabase
"""

import os
import logging
from datetime import datetime
import json
from supabase import create_client, Client

logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            logger.error("Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_KEY")
            raise ValueError("Missing Supabase configuration")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        logger.info("Database service initialized")

    def initialize(self):
        """Initialize database connection and test it"""
        try:
            # Test connection
            result = self.supabase.table('users').select('count', count='exact').execute()
            logger.info("✅ Database connected successfully")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return False

    def is_connected(self):
        """Check if database is connected"""
        try:
            self.supabase.table('users').select('count', count='exact').execute()
            return True
        except:
            return False

    # ==================== USER MANAGEMENT ====================

    def get_all_users(self):
        """Get all users"""
        try:
            result = self.supabase.table('users').select('*').order('created_at', desc=False).execute()
            return result.data
        except Exception as e:
            logger.error(f"Error getting all users: {e}")
            raise

    def get_user_by_id(self, user_id):
        """Get user by ID"""
        try:
            result = self.supabase.table('users').select('*').eq('id', user_id).single().execute()
            return result.data
        except Exception as e:
            if 'PGRST116' in str(e):  # Not found
                return None
            logger.error(f"Error getting user by ID: {e}")
            raise

    def get_user_by_email(self, email):
        """Get user by email"""
        try:
            result = self.supabase.table('users').select('*').eq('email', email).single().execute()
            return result.data
        except Exception as e:
            if 'PGRST116' in str(e):  # Not found
                return None
            logger.error(f"Error getting user by email: {e}")
            return None

    def create_user(self, user_data):
        """Create a new user"""
        try:
            logger.info(f"Creating user in database: {user_data['email']}")
            result = self.supabase.table('users').insert(user_data).select().single().execute()
            logger.info(f"User created successfully: {result.data['id']}")
            return result.data
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise

    def update_user(self, user_id, updates):
        """Update a user"""
        try:
            logger.info(f"Updating user in database: {user_id}")
            result = self.supabase.table('users').update(updates).eq('id', user_id).select().single().execute()
            logger.info(f"User updated successfully: {user_id}")
            return result.data
        except Exception as e:
            logger.error(f"Error updating user: {e}")
            raise

    def delete_user(self, user_id):
        """Delete a user"""
        try:
            logger.info(f"Deleting user from database: {user_id}")
            self.supabase.table('users').delete().eq('id', user_id).execute()
            logger.info(f"User deleted successfully: {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting user: {e}")
            return False

    def get_user_count_by_role(self, role):
        """Get count of users by role"""
        try:
            result = self.supabase.table('users').select('count', count='exact').eq('role', role).execute()
            return result.count
        except Exception as e:
            logger.error(f"Error getting user count by role: {e}")
            return 0

    # ==================== THREAT MANAGEMENT ====================

    def get_threats(self, page=1, limit=50):
        """Get threats with pagination"""
        try:
            offset = (page - 1) * limit
            result = self.supabase.table('threats').select('*').order('timestamp', desc=True).range(offset, offset + limit - 1).execute()
            return result.data
        except Exception as e:
            logger.error(f"Error getting threats: {e}")
            return []

    def save_threat(self, threat_data):
        """Save threat to database"""
        try:
            # Convert threat data to database format
            db_threat = {
                'id': threat_data['id'],
                'timestamp': threat_data['timestamp'],
                'type': threat_data['type'],
                'severity': threat_data['severity'].lower(),
                'source_ip': threat_data['source'],
                'target_ip': threat_data['destination'],
                'description': threat_data['description'],
                'status': 'active',
                'metadata': {
                    'sourcePort': threat_data.get('sourcePort'),
                    'destinationPort': threat_data.get('destinationPort'),
                    'protocol': threat_data.get('protocol'),
                    'packetSize': threat_data.get('packetSize'),
                    'classification': threat_data.get('classification'),
                    'confidence': threat_data.get('confidence'),
                    'networkInterface': threat_data.get('networkInterface'),
                    'features': threat_data.get('features')
                }
            }
            
            result = self.supabase.table('threats').insert(db_threat).select().single().execute()
            return result.data['id']
        except Exception as e:
            logger.error(f"Error saving threat: {e}")
            return None

    def get_threat_count(self):
        """Get total threat count"""
        try:
            result = self.supabase.table('threats').select('count', count='exact').execute()
            return result.count
        except Exception as e:
            logger.error(f"Error getting threat count: {e}")
            return 0

    def get_active_incident_count(self):
        """Get active incident count"""
        try:
            result = self.supabase.table('threats').select('count', count='exact').eq('status', 'active').execute()
            return result.count
        except Exception as e:
            logger.error(f"Error getting active incident count: {e}")
            return 0

    # ==================== ALERT MANAGEMENT ====================

    def get_alerts(self):
        """Get all alerts"""
        try:
            result = self.supabase.table('alerts').select('*').order('timestamp', desc=True).limit(100).execute()
            return result.data
        except Exception as e:
            logger.error(f"Error getting alerts: {e}")
            return []

    def create_alert(self, threat_id, threat_data):
        """Create an alert for a threat"""
        try:
            alert_data = {
                'id': f"alert-{threat_id}",
                'threat_id': threat_id,
                'threat_data': threat_data,
                'timestamp': datetime.now().isoformat(),
                'acknowledged': False,
                'email_sent': False
            }
            
            result = self.supabase.table('alerts').insert(alert_data).select().single().execute()
            return result.data['id']
        except Exception as e:
            logger.error(f"Error creating alert: {e}")
            return None

    def acknowledge_alert(self, alert_id, acknowledged_by):
        """Acknowledge an alert"""
        try:
            updates = {
                'acknowledged': True,
                'acknowledged_by': acknowledged_by,
                'acknowledged_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table('alerts').update(updates).eq('id', alert_id).execute()
            return len(result.data) > 0
        except Exception as e:
            logger.error(f"Error acknowledging alert: {e}")
            return False

    def mark_alert_email_sent(self, alert_id):
        """Mark alert as email sent"""
        try:
            self.supabase.table('alerts').update({'email_sent': True}).eq('id', alert_id).execute()
        except Exception as e:
            logger.error(f"Error marking alert email sent: {e}")

    # ==================== TRAINING DATA MANAGEMENT ====================

    def save_training_data(self, training_sample, source='manual'):
        """Save training data to database"""
        try:
            raw_data = training_sample.get('raw_data', {})
            
            training_record = {
                'id': f"training-{datetime.now().timestamp()}",
                'source_ip': raw_data.get('source_ip', ''),
                'dest_ip': raw_data.get('dest_ip', ''),
                'source_port': raw_data.get('source_port', 0),
                'dest_port': raw_data.get('dest_port', 0),
                'protocol': raw_data.get('protocol', ''),
                'packet_size': raw_data.get('packet_size', 0),
                'duration': raw_data.get('duration', 0),
                'threat_type': training_sample['label'],
                'processed_features': training_sample['features'],
                'source': source,
                'validated': False,
                'created_at': datetime.now().isoformat()
            }
            
            self.supabase.table('training_data').insert(training_record).execute()
            logger.info(f"Training data saved: {training_sample['label']}")
            
        except Exception as e:
            logger.error(f"Error saving training data: {e}")

    def get_all_training_data(self):
        """Get all training data"""
        try:
            result = self.supabase.table('training_data').select('*').order('created_at', desc=False).execute()
            
            # Convert to format expected by ML model
            training_data = []
            for record in result.data:
                training_data.append({
                    'features': record['processed_features'],
                    'label': record['threat_type'],
                    'raw_data': {
                        'source_ip': record['source_ip'],
                        'dest_ip': record['dest_ip'],
                        'source_port': record['source_port'],
                        'dest_port': record['dest_port'],
                        'protocol': record['protocol'],
                        'packet_size': record['packet_size'],
                        'duration': record['duration'],
                        'threat_type': record['threat_type']
                    }
                })
            
            return training_data
        except Exception as e:
            logger.error(f"Error getting training data: {e}")
            return []

    def get_training_data_count(self):
        """Get training data count"""
        try:
            result = self.supabase.table('training_data').select('count', count='exact').execute()
            return result.count
        except Exception as e:
            logger.error(f"Error getting training data count: {e}")
            return 0

    # ==================== LEARNING SESSIONS ====================

    def record_learning_session(self, session_type, samples_added, model_version, accuracy_after, training_source):
        """Record a learning session"""
        try:
            session_data = {
                'session_type': session_type,
                'samples_added': samples_added,
                'model_version': model_version,
                'accuracy_after': accuracy_after,
                'training_source': training_source,
                'session_data': {
                    'timestamp': datetime.now().isoformat(),
                    'samples_processed': samples_added
                },
                'created_at': datetime.now().isoformat()
            }
            
            self.supabase.table('learning_sessions').insert(session_data).execute()
            logger.info(f"Learning session recorded: {session_type}")
            
        except Exception as e:
            logger.error(f"Error recording learning session: {e}")

    def get_learning_sessions(self):
        """Get all learning sessions"""
        try:
            result = self.supabase.table('learning_sessions').select('*').order('created_at', desc=True).execute()
            return result.data
        except Exception as e:
            logger.error(f"Error getting learning sessions: {e}")
            return []