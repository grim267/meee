const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  threatId: { type: String, required: true },
  threat: { type: Object, required: true },
  timestamp: { type: Date, default: Date.now },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: { type: String },
  acknowledgedAt: { type: Date },
  assignedTo: { type: String },
  notes: { type: String },
  emailSent: { type: Boolean, default: false },
  escalated: { type: Boolean, default: false }
}, {
  timestamps: true
});

alertSchema.index({ timestamp: -1 });
alertSchema.index({ acknowledged: 1 });

module.exports = mongoose.model('Alert', alertSchema);