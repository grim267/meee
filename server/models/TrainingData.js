const mongoose = require('mongoose');

const trainingDataSchema = new mongoose.Schema({
  features: [{ type: Number, required: true }],
  label: { type: String, required: true },
  source: { type: String }, // 'manual', 'auto', 'csv'
  timestamp: { type: Date, default: Date.now },
  validated: { type: Boolean, default: false }
}, {
  timestamps: true
});

trainingDataSchema.index({ timestamp: -1 });
trainingDataSchema.index({ label: 1 });

module.exports = mongoose.model('TrainingData', trainingDataSchema);