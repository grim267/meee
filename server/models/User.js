const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'security_analyst', 'it_manager', 'viewer'], 
    default: 'viewer' 
  },
  alertPreferences: {
    emailEnabled: { type: Boolean, default: true },
    severityLevels: [{ 
      type: String, 
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: function() { return ['Critical', 'High']; }
    }],
    threatTypes: [{
      type: String,
      enum: ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'],
      default: function() { return ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force']; }
    }],
    immediateAlert: { type: Boolean, default: true },
    dailySummary: { type: Boolean, default: true },
    weeklySummary: { type: Boolean, default: false }
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ id: 1 });

module.exports = mongoose.model('User', userSchema);