const mongoose = require('mongoose');

const threatSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, required: true },
  severity: { 
    type: String, 
    enum: ['Critical', 'High', 'Medium', 'Low'], 
    required: true 
  },
  source: { type: String, required: true },
  destination: { type: String, required: true },
  sourcePort: { type: Number },
  destinationPort: { type: Number },
  protocol: { type: String },
  packetSize: { type: Number },
  description: { type: String, required: true },
  classification: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  status: { 
    type: String, 
    enum: ['Active', 'Resolved', 'Investigating'], 
    default: 'Active' 
  },
  location: { type: String },
  networkInterface: { type: String },
  rawPacketData: { type: Object },
  features: [{ type: Number }],
  alertSent: { type: Boolean, default: false }
}, {
  timestamps: true
});

threatSchema.index({ timestamp: -1 });
threatSchema.index({ severity: 1 });
threatSchema.index({ status: 1 });

module.exports = mongoose.model('Threat', threatSchema);