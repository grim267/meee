"""
Email Service for Threat Alerts
Handles email configuration and sending threat notifications
"""

import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import json
import threading
import queue
import time

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', 587))
        self.smtp_user = os.getenv('SMTP_USER', '')
        self.smtp_pass = os.getenv('SMTP_PASS', '')
        self.from_name = os.getenv('SMTP_FROM_NAME', 'CyberSecure Hospital Defense')
        
        self.is_configured_flag = bool(self.smtp_host and self.smtp_user and self.smtp_pass)
        self.email_queue = queue.Queue()
        self.is_processing = False
        
        # Start email processing thread
        if self.is_configured_flag:
            self.start_email_processor()
            logger.info("Email service configured and ready")
        else:
            logger.warning("Email service not configured - missing SMTP credentials")

    def is_configured(self):
        """Check if email service is properly configured"""
        return self.is_configured_flag

    def configure(self, config_data):
        """Configure email settings"""
        try:
            self.smtp_host = config_data.get('smtp_host', self.smtp_host)
            self.smtp_port = int(config_data.get('smtp_port', self.smtp_port))
            self.smtp_user = config_data.get('smtp_user', self.smtp_user)
            self.smtp_pass = config_data.get('smtp_pass', self.smtp_pass)
            self.from_name = config_data.get('from_name', self.from_name)
            
            # Test configuration
            test_result = self.test_smtp_connection()
            
            if test_result['success']:
                self.is_configured_flag = True
                if not self.is_processing:
                    self.start_email_processor()
                logger.info("Email service configured successfully")
                return {'success': True, 'message': 'Email configuration updated successfully'}
            else:
                return {'success': False, 'error': test_result['error']}
                
        except Exception as e:
            logger.error(f"Error configuring email service: {e}")
            return {'success': False, 'error': str(e)}

    def get_settings(self):
        """Get current email settings (without sensitive data)"""
        return {
            'smtp_host': self.smtp_host,
            'smtp_port': self.smtp_port,
            'smtp_user': self.smtp_user,
            'from_name': self.from_name,
            'is_configured': self.is_configured_flag
        }

    def test_configuration(self):
        """Test email configuration"""
        if not self.is_configured_flag:
            return {'success': False, 'error': 'Email service not configured'}
        
        try:
            # Test SMTP connection
            test_result = self.test_smtp_connection()
            if not test_result['success']:
                return test_result
            
            # Send test email to admin users
            from services.user_service import UserService
            user_service = UserService()
            admin_users = []
            
            try:
                all_users = user_service.get_all_users()
                admin_users = [user for user in all_users if user['role'] == 'admin' and user['isActive']]
            except:
                pass
            
            if not admin_users:
                return {'success': False, 'error': 'No active admin users found for testing'}
            
            # Send test email to first admin
            test_user = admin_users[0]
            self.send_test_email(test_user)
            
            return {'success': True, 'message': f'Test email sent to {test_user["email"]}'}
            
        except Exception as e:
            logger.error(f"Error testing email configuration: {e}")
            return {'success': False, 'error': str(e)}

    def test_smtp_connection(self):
        """Test SMTP connection"""
        try:
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            server.starttls()
            server.login(self.smtp_user, self.smtp_pass)
            server.quit()
            return {'success': True}
        except Exception as e:
            logger.error(f"SMTP connection test failed: {e}")
            return {'success': False, 'error': str(e)}

    def send_threat_alert(self, threat_data):
        """Send threat alert email to relevant users"""
        if not self.is_configured_flag:
            logger.warning("Email service not configured, skipping threat alert")
            return False
        
        try:
            # Get users who should receive this alert
            from services.user_service import UserService
            user_service = UserService()
            
            alert_users = user_service.get_users_for_alerts(
                threat_data.get('severity', 'Medium'),
                threat_data.get('classification', 'Unknown')
            )
            
            if not alert_users:
                logger.info("No users configured to receive this threat alert")
                return False
            
            # Queue emails for each user
            for user in alert_users:
                email_data = {
                    'type': 'threat_alert',
                    'recipient': user,
                    'threat': threat_data,
                    'timestamp': datetime.now().isoformat(),
                    'priority': self.get_email_priority(threat_data.get('severity', 'Medium'))
                }
                self.email_queue.put(email_data)
            
            logger.info(f"Queued threat alert emails for {len(alert_users)} users")
            return True
            
        except Exception as e:
            logger.error(f"Error sending threat alert: {e}")
            return False

    def send_test_email(self, user):
        """Send test email to user"""
        try:
            email_data = {
                'type': 'test_email',
                'recipient': user,
                'timestamp': datetime.now().isoformat(),
                'priority': 'normal'
            }
            self.email_queue.put(email_data)
            logger.info(f"Queued test email for {user['email']}")
            return True
        except Exception as e:
            logger.error(f"Error queuing test email: {e}")
            return False

    def start_email_processor(self):
        """Start email processing thread"""
        if self.is_processing:
            return
        
        self.is_processing = True
        
        def process_emails():
            while self.is_processing:
                try:
                    # Get email from queue (with timeout)
                    email_data = self.email_queue.get(timeout=1)
                    
                    # Send email
                    self.send_email(email_data)
                    
                    # Mark task as done
                    self.email_queue.task_done()
                    
                    # Small delay to avoid overwhelming SMTP server
                    time.sleep(0.1)
                    
                except queue.Empty:
                    continue
                except Exception as e:
                    logger.error(f"Error processing email: {e}")
        
        # Start processing thread
        email_thread = threading.Thread(target=process_emails, daemon=True)
        email_thread.start()
        logger.info("Email processing thread started")

    def send_email(self, email_data):
        """Send individual email"""
        try:
            email_type = email_data['type']
            recipient = email_data['recipient']
            
            if email_type == 'threat_alert':
                self.send_threat_alert_email(email_data)
            elif email_type == 'test_email':
                self.send_test_email_message(email_data)
            else:
                logger.warning(f"Unknown email type: {email_type}")
                
        except Exception as e:
            logger.error(f"Error sending email: {e}")

    def send_threat_alert_email(self, email_data):
        """Send threat alert email"""
        try:
            recipient = email_data['recipient']
            threat = email_data['threat']
            
            # Create email
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"🚨 {threat['severity']} Security Threat Detected - {threat['type']}"
            msg['From'] = f"{self.from_name} <{self.smtp_user}>"
            msg['To'] = recipient['email']
            
            # Create text and HTML content
            text_content = self.generate_threat_alert_text(threat, recipient)
            html_content = self.generate_threat_alert_html(threat, recipient)
            
            # Attach parts
            text_part = MIMEText(text_content, 'plain')
            html_part = MIMEText(html_content, 'html')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Send email
            self.send_smtp_email(msg)
            logger.info(f"Threat alert sent to {recipient['email']}")
            
        except Exception as e:
            logger.error(f"Error sending threat alert email: {e}")

    def send_test_email_message(self, email_data):
        """Send test email message"""
        try:
            recipient = email_data['recipient']
            
            # Create email
            msg = MIMEMultipart('alternative')
            msg['Subject'] = "🔧 CyberSecure System - Email Configuration Test"
            msg['From'] = f"{self.from_name} <{self.smtp_user}>"
            msg['To'] = recipient['email']
            
            # Create content
            text_content = f"""
Hello {recipient['name']},

This is a test email to verify that the CyberSecure Hospital Defense email system is working correctly.

If you receive this message, the email configuration is properly set up and ready to send threat alerts.

System Information:
- Test sent at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- SMTP Server: {self.smtp_host}:{self.smtp_port}
- From: {self.smtp_user}

Best regards,
CyberSecure Hospital Defense System
            """.strip()
            
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Email Configuration Test</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: white; padding: 30px; border: 1px solid #e5e7eb; }}
        .footer {{ background: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }}
        .success {{ background: #dcfce7; border: 1px solid #16a34a; padding: 15px; border-radius: 6px; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 Email Configuration Test</h1>
        </div>
        <div class="content">
            <p>Hello {recipient['name']},</p>
            
            <div class="success">
                <strong>✅ Success!</strong> This test email confirms that the CyberSecure Hospital Defense email system is working correctly.
            </div>
            
            <p>If you receive this message, the email configuration is properly set up and ready to send threat alerts.</p>
            
            <h3>System Information:</h3>
            <ul>
                <li><strong>Test sent at:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</li>
                <li><strong>SMTP Server:</strong> {self.smtp_host}:{self.smtp_port}</li>
                <li><strong>From:</strong> {self.smtp_user}</li>
            </ul>
            
            <p>The system is now ready to send real-time threat alerts to keep your hospital network secure.</p>
        </div>
        <div class="footer">
            <strong>CyberSecure Hospital Defense System</strong><br>
            Advanced Threat Detection & Response
        </div>
    </div>
</body>
</html>
            """
            
            # Attach parts
            text_part = MIMEText(text_content, 'plain')
            html_part = MIMEText(html_content, 'html')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Send email
            self.send_smtp_email(msg)
            logger.info(f"Test email sent to {recipient['email']}")
            
        except Exception as e:
            logger.error(f"Error sending test email: {e}")

    def send_smtp_email(self, msg):
        """Send email via SMTP"""
        try:
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            server.starttls()
            server.login(self.smtp_user, self.smtp_pass)
            server.send_message(msg)
            server.quit()
        except Exception as e:
            logger.error(f"SMTP send error: {e}")
            raise

    def generate_threat_alert_text(self, threat, user):
        """Generate plain text threat alert"""
        return f"""
SECURITY THREAT DETECTED

Hello {user['name']},

A {threat['severity'].lower()} security threat has been detected on the hospital network.

Threat Details:
- Type: {threat['type']}
- Severity: {threat['severity']}
- Detection Time: {threat['timestamp']}
- Source: {threat['source']}:{threat.get('sourcePort', 'N/A')}
- Destination: {threat['destination']}:{threat.get('destinationPort', 'N/A')}
- Protocol: {threat.get('protocol', 'Unknown').upper()}
- Classification: {threat['classification']}
- Confidence Level: {threat['confidence'] * 100:.1f}%

Description:
{threat['description']}

{'IMMEDIATE ACTION REQUIRED: This is a critical threat that requires immediate investigation and response.' if threat['severity'] == 'Critical' else 'Please investigate this threat and take appropriate security measures as needed.'}

Next Steps:
1. Review the threat details in the security dashboard
2. Investigate the source IP address: {threat['source']}
3. Consider blocking the source if confirmed malicious
4. Document any actions taken in the incident response system

You can view more details and manage this threat in the CyberSecure Hospital Defense dashboard.

Best regards,
CyberSecure Hospital Defense System

---
This is an automated security alert. Please do not reply to this email.
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Alert ID: {threat['id']}
        """.strip()

    def generate_threat_alert_html(self, threat, user):
        """Generate HTML threat alert"""
        severity_colors = {
            'Critical': '#dc2626',
            'High': '#ea580c',
            'Medium': '#d97706',
            'Low': '#2563eb'
        }
        
        severity_bg_colors = {
            'Critical': '#fef2f2',
            'High': '#fff7ed',
            'Medium': '#fffbeb',
            'Low': '#eff6ff'
        }
        
        threat_icons = {
            'Malware': '🦠',
            'DDoS': '⚡',
            'Intrusion': '🚪',
            'Phishing': '🎣',
            'Port_Scan': '🔍',
            'Brute_Force': '🔨'
        }
        
        severity = threat['severity']
        color = severity_colors.get(severity, '#2563eb')
        bg_color = severity_bg_colors.get(severity, '#eff6ff')
        icon = threat_icons.get(threat['classification'], '⚠️')
        
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Security Threat Alert</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f8fafc; }}
        .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }}
        .header {{ background: {color}; color: white; padding: 30px 20px; text-align: center; }}
        .threat-icon {{ font-size: 48px; margin-bottom: 10px; }}
        .content {{ padding: 30px; }}
        .alert-badge {{ display: inline-block; padding: 8px 16px; border-radius: 25px; font-size: 14px; font-weight: bold; color: {color}; background: {bg_color}; margin-bottom: 20px; }}
        .threat-summary {{ background: {bg_color}; border-left: 4px solid {color}; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }}
        .details-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0; }}
        .detail-item {{ background: #f8fafc; padding: 15px; border-radius: 8px; }}
        .detail-label {{ font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }}
        .detail-value {{ font-size: 16px; font-weight: 600; color: #1e293b; }}
        .network-flow {{ display: flex; align-items: center; justify-content: center; gap: 15px; margin: 15px 0; }}
        .network-node {{ background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 10px 15px; font-family: monospace; font-size: 14px; }}
        .network-arrow {{ color: {color}; font-size: 20px; font-weight: bold; }}
        .action-section {{ background: {'#fef2f2' if severity == 'Critical' else '#f8fafc'}; border: 2px solid {'#fecaca' if severity == 'Critical' else '#e2e8f0'}; border-radius: 12px; padding: 25px; margin: 25px 0; }}
        .footer {{ background: #1e293b; color: #94a3b8; padding: 25px; text-align: center; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="threat-icon">{icon}</div>
            <h1 style="margin: 0; font-size: 28px;">Security Threat Detected</h1>
            <div style="margin-top: 10px; font-size: 18px;">{severity} Priority Alert</div>
        </div>
        
        <div class="content">
            <p>Hello {user['name']},</p>
            
            <div class="alert-badge">{severity.upper()} THREAT</div>
            
            <div class="threat-summary">
                <h2 style="margin: 0 0 10px 0; color: {color};">{threat['type']}</h2>
                <p style="margin: 0; color: #475569;">{threat['description']}</p>
            </div>

            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0;">Network Activity</h3>
                <div class="network-flow">
                    <div class="network-node">
                        {threat['source']}<br>
                        <small style="color: #64748b;">Port {threat.get('sourcePort', 'N/A')}</small>
                    </div>
                    <div class="network-arrow">→</div>
                    <div class="network-node">
                        {threat['destination']}<br>
                        <small style="color: #64748b;">Port {threat.get('destinationPort', 'N/A')}</small>
                    </div>
                </div>
            </div>

            <div class="details-grid">
                <div class="detail-item">
                    <div class="detail-label">Detection Time</div>
                    <div class="detail-value">{threat['timestamp']}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Protocol</div>
                    <div class="detail-value">{threat.get('protocol', 'Unknown').upper()}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Classification</div>
                    <div class="detail-value">{threat['classification']}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Confidence Level</div>
                    <div class="detail-value">{threat['confidence'] * 100:.1f}%</div>
                </div>
            </div>
            
            <div class="action-section">
                <h3 style="color: {'#dc2626' if severity == 'Critical' else '#1e293b'}; margin: 0 0 15px 0;">
                    {'🚨 IMMEDIATE ACTION REQUIRED' if severity == 'Critical' else '⚠️ Recommended Actions'}
                </h3>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Review threat details in the security dashboard</li>
                    <li>Investigate source IP address: <strong>{threat['source']}</strong></li>
                    <li>Check for similar patterns in recent network traffic</li>
                    <li>Consider blocking source IP if confirmed malicious</li>
                    <li>Document response actions in incident management system</li>
                    {'<li><strong>Escalate to security team immediately</strong></li>' if severity == 'Critical' else ''}
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px;">🛡️ CyberSecure Hospital Defense</div>
            <div>Advanced Threat Detection & Response System</div>
            <div style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
                Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br>
                Alert ID: {threat['id']}<br>
                This is an automated security alert. Please do not reply to this email.
            </div>
        </div>
    </div>
</body>
</html>
        """

    def get_email_priority(self, severity):
        """Get email priority based on threat severity"""
        priority_map = {
            'Critical': 'high',
            'High': 'high',
            'Medium': 'normal',
            'Low': 'low'
        }
        return priority_map.get(severity, 'normal')

    def cleanup(self):
        """Cleanup email service resources"""
        self.is_processing = False
        logger.info("Email service cleanup completed")