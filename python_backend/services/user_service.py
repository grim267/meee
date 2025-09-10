"""
User Management Service
Handles user creation, updates, and management
"""

import logging
import uuid
from datetime import datetime
from models.database import Database

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self):
        self.db = Database()
        logger.info("UserService initialized")

    def get_all_users(self):
        """Get all users"""
        try:
            users = self.db.get_all_users()
            return [self.format_user_for_api(user) for user in users]
        except Exception as e:
            logger.error(f"Error getting all users: {e}")
            raise

    def create_user(self, user_data):
        """Create a new user"""
        try:
            logger.info(f"Creating user: {user_data}")
            
            # Validate required fields
            if not user_data.get('email') or not user_data.get('name'):
                return {
                    'success': False,
                    'error': 'Email and name are required'
                }
            
            # Check if user already exists
            existing_user = self.db.get_user_by_email(user_data['email'])
            if existing_user:
                return {
                    'success': False,
                    'error': 'User with this email already exists'
                }
            
            # Prepare user data
            user_record = {
                'id': str(uuid.uuid4()),
                'email': user_data['email'],
                'full_name': user_data['name'],
                'username': user_data['email'],  # Use email as username
                'role': self.map_role_to_db(user_data.get('role', 'viewer')),
                'role_level': self.get_role_level(user_data.get('role', 'viewer')),
                'password_hash': '',  # Empty for now, can be set later
                'is_active': user_data.get('isActive', True),
                'alert_preferences': self.prepare_alert_preferences(user_data.get('alertPreferences', {})),
                'failed_login_attempts': 0,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            # Save to database
            created_user = self.db.create_user(user_record)
            
            if created_user:
                logger.info(f"User created successfully: {created_user['id']}")
                return {
                    'success': True,
                    'user': self.format_user_for_api(created_user)
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to create user in database'
                }
                
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return {
                'success': False,
                'error': str(e),
                'details': 'Server error during user creation'
            }

    def update_user(self, user_id, user_data):
        """Update an existing user"""
        try:
            logger.info(f"Updating user {user_id}: {user_data}")
            
            # Get existing user
            existing_user = self.db.get_user_by_id(user_id)
            if not existing_user:
                return {
                    'success': False,
                    'error': 'User not found'
                }
            
            # Prepare update data
            updates = {}
            if 'name' in user_data:
                updates['full_name'] = user_data['name']
            if 'role' in user_data:
                updates['role'] = self.map_role_to_db(user_data['role'])
                updates['role_level'] = self.get_role_level(user_data['role'])
            if 'alertPreferences' in user_data:
                updates['alert_preferences'] = self.prepare_alert_preferences(user_data['alertPreferences'])
            if 'isActive' in user_data:
                updates['is_active'] = user_data['isActive']
            
            updates['updated_at'] = datetime.now().isoformat()
            
            # Update in database
            updated_user = self.db.update_user(user_id, updates)
            
            if updated_user:
                logger.info(f"User updated successfully: {user_id}")
                return {
                    'success': True,
                    'user': self.format_user_for_api(updated_user)
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to update user in database'
                }
                
        except Exception as e:
            logger.error(f"Error updating user: {e}")
            return {
                'success': False,
                'error': str(e),
                'details': 'Server error during user update'
            }

    def delete_user(self, user_id):
        """Delete a user"""
        try:
            logger.info(f"Deleting user: {user_id}")
            
            # Check if user exists
            existing_user = self.db.get_user_by_id(user_id)
            if not existing_user:
                return {
                    'success': False,
                    'error': 'User not found'
                }
            
            # Delete from database
            success = self.db.delete_user(user_id)
            
            if success:
                logger.info(f"User deleted successfully: {user_id}")
                return {
                    'success': True,
                    'message': 'User deleted successfully'
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to delete user from database'
                }
                
        except Exception as e:
            logger.error(f"Error deleting user: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_admin_count(self):
        """Get count of admin users"""
        try:
            return self.db.get_user_count_by_role('security_admin')
        except Exception as e:
            logger.error(f"Error getting admin count: {e}")
            return 0

    def get_users_for_alerts(self, threat_severity, threat_type):
        """Get users who should receive alerts for this threat"""
        try:
            all_users = self.db.get_all_users()
            alert_users = []
            
            for user in all_users:
                if not user.get('is_active', False):
                    continue
                
                alert_prefs = user.get('alert_preferences', {})
                if isinstance(alert_prefs, str):
                    import json
                    try:
                        alert_prefs = json.loads(alert_prefs)
                    except:
                        alert_prefs = {}
                
                # Check if user wants email alerts
                if not alert_prefs.get('emailEnabled', False):
                    continue
                
                # Check severity level
                severity_levels = alert_prefs.get('severityLevels', [])
                if threat_severity not in severity_levels:
                    continue
                
                # Check threat type
                threat_types = alert_prefs.get('threatTypes', [])
                if threat_type not in threat_types:
                    continue
                
                alert_users.append(self.format_user_for_api(user))
            
            return alert_users
            
        except Exception as e:
            logger.error(f"Error getting users for alerts: {e}")
            return []

    def map_role_to_db(self, role):
        """Map frontend role to database role"""
        role_mapping = {
            'admin': 'security_admin',
            'security_analyst': 'security_analyst',
            'it_manager': 'security_manager',
            'viewer': 'security_viewer'
        }
        return role_mapping.get(role, 'security_viewer')

    def map_role_from_db(self, db_role):
        """Map database role to frontend role"""
        role_mapping = {
            'security_admin': 'admin',
            'security_analyst': 'security_analyst',
            'security_manager': 'it_manager',
            'security_viewer': 'viewer'
        }
        return role_mapping.get(db_role, 'viewer')

    def get_role_level(self, role):
        """Get role level for database"""
        role_levels = {
            'admin': 1,
            'security_analyst': 2,
            'it_manager': 3,
            'viewer': 4
        }
        return role_levels.get(role, 4)

    def prepare_alert_preferences(self, alert_prefs):
        """Prepare alert preferences for database storage"""
        default_prefs = {
            'emailEnabled': True,
            'severityLevels': ['Critical', 'High'],
            'threatTypes': ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'],
            'immediateAlert': True,
            'dailySummary': True,
            'weeklySummary': False
        }
        
        # Merge with defaults
        final_prefs = {**default_prefs, **alert_prefs}
        
        # Return as JSON string for database storage
        import json
        return json.dumps(final_prefs)

    def format_user_for_api(self, user):
        """Format user data for API response"""
        try:
            # Parse alert preferences
            alert_prefs = user.get('alert_preferences', '{}')
            if isinstance(alert_prefs, str):
                import json
                try:
                    alert_prefs = json.loads(alert_prefs)
                except:
                    alert_prefs = {
                        'emailEnabled': True,
                        'severityLevels': ['Critical', 'High'],
                        'threatTypes': ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'],
                        'immediateAlert': True,
                        'dailySummary': True,
                        'weeklySummary': False
                    }
            
            return {
                'id': user['id'],
                'email': user['email'],
                'name': user.get('full_name', ''),
                'role': self.map_role_from_db(user.get('role', 'security_viewer')),
                'alertPreferences': alert_prefs,
                'isActive': user.get('is_active', True),
                'lastLogin': user.get('last_login'),
                'createdAt': user.get('created_at'),
                'updatedAt': user.get('updated_at')
            }
        except Exception as e:
            logger.error(f"Error formatting user for API: {e}")
            return {
                'id': user.get('id', ''),
                'email': user.get('email', ''),
                'name': user.get('full_name', ''),
                'role': 'viewer',
                'alertPreferences': {},
                'isActive': True,
                'lastLogin': None,
                'createdAt': None,
                'updatedAt': None
            }