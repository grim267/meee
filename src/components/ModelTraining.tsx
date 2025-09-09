import React, { useState } from 'react';
import { Brain, Upload, CheckCircle, AlertCircle, BarChart } from 'lucide-react';
import { api } from '../services/api';

export const ModelTraining: React.FC = () => {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingResult, setTrainingResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      setTrainingResult(null);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleTraining = async () => {
    if (!selectedFile) {
      alert('Please select a CSV file first');
      return;
    }

    setIsTraining(true);
    try {
      const result = await api.uploadTrainingData(selectedFile);
      setTrainingResult(result);
    } catch (error) {
      console.error('Training failed:', error);
      setTrainingResult({ success: false, error: 'Training failed' });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Model Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm font-medium">Model Status</p>
              <p className="text-xl font-bold text-blue-400">Active</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Brain className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm font-medium">Accuracy</p>
              <p className="text-xl font-bold text-green-400">94.2%</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <BarChart className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-400 text-sm font-medium">Samples Trained</p>
              <p className="text-xl font-bold text-purple-400">15,847</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <CheckCircle className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Training Interface */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Brain className="w-5 h-5 text-blue-400" />
            <span>Random Forest Model Training</span>
          </h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload Training Data (CSV Format)
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                {selectedFile && (
                  <span className="text-green-400 text-sm">
                    Selected: {selectedFile.name}
                  </span>
                )}
              </div>
            </div>

            {/* CSV Format Guide */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-2">CSV Format Requirements</h4>
              <div className="text-sm text-gray-300 space-y-2">
                <p>Your CSV file should contain the following columns:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><code className="bg-gray-600 px-1 rounded">source_ip</code> - Source IP address</li>
                  <li><code className="bg-gray-600 px-1 rounded">dest_ip</code> - Destination IP address</li>
                  <li><code className="bg-gray-600 px-1 rounded">source_port</code> - Source port number</li>
                  <li><code className="bg-gray-600 px-1 rounded">dest_port</code> - Destination port number</li>
                  <li><code className="bg-gray-600 px-1 rounded">protocol</code> - Network protocol (TCP/UDP/ICMP)</li>
                  <li><code className="bg-gray-600 px-1 rounded">packet_size</code> - Size of the packet</li>
                  <li><code className="bg-gray-600 px-1 rounded">duration</code> - Connection duration</li>
                  <li><code className="bg-gray-600 px-1 rounded">threat_type</code> - Type of threat (Malware, DDoS, Intrusion, Phishing, Normal)</li>
                </ul>
              </div>
            </div>

            {/* Training Button */}
            <button
              onClick={handleTraining}
              disabled={!selectedFile || isTraining}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Brain className="w-5 h-5" />
              <span>{isTraining ? 'Training Model...' : 'Train Model'}</span>
            </button>

            {/* Training Results */}
            {trainingResult && (
              <div className={`rounded-lg p-4 ${
                trainingResult.success ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {trainingResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  <h4 className={`font-semibold ${trainingResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    Training {trainingResult.success ? 'Completed' : 'Failed'}
                  </h4>
                </div>
                
                {trainingResult.success ? (
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>• Samples processed: {trainingResult.samplesProcessed}</p>
                    <p>• Model accuracy: {trainingResult.accuracy}%</p>
                    <p>• Training time: {trainingResult.trainingTime}s</p>
                    <p className="text-green-400">Model is now active and learning from new threats!</p>
                  </div>
                ) : (
                  <p className="text-sm text-red-400">{trainingResult.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Model Performance */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Model Performance Metrics</h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-300">Classification Accuracy</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Malware Detection</span>
                  <span className="text-green-400">96.8%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-400 h-2 rounded-full" style={{ width: '96.8%' }}></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>DDoS Detection</span>
                  <span className="text-green-400">94.2%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-400 h-2 rounded-full" style={{ width: '94.2%' }}></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Intrusion Detection</span>
                  <span className="text-yellow-400">89.1%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '89.1%' }}></div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-300">Response Times</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Average Detection Time</span>
                  <span className="text-blue-400">0.3ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Classification Time</span>
                  <span className="text-blue-400">1.2ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Alert Generation</span>
                  <span className="text-blue-400">0.8ms</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total Response Time</span>
                  <span className="text-green-400">2.3ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};