const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.emailQueue = [];
    this.isProcessingQueue = false;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('Email service not configured - missing SMTP credentials');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        },
        pool: true, // Use connection pooling
        maxConnections: 5,
        maxMessages: 100
      });

      // Verify connection
      await this.transporter.verify();
      this.isConfigured = true;
      console.log('Email service configured successfully');

      // Start processing email queue
      this.processEmailQueue();

    } catch (error) {
      console.error('Failed to configure email service:', error.message);
      this.isConfigured = false;
    }
  }

  async sendThreatAlert(threat) {
    if (!this.isConfigured) {
      console.log('Email service not configured, skipping threat alert');
      return false;
    }

    try {
      // Get users who should receive this alert
      const recipients = await this.getAlertRecipients(threat);
      
      if (recipients.length === 0) {
        console.log('No recipients configured for threat alerts');
        return false;
      }

      const emailPromises = recipients.map(user => 
        this.queueThreatEmail(threat, user)
      );

      await Promise.all(emailPromises);
      console.log(`Threat alert queued for ${recipients.length} recipients`);
      return true;

    } catch (error) {
      console.error('Failed to send threat alert:', error);
      return false;
    }
  }

  async getAlertRecipients(threat) {
    try {
      const users = await User.find({
        isActive: true,
        'alertPreferences.emailEnabled': true,
        'alertPreferences.severityLevels': threat.severity,
        'alertPreferences.threatTypes': threat.classification
      });

      return users;
    } catch (error) {
      console.error('Error getting alert recipients:', error);
      return [];
    }
  }

  async queueThreatEmail(threat, user) {
    const emailData = {
      type: 'threat_alert',
      recipient: user,
      threat: threat,
      timestamp: new Date(),
      priority: this.getEmailPriority(threat.severity)
    };

    this.emailQueue.push(emailData);
    
    // Process immediately for critical threats
    if (threat.severity === 'Critical' && user.alertPreferences.immediateAlert) {
      this.processEmailQueue();
    }
  }

  async processEmailQueue() {
    if (this.isProcessingQueue || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Sort by priority (Critical first)
      this.emailQueue.sort((a, b) => {
        const priorityOrder = { 'high': 3, 'normal': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      while (this.emailQueue.length > 0) {
        const emailData = this.emailQueue.shift();
        
        try {
          await this.sendEmail(emailData);
          // Small delay to avoid overwhelming SMTP server
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('Failed to send email:', error);
          // Re-queue failed emails (max 3 retries)
          if (!emailData.retryCount) emailData.retryCount = 0;
          if (emailData.retryCount < 3) {
            emailData.retryCount++;
            this.emailQueue.push(emailData);
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async sendEmail(emailData) {
    const { type, recipient, threat } = emailData;

    let subject, htmlContent, textContent;

    switch (type) {
      case 'threat_alert':
        subject = `🚨 ${threat.severity} Security Threat Detected - ${threat.type}`;
        htmlContent = await this.generateThreatAlertHTML(threat, recipient);
        textContent = this.generateThreatAlertText(threat, recipient);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const mailOptions = {
      from: `"CyberSecure Hospital Defense" <${process.env.SMTP_USER}>`,
      to: recipient.email,
      subject: subject,
      text: textContent,
      html: htmlContent,
      priority: emailData.priority,
      headers: {
        'X-Threat-ID': threat.id,
        'X-Threat-Severity': threat.severity,
        'X-Alert-Type': 'security-threat'
      }
    };

    const info = await this.transporter.sendMail(mailOptions);
    console.log(`Threat alert sent to ${recipient.email}:`, info.messageId);
    return info;
  }

  getEmailPriority(severity) {
    switch (severity) {
      case 'Critical': return 'high';
      case 'High': return 'high';
      case 'Medium': return 'normal';
      case 'Low': return 'low';
      default: return 'normal';
    }
  }

  generateThreatAlertText(threat, user) {
    return `
Hello ${user.name},

SECURITY THREAT DETECTED

A ${threat.severity.toLowerCase()} security threat has been detected on the hospital network.

Threat Details:
- Type: ${threat.type}
- Severity: ${threat.severity}
- Detection Time: ${new Date(threat.timestamp).toLocaleString()}
- Source: ${threat.source}:${threat.sourcePort || 'N/A'}
- Destination: ${threat.destination}:${threat.destinationPort || 'N/A'}
- Protocol: ${threat.protocol?.toUpperCase() || 'Unknown'}
- Network Interface: ${threat.networkInterface || 'Unknown'}
- Classification: ${threat.classification}
- Confidence Level: ${(threat.confidence * 100).toFixed(1)}%

Description:
${threat.description}

${threat.severity === 'Critical' ? 
  'IMMEDIATE ACTION REQUIRED: This is a critical threat that requires immediate investigation and response.' :
  'Please investigate this threat and take appropriate security measures as needed.'
}

Location: ${threat.location || 'Network perimeter'}

Next Steps:
1. Review the threat details in the security dashboard
2. Investigate the source IP address: ${threat.source}
3. Consider blocking the source if confirmed malicious
4. Document any actions taken in the incident response system

You can view more details and manage this threat in the CyberSecure Hospital Defense dashboard.

Best regards,
CyberSecure Hospital Defense System

---
This is an automated security alert. Please do not reply to this email.
Generated at: ${new Date().toLocaleString()}
Alert ID: ${threat.id}
    `.trim();
  }

  async generateThreatAlertHTML(threat, user) {
    const severityColor = {
      'Critical': '#dc2626',
      'High': '#ea580c',
      'Medium': '#d97706',
      'Low': '#2563eb'
    };

    const severityBgColor = {
      'Critical': '#fef2f2',
      'High': '#fff7ed',
      'Medium': '#fffbeb',
      'Low': '#eff6ff'
    };

    const threatTypeIcons = {
      'Malware': '🦠',
      'DDoS': '⚡',
      'Intrusion': '🚪',
      'Phishing': '🎣',
      'Port_Scan': '🔍',
      'Brute_Force': '🔨'
    };

    const icon = threatTypeIcons[threat.classification] || '⚠️';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Threat Alert</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 20px; 
            background-color: #f8fafc; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            overflow: hidden; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
            border: 1px solid #e2e8f0;
        }
        .header { 
            background: linear-gradient(135deg, ${severityColor[threat.severity]}, ${severityColor[threat.severity]}dd); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            position: relative;
        }
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
        }
        .header-content { position: relative; z-index: 1; }
        .threat-icon { font-size: 48px; margin-bottom: 10px; display: block; }
        .content { padding: 30px; }
        .greeting { font-size: 16px; color: #64748b; margin-bottom: 20px; }
        .alert-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 25px; 
            font-size: 14px; 
            font-weight: bold; 
            color: ${severityColor[threat.severity]}; 
            background: ${severityBgColor[threat.severity]}; 
            border: 2px solid ${severityColor[threat.severity]}20;
            margin-bottom: 20px;
        }
        .threat-summary {
            background: ${severityBgColor[threat.severity]};
            border-left: 4px solid ${severityColor[threat.severity]};
            padding: 20px;
            border-radius: 0 8px 8px 0;
            margin: 20px 0;
        }
        .threat-title { 
            font-size: 24px; 
            font-weight: bold; 
            color: ${severityColor[threat.severity]}; 
            margin: 0 0 10px 0; 
        }
        .threat-description { 
            font-size: 16px; 
            color: #475569; 
            margin: 0; 
        }
        .details-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 15px; 
            margin: 25px 0; 
        }
        .detail-item { 
            background: #f8fafc; 
            padding: 15px; 
            border-radius: 8px; 
            border: 1px solid #e2e8f0; 
        }
        .detail-label { 
            font-size: 12px; 
            font-weight: 600; 
            color: #64748b; 
            text-transform: uppercase; 
            letter-spacing: 0.5px; 
            margin-bottom: 5px; 
        }
        .detail-value { 
            font-size: 16px; 
            font-weight: 600; 
            color: #1e293b; 
        }
        .network-info {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .network-flow {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin: 15px 0;
        }
        .network-node {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 15px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            font-weight: 600;
        }
        .network-arrow {
            color: ${severityColor[threat.severity]};
            font-size: 20px;
            font-weight: bold;
        }
        .action-section {
            background: ${threat.severity === 'Critical' ? '#fef2f2' : '#f8fafc'};
            border: 2px solid ${threat.severity === 'Critical' ? '#fecaca' : '#e2e8f0'};
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
        }
        .action-title {
            color: ${threat.severity === 'Critical' ? '#dc2626' : '#1e293b'};
            font-size: 18px;
            font-weight: bold;
            margin: 0 0 15px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .action-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .action-list li {
            padding: 8px 0;
            border-bottom: 1px solid ${threat.severity === 'Critical' ? '#fecaca' : '#e2e8f0'};
            position: relative;
            padding-left: 25px;
        }
        .action-list li:last-child { border-bottom: none; }
        .action-list li::before {
            content: '→';
            position: absolute;
            left: 0;
            color: ${severityColor[threat.severity]};
            font-weight: bold;
        }
        .confidence-bar {
            background: #e2e8f0;
            border-radius: 10px;
            height: 8px;
            overflow: hidden;
            margin-top: 5px;
        }
        .confidence-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #059669);
            border-radius: 10px;
            width: ${(threat.confidence * 100).toFixed(1)}%;
            transition: width 0.3s ease;
        }
        .footer { 
            background: #1e293b; 
            color: #94a3b8; 
            padding: 25px; 
            text-align: center; 
            font-size: 14px; 
        }
        .footer-logo {
            color: #3b82f6;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 10px;
        }
        .footer-links {
            margin: 15px 0;
        }
        .footer-links a {
            color: #3b82f6;
            text-decoration: none;
            margin: 0 10px;
        }
        .urgent-pulse {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.8; }
            100% { opacity: 1; }
        }
        @media (max-width: 600px) {
            .details-grid { grid-template-columns: 1fr; }
            .network-flow { flex-direction: column; }
            .network-arrow { transform: rotate(90deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header ${threat.severity === 'Critical' ? 'urgent-pulse' : ''}">
            <div class="header-content">
                <span class="threat-icon">${icon}</span>
                <h1 style="margin: 0; font-size: 28px;">Security Threat Detected</h1>
                <div style="margin-top: 10px; font-size: 18px; opacity: 0.9;">
                    ${threat.severity} Priority Alert
                </div>
            </div>
        </div>
        
        <div class="content">
            <div class="greeting">Hello ${user.name},</div>
            
            <div class="alert-badge">${threat.severity.toUpperCase()} THREAT</div>
            
            <div class="threat-summary">
                <div class="threat-title">${threat.type}</div>
                <div class="threat-description">${threat.description}</div>
            </div>

            <div class="network-info">
                <h3 style="margin: 0 0 15px 0; color: #1e293b;">Network Activity</h3>
                <div class="network-flow">
                    <div class="network-node">
                        ${threat.source}<br>
                        <small style="color: #64748b;">Port ${threat.sourcePort || 'N/A'}</small>
                    </div>
                    <div class="network-arrow">→</div>
                    <div class="network-node">
                        ${threat.destination}<br>
                        <small style="color: #64748b;">Port ${threat.destinationPort || 'N/A'}</small>
                    </div>
                </div>
            </div>

            <div class="details-grid">
                <div class="detail-item">
                    <div class="detail-label">Detection Time</div>
                    <div class="detail-value">${new Date(threat.timestamp).toLocaleString()}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Protocol</div>
                    <div class="detail-value">${threat.protocol?.toUpperCase() || 'Unknown'}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Network Interface</div>
                    <div class="detail-value">${threat.networkInterface || 'Unknown'}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Classification</div>
                    <div class="detail-value">${threat.classification}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Confidence Level</div>
                    <div class="detail-value">
                        ${(threat.confidence * 100).toFixed(1)}%
                        <div class="confidence-bar">
                            <div class="confidence-fill"></div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Packet Size</div>
                    <div class="detail-value">${threat.packetSize || 'N/A'} bytes</div>
                </div>
            </div>
            
            <div class="action-section">
                <div class="action-title">
                    ${threat.severity === 'Critical' ? '🚨' : '⚠️'}
                    ${threat.severity === 'Critical' ? 'IMMEDIATE ACTION REQUIRED' : 'Recommended Actions'}
                </div>
                <ul class="action-list">
                    <li>Review threat details in the security dashboard</li>
                    <li>Investigate source IP address: <strong>${threat.source}</strong></li>
                    <li>Check for similar patterns in recent network traffic</li>
                    <li>Consider blocking source IP if confirmed malicious</li>
                    <li>Document response actions in incident management system</li>
                    ${threat.severity === 'Critical' ? '<li><strong>Escalate to security team immediately</strong></li>' : ''}
                </ul>
            </div>

            <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #64748b;">
                    <strong>Need Help?</strong> Contact the security team or access the 
                    <a href="#" style="color: #3b82f6; text-decoration: none;">CyberSecure Dashboard</a> 
                    for detailed analysis and response tools.
                </p>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-logo">🛡️ CyberSecure Hospital Defense</div>
            <div>Advanced Threat Detection & Response System</div>
            <div class="footer-links">
                <a href="#">Dashboard</a> |
                <a href="#">Documentation</a> |
                <a href="#">Support</a>
            </div>
            <div style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
                Generated: ${new Date().toLocaleString()}<br>
                Alert ID: ${threat.id}<br>
                This is an automated security alert. Please do not reply to this email.
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  async sendDailySummary() {
    if (!this.isConfigured) return false;

    try {
      const users = await User.find({
        isActive: true,
        'alertPreferences.emailEnabled': true,
        'alertPreferences.dailySummary': true
      });

      // Implementation for daily summary emails
      console.log(`Daily summary would be sent to ${users.length} users`);
      return true;
    } catch (error) {
      console.error('Failed to send daily summary:', error);
      return false;
    }
  }

  async sendSystemAlert(title, message, severity = 'Medium', recipients = null) {
    if (!this.isConfigured) return false;

    try {
      let users;
      if (recipients) {
        users = recipients;
      } else {
        users = await User.find({
          isActive: true,
          'alertPreferences.emailEnabled': true,
          role: { $in: ['admin', 'security_analyst', 'it_manager'] }
        });
      }

      const emailPromises = users.map(user => {
        const emailData = {
          type: 'system_alert',
          recipient: user,
          title,
          message,
          severity,
          timestamp: new Date(),
          priority: this.getEmailPriority(severity)
        };
        return this.sendSystemAlertEmail(emailData);
      });

      await Promise.all(emailPromises);
      return true;
    } catch (error) {
      console.error('Failed to send system alert:', error);
      return false;
    }
  }

  async sendSystemAlertEmail(emailData) {
    const { recipient, title, message, severity } = emailData;

    const mailOptions = {
      from: `"CyberSecure Hospital Defense" <${process.env.SMTP_USER}>`,
      to: recipient.email,
      subject: `🔧 System Alert - ${title}`,
      html: this.generateSystemAlertHTML(title, message, severity, recipient),
      priority: emailData.priority
    };

    return await this.transporter.sendMail(mailOptions);
  }

  generateSystemAlertHTML(title, message, severity, user) {
    const severityColor = {
      'Critical': '#dc2626',
      'High': '#ea580c',
      'Medium': '#d97706',
      'Low': '#2563eb'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>System Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: ${severityColor[severity] || '#2563eb'}; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 ${title}</h1>
        </div>
        <div class="content">
            <p>Hello ${user.name},</p>
            <p>${message}</p>
        </div>
        <div class="footer">
            <p><strong>CyberSecure Hospital Defense System</strong></p>
            <p>Generated at: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  async testEmailConfiguration() {
    if (!this.isConfigured) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      // Send test email to admin users
      const adminUsers = await User.find({ role: 'admin', isActive: true }).limit(1);
      
      if (adminUsers.length === 0) {
        return { success: false, error: 'No admin users found for testing' };
      }

      await this.sendSystemAlert(
        'Email Configuration Test',
        'This is a test email to verify that the email alerting system is working correctly. If you receive this message, the email service is properly configured.',
        'Low',
        adminUsers
      );
      
      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Cleanup method to close transporter
  async close() {
    if (this.transporter) {
      this.transporter.close();
    }
  }
}

module.exports = EmailService;