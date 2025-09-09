#!/usr/bin/env node

/**
 * Debug Training Script
 * Run this to test training without the web interface
 */

require('dotenv').config({ path: './server/.env' });
const ThreatDetector = require('./server/services/ThreatDetector');
const fs = require('fs');

async function debugTraining() {
  console.log('🔍 Debug Training Script');
  console.log('========================');
  
  // Test CSV parsing
  console.log('\n1. Testing CSV parsing...');
  try {
    const csvData = fs.readFileSync('./training_data_network.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    console.log('✅ CSV loaded:', lines.length, 'lines');
    
    const headers = lines[0].split(',').map(h => h.trim());
    console.log('✅ Headers:', headers);
    
    const dataRows = lines.slice(1);
    console.log('✅ Data rows:', dataRows.length);
    
    // Check if it's the new format
    const expectedHeaders = ['source_ip', 'dest_ip', 'source_port', 'dest_port', 'protocol', 'packet_size', 'duration', 'threat_type'];
    const hasNewFormat = expectedHeaders.every(header => headers.includes(header));
    console.log('✅ Has new CSV format:', hasNewFormat);
    
  } catch (error) {
    console.error('❌ CSV parsing failed:', error.message);
    return;
  }
  
  // Test TensorFlow
  console.log('\n2. Testing TensorFlow...');
  try {
    const tf = require('@tensorflow/tfjs-node');
    console.log('✅ TensorFlow loaded, version:', tf.version.tfjs);
    
    // Test tensor creation
    const testTensor = tf.tensor2d([[1, 2, 3], [4, 5, 6]]);
    console.log('✅ Test tensor shape:', testTensor.shape);
    testTensor.dispose();
    
  } catch (error) {
    console.error('❌ TensorFlow test failed:', error.message);
    return;
  }
  
  // Test ThreatDetector
  console.log('\n3. Testing ThreatDetector...');
  try {
    const detector = new ThreatDetector();
    console.log('✅ ThreatDetector created');
    
    // Test with minimal data
    const minimalData = [
      { features: [1024, 80, 12345, 6, 14, 1, 3, 2, 1], label: 'Normal' },
      { features: [512, 443, 54321, 6, 10, 1, 2, 2, 1], label: 'Normal' },
      { features: [256, 22, 33445, 6, 9, 1, 2, 2, 1], label: 'Normal' },
      { features: [1024, 135, 12345, 6, 2, 1, 3, 2, 1], label: 'Malware' },
      { features: [512, 445, 54321, 6, 3, 1, 2, 2, 1], label: 'Malware' },
      { features: [16, 80, 12345, 6, 14, 1, 1, 1, 2], label: 'DDoS' },
      { features: [16, 80, 54321, 6, 14, 1, 1, 1, 2], label: 'DDoS' },
      { features: [1024, 22, 12345, 6, 8, 1, 3, 1, 2], label: 'Intrusion' },
      { features: [64, 80, 12345, 6, 14, 1, 1, 1, 2], label: 'Port_Scan' },
      { features: [128, 22, 12345, 6, 2, 1, 2, 1, 2], label: 'Brute_Force' }
    ];
    
    console.log('✅ Test data prepared:', minimalData.length, 'samples');
    
    // Start training
    console.log('\n4. Starting training...');
    const result = await detector.trainModel(minimalData);
    console.log('✅ Training completed:', result);
    
  } catch (error) {
    console.error('❌ Training failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the debug script
debugTraining().catch(console.error);