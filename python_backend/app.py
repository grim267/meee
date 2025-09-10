#!/usr/bin/env python3
"""
CyberSecure Hospital Defense System - Python Backend
Main Flask application with Random Forest threat detection
"""

import os
import sys
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
import threading
import time

# Load environment variables
load_dotenv()

# Import our custom modules
from services.threat_detector import ThreatDetector
from services.network_monitor import NetworkMonitor
from services.email_service import EmailService
from services.user_service import UserService
from models.database import Database
from utils.logger import setup_logger

# Setup logging
logger = setup_logger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'cybersecure-hospital-defense-2024')
CORS(app, origins=["http://localhost:5173"])
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:5173"])

# Initialize services
db = Database()
threat_detector = ThreatDetector()
network_monitor = NetworkMonitor()
email_service = EmailService()
user_service = UserService()

# System status
system_status = {
    'isScanning': False,
    'threatsDetected': 0,
    'systemHealth': 'Good',
    'lastUpdate': datetime.now().isoformat(),
    'activeIncidents': 0,
    'modelTrained': False,
    'networkInterfaces': os.getenv('NETWORK_INTERFACES', 'eth0,wlan0').split(','),
    'isTraining': False,
    'modelInfo': {},
    'trainingDataCount': 0
}

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'database': db.is_connected(),
            'model': threat_detector.is_model_loaded(),
            'email': email_service.is_configured(),
            'network': network_monitor.is_available()
        }
    })

# ==================== THREAT MANAGEMENT ====================

@app.route('/api/threats', methods=['GET'])
def get_threats():
    """Get all threats with pagination"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        threats = db.get_threats(page=page, limit=limit)
        return jsonify(threats)
    except Exception as e:
        logger.error(f"Error getting threats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Get all alerts"""
    try:
        alerts = db.get_alerts()
        return jsonify(alerts)
    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alerts/<alert_id>/acknowledge', methods=['POST'])
def acknowledge_alert(alert_id):
    """Acknowledge an alert"""
    try:
        acknowledged_by = request.json.get('acknowledgedBy', 'System')
        result = db.acknowledge_alert(alert_id, acknowledged_by)
        
        if result:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Alert not found'}), 404
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== MODEL TRAINING ====================

@app.route('/api/model/info', methods=['GET'])
def get_model_info():
    """Get model information"""
    try:
        model_info = threat_detector.get_model_info()
        training_data_count = db.get_training_data_count()
        
        return jsonify({
            **model_info,
            'trainingDataCount': training_data_count,
            'isReady': model_info.get('isModelLoaded', False)
        })
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/model/train', methods=['POST'])
def train_model():
    """Train the Random Forest model"""
    if system_status['isTraining']:
        return jsonify({'error': 'Model is already training'}), 400
    
    try:
        system_status['isTraining'] = True
        socketio.emit('training_status', {'status': 'started'})
        
        # Handle file upload
        training_data = None
        if 'file' in request.files:
            file = request.files['file']
            if file and file.filename.endswith('.csv'):
                # Process CSV file
                training_data = threat_detector.process_csv_file(file)
                logger.info(f"Processed CSV file with {len(training_data)} samples")
        
        # Start training in background thread
        def train_in_background():
            try:
                result = threat_detector.train_model(training_data)
                
                # Update system status
                system_status['isTraining'] = False
                system_status['modelTrained'] = True
                system_status['modelInfo'] = threat_detector.get_model_info()
                
                # Record learning session
                db.record_learning_session(
                    session_type='csv_upload' if training_data else 'incremental',
                    samples_added=result.get('samplesProcessed', 0),
                    model_version=result.get('version', 1),
                    accuracy_after=result.get('accuracy', 0),
                    training_source=file.filename if 'file' in request.files else 'database'
                )
                
                socketio.emit('training_status', {'status': 'completed', 'result': result})
                logger.info(f"Training completed: {result}")
                
            except Exception as e:
                system_status['isTraining'] = False
                error_msg = str(e)
                logger.error(f"Training failed: {error_msg}")
                socketio.emit('training_status', {'status': 'failed', 'error': {'error': error_msg}})
        
        # Start training thread
        training_thread = threading.Thread(target=train_in_background)
        training_thread.daemon = True
        training_thread.start()
        
        return jsonify({'success': True, 'message': 'Training started'})
        
    except Exception as e:
        system_status['isTraining'] = False
        logger.error(f"Error starting training: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/model/retrain', methods=['POST'])
def retrain_model():
    """Retrain model with all available data"""
    try:
        if system_status['isTraining']:
            return jsonify({'error': 'Model is already training'}), 400
        
        # Get all training data from database
        all_training_data = db.get_all_training_data()
        
        if len(all_training_data) < 10:
            return jsonify({
                'error': f'Insufficient training data for retraining. Need at least 10 samples, found {len(all_training_data)}.'
            }), 400
        
        # Start retraining
        system_status['isTraining'] = True
        socketio.emit('training_status', {'status': 'started'})
        
        def retrain_in_background():
            try:
                result = threat_detector.train_model(all_training_data)
                
                system_status['isTraining'] = False
                system_status['modelTrained'] = True
                system_status['modelInfo'] = threat_detector.get_model_info()
                
                socketio.emit('training_status', {'status': 'completed', 'result': result})
                logger.info(f"Retraining completed: {result}")
                
            except Exception as e:
                system_status['isTraining'] = False
                error_msg = str(e)
                logger.error(f"Retraining failed: {error_msg}")
                socketio.emit('training_status', {'status': 'failed', 'error': {'error': error_msg}})
        
        training_thread = threading.Thread(target=retrain_in_background)
        training_thread.daemon = True
        training_thread.start()
        
        return jsonify({'success': True, 'message': 'Retraining started'})
        
    except Exception as e:
        logger.error(f"Error starting retraining: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== SYSTEM CONTROL ====================

@app.route('/api/system/start-scan', methods=['POST'])
def start_scanning():
    """Start network scanning"""
    try:
        if not system_status['modelTrained']:
            return jsonify({
                'error': 'Cannot start scanning without a trained model. Please train the model first.'
            }), 400
        
        network_monitor.start_monitoring()
        system_status['isScanning'] = True
        system_status['lastUpdate'] = datetime.now().isoformat()
        
        socketio.emit('system_status', system_status)
        logger.info("Network scanning started")
        
        return jsonify({'success': True, 'message': 'Network scanning started'})
    except Exception as e:
        logger.error(f"Error starting scan: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/stop-scan', methods=['POST'])
def stop_scanning():
    """Stop network scanning"""
    try:
        network_monitor.stop_monitoring()
        system_status['isScanning'] = False
        system_status['lastUpdate'] = datetime.now().isoformat()
        
        socketio.emit('system_status', system_status)
        logger.info("Network scanning stopped")
        
        return jsonify({'success': True, 'message': 'Network scanning stopped'})
    except Exception as e:
        logger.error(f"Error stopping scan: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/status', methods=['GET'])
def get_system_status():
    """Get current system status"""
    try:
        # Update status with current data
        system_status['threatsDetected'] = db.get_threat_count()
        system_status['activeIncidents'] = db.get_active_incident_count()
        system_status['trainingDataCount'] = db.get_training_data_count()
        system_status['modelInfo'] = threat_detector.get_model_info()
        system_status['lastUpdate'] = datetime.now().isoformat()
        
        return jsonify(system_status)
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== USER MANAGEMENT ====================

@app.route('/api/users', methods=['GET'])
def get_users():
    """Get all users"""
    try:
        users = user_service.get_all_users()
        return jsonify(users)
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.get_json()
        logger.info(f"Creating user with data: {data}")
        
        # Validate required fields
        if not data.get('email') or not data.get('name'):
            return jsonify({'error': 'Email and name are required'}), 400
        
        # Create user
        result = user_service.create_user(data)
        
        if result['success']:
            logger.info(f"User created successfully: {result['user']['id']}")
            return jsonify(result)
        else:
            logger.error(f"User creation failed: {result['error']}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'details': 'Server error during user creation'
        }), 500

@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    """Update a user"""
    try:
        data = request.get_json()
        logger.info(f"Updating user {user_id} with data: {data}")
        
        result = user_service.update_user(user_id, data)
        
        if result['success']:
            logger.info(f"User updated successfully: {user_id}")
            return jsonify(result)
        else:
            logger.error(f"User update failed: {result['error']}")
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'details': 'Server error during user update'
        }), 500

@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user"""
    try:
        logger.info(f"Deleting user: {user_id}")
        
        result = user_service.delete_user(user_id)
        
        if result['success']:
            logger.info(f"User deleted successfully: {user_id}")
            return jsonify(result)
        else:
            logger.error(f"User deletion failed: {result['error']}")
            return jsonify(result), 404
            
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== EMAIL SYSTEM ====================

@app.route('/api/email/test', methods=['POST'])
def test_email():
    """Test email configuration"""
    try:
        result = email_service.test_configuration()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error testing email: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/email/send-test-threat', methods=['POST'])
def send_test_threat_alert():
    """Send a test threat alert email"""
    try:
        # Create mock threat for testing
        mock_threat = {
            'id': 'test-threat-' + str(int(time.time())),
            'timestamp': datetime.now().isoformat(),
            'type': 'Test Threat Alert',
            'severity': 'Medium',
            'source': '192.168.1.100',
            'destination': '8.8.8.8',
            'sourcePort': 12345,
            'destinationPort': 80,
            'protocol': 'tcp',
            'packetSize': 1024,
            'description': 'This is a test threat alert to verify the email system is working correctly.',
            'classification': 'Test',
            'confidence': 0.85,
            'networkInterface': 'eth0',
            'location': 'Test Environment'
        }
        
        result = email_service.send_threat_alert(mock_threat)
        return jsonify({
            'success': result,
            'message': 'Test threat alert sent' if result else 'Failed to send test alert'
        })
    except Exception as e:
        logger.error(f"Error sending test threat alert: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/email/configure', methods=['POST'])
def configure_email():
    """Configure email settings"""
    try:
        data = request.get_json()
        result = email_service.configure(data)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error configuring email: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/email/settings', methods=['GET'])
def get_email_settings():
    """Get current email settings"""
    try:
        settings = email_service.get_settings()
        return jsonify(settings)
    except Exception as e:
        logger.error(f"Error getting email settings: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== NETWORK METRICS ====================

@app.route('/api/metrics/network', methods=['GET'])
def get_network_metrics():
    """Get network metrics"""
    try:
        metrics = network_monitor.get_metrics()
        return jsonify(metrics)
    except Exception as e:
        logger.error(f"Error getting network metrics: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== WEBSOCKET EVENTS ====================

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('system_status', system_status)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")

# ==================== EVENT HANDLERS ====================

def handle_packet_captured(packet_data):
    """Handle captured network packet"""
    try:
        # Analyze packet with ML model
        analysis = threat_detector.analyze_packet(packet_data)
        
        if analysis['isThreat'] and analysis['threat']:
            # Update system status
            system_status['threatsDetected'] += 1
            system_status['activeIncidents'] += 1
            system_status['lastUpdate'] = datetime.now().isoformat()
            
            # Save threat to database
            threat_id = db.save_threat(analysis['threat'])
            
            # Create alert for high/critical threats
            if analysis['threat']['severity'] in ['Critical', 'High']:
                alert_id = db.create_alert(threat_id, analysis['threat'])
                
                # Send email alert
                email_sent = email_service.send_threat_alert(analysis['threat'])
                if email_sent:
                    db.mark_alert_email_sent(alert_id)
                
                socketio.emit('new_alert', {
                    'id': alert_id,
                    'threat': analysis['threat'],
                    'timestamp': datetime.now().isoformat(),
                    'acknowledged': False
                })
            
            # Emit threat to connected clients
            socketio.emit('new_threat', analysis['threat'])
            socketio.emit('system_status', system_status)
            
            # Learn from high-confidence detections
            if analysis['confidence'] > 0.9:
                threat_detector.learn_from_detection(packet_data, analysis)
                
    except Exception as e:
        logger.error(f"Error handling packet: {e}")

# ==================== INITIALIZATION ====================

def initialize_system():
    """Initialize the system on startup"""
    try:
        logger.info("Initializing CyberSecure Hospital Defense System...")
        
        # Initialize database
        db.initialize()
        
        # Create default admin user if none exists
        admin_count = user_service.get_admin_count()
        if admin_count == 0:
            logger.info("Creating default admin user...")
            default_admin = {
                'email': os.getenv('DEFAULT_ADMIN_EMAIL', 'admin@hospital.com'),
                'name': os.getenv('DEFAULT_ADMIN_NAME', 'System Administrator'),
                'role': 'admin',
                'alertPreferences': {
                    'emailEnabled': True,
                    'severityLevels': ['Critical', 'High', 'Medium', 'Low'],
                    'threatTypes': ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'],
                    'immediateAlert': True,
                    'dailySummary': True,
                    'weeklySummary': False
                }
            }
            
            result = user_service.create_user(default_admin)
            if result['success']:
                logger.info(f"Created default admin user: {result['user']['email']}")
            else:
                logger.error(f"Failed to create default admin: {result['error']}")
        
        # Initialize threat detector
        model_loaded = threat_detector.initialize()
        system_status['modelTrained'] = model_loaded
        
        if model_loaded:
            logger.info("Threat detection model loaded successfully")
        else:
            logger.info("No trained model found - ready for initial training")
        
        # Initialize network monitor
        network_monitor.set_packet_handler(handle_packet_captured)
        
        # Update system status
        system_status['threatsDetected'] = db.get_threat_count()
        system_status['activeIncidents'] = db.get_active_incident_count()
        system_status['trainingDataCount'] = db.get_training_data_count()
        system_status['modelInfo'] = threat_detector.get_model_info()
        
        logger.info("System initialized successfully")
        logger.info(f"Network interfaces: {system_status['networkInterfaces']}")
        logger.info(f"Email alerts configured: {'Yes' if email_service.is_configured() else 'No'}")
        
    except Exception as e:
        logger.error(f"Error initializing system: {e}")
        sys.exit(1)

def cleanup_system():
    """Cleanup system resources"""
    logger.info("Shutting down system...")
    network_monitor.stop_monitoring()
    email_service.cleanup()
    logger.info("System shutdown complete")

if __name__ == '__main__':
    try:
        # Initialize system
        initialize_system()
        
        # Start Flask-SocketIO server
        port = int(os.getenv('FLASK_PORT', 3001))
        logger.info(f"Starting server on port {port}")
        
        socketio.run(
            app,
            host='0.0.0.0',
            port=port,
            debug=os.getenv('FLASK_ENV') == 'development',
            allow_unsafe_werkzeug=True
        )
        
    except KeyboardInterrupt:
        cleanup_system()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        cleanup_system()
        sys.exit(1)