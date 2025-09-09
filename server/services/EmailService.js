const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('Email service not configured - missing SMTP credentials');
        return;
      }

      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      await this.transporter.verify();
      this.isConfigured = true;
      console.log('Email service configured successfully');

    } catch (error) {
      console.error('Failed to configure email service:', error.message);
      this.isConfigured = false;
    }
  }

  async sendThreatAlert(threat, alertEmail = null) {
    if (!this.isConfigured) {
      console.log('Email service not configured, skipping alert');
      return false;
    }

    try {
      const recipient = alertEmail || process.env.ALERT_EMAIL;
      if (!recipient) {
        console.log('No alert email configured');
        return false;
      }

      const subject = `🚨 ${threat.severity} Security Threat Detected - ${threat.type}`;
      const htmlContent = await this.generateThreatAlertHTML(threat);
      const textContent = this.generateThreatAlertText(threat);

      const mailOptions = {
        from: `"CyberSecure Hospital Defense" <${process.env.SMTP_USER}>`,
        to: recipient,
        subject: subject,
        text: textContent,
        html: htmlContent,
        priority: threat.severity === 'Critical' ? 'high' : 'normal'
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Threat alert email sent:', info.messageId);
      return true;

    } catch (error) {
      console.error('Failed to send threat alert email:', error);
      return false;
    }
  }

  async sendSystemAlert(title, message, severity = 'Medium') {
    if (!this.isConfigured) {
      return false;
    }

    try {
      const recipient = process.env.ALERT_EMAIL;
      if (!recipient) {
        return false;
      }

      const subject = `🔧 System Alert - ${title}`;
      const htmlContent = this.generateSystemAlertHTML(title, message, severity);

      const mailOptions = {
        from: `"CyberSecure Hospital Defense" <${process.env.SMTP_USER}>`,
        to: recipient,
        subject: subject,
        html: htmlContent,
        priority: severity === 'Critical' ? 'high' : 'normal'
      };

      await this.transporter.sendMail(mailOptions);
      return true;

    } catch (error) {
      console.error('Failed to send system alert email:', error);
      return false;
    }
  }

  generateThreatAlertText(threat) {
    return `
SECURITY THREAT DETECTED

Severity: ${threat.severity}
Type: ${threat.type}
Time: ${new Date(threat.timestamp).toLocaleString()}

Details:
- Source: ${threat.source}:${threat.sourcePort || 'N/A'}
- Destination: ${threat.destination}:${threat.destinationPort || 'N/A'}
- Protocol: ${threat.protocol?.toUpperCase() || 'Unknown'}
- Network Interface: ${threat.networkInterface || 'Unknown'}
- Classification: ${threat.classification}
- Confidence: ${(threat.confidence * 100).toFixed(1)}%

Description: ${threat.description}

Please investigate this threat immediately and take appropriate action.

---
CyberSecure Hospital Defense System
Generated at: ${new Date().toLocaleString()}
    `.trim();
  }

  async generateThreatAlertHTML(threat) {
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Threat Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: ${severityColor[threat.severity] || '#2563eb'}; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .alert-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: white; background: ${severityColor[threat.severity] || '#2563eb'}; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .description { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${severityColor[threat.severity] || '#2563eb'}; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .urgent { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header ${threat.severity === 'Critical' ? 'urgent' : ''}">
            <h1>🚨 Security Threat Detected</h1>
            <span class="alert-badge">${threat.severity.toUpperCase()}</span>
        </div>
        
        <div class="content">
            <h2>${threat.type}</h2>
            
            <div class="detail-row">
                <span class="detail-label">Detection Time:</span>
                <span class="detail-value">${new Date(threat.timestamp).toLocaleString()}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Source Address:</span>
                <span class="detail-value">${threat.source}:${threat.sourcePort || 'N/A'}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Destination:</span>
                <span class="detail-value">${threat.destination}:${threat.destinationPort || 'N/A'}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Protocol:</span>
                <span class="detail-value">${threat.protocol?.toUpperCase() || 'Unknown'}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Network Interface:</span>
                <span class="detail-value">${threat.networkInterface || 'Unknown'}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Classification:</span>
                <span class="detail-value">${threat.classification}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Confidence Level:</span>
                <span class="detail-value">${(threat.confidence * 100).toFixed(1)}%</span>
            </div>
            
            <div class="description">
                <h3>Threat Description</h3>
                <p>${threat.description}</p>
            </div>
            
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin-top: 20px;">
                <h3 style="color: #dc2626; margin-top: 0;">⚠️ Immediate Action Required</h3>
                <p style="margin-bottom: 0;">Please investigate this threat immediately and take appropriate security measures. Consider blocking the source IP if confirmed malicious.</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>CyberSecure Hospital Defense System</strong></p>
            <p>Generated at: ${new Date().toLocaleString()}</p>
            <p>This is an automated security alert. Do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateSystemAlertHTML(title, message, severity) {
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
      await this.sendSystemAlert(
        'Email Configuration Test',
        'This is a test email to verify that the email alerting system is working correctly.',
        'Low'
      );
      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailService;