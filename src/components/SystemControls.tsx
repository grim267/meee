import React from 'react';
import { Play, Square, Settings, Shield, Activity, RefreshCw, Brain } from 'lucide-react';
import { SystemStatus } from '../types';
import { api } from '../services/api';

interface SystemControlsProps {
  systemStatus: SystemStatus;
  onStatusChange: () => void;
}

export const SystemControls: React.FC<SystemControlsProps> = ({ systemStatus, onStatusChange }) => {
  const handleStartScanning = async () => {
    try {
      await api.startScanning();
      onStatusChange();
    } catch (error) {
      console.error('Failed to start scanning:', error);
    }
  };

  const handleStopScanning = async () => {
    try {
      await api.stopScanning();
      onStatusChange();
    } catch (error) {
      console.error('Failed to stop scanning:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm font-medium">Scanning Status</p>
              <p className="text-xl font-bold text-blue-400">
                {systemStatus.isScanning ? 'Active' : 'Stopped'}
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              {systemStatus.isScanning ? (
                <Activity className="w-8 h-8 text-blue-400 animate-pulse" />
              ) : (
                <Square className="w-8 h-8 text-blue-400" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm font-medium">System Health</p>
              <p className="text-xl font-bold text-green-400">{systemStatus.systemHealth}</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Shield className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400 text-sm font-medium">Threats Detected</p>
              <p className="text-xl font-bold text-red-400">{systemStatus.threatsDetected}</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm font-medium">Active Incidents</p>
              <p className="text-xl font-bold text-yellow-400">{systemStatus.activeIncidents}</p>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <Activity className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Controls */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <span>System Controls</span>
          </h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-6">
            {/* Scanning Controls */}
            <div>
              <h4 className="font-medium text-white mb-4">Real-time Threat Scanning</h4>
              <div className="flex items-center space-x-4">
                {!systemStatus.isScanning ? (
                  <button
                    onClick={handleStartScanning}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    <span>Start Scanning</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopScanning}
                    className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Square className="w-5 h-5" />
                    <span>Stop Scanning</span>
                  </button>
                )}
                
                <button
                  onClick={onStatusChange}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Refresh Status</span>
                </button>
              </div>
              
              {systemStatus.isScanning && (
                <div className="mt-3 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                  <p className="text-green-400 text-sm flex items-center space-x-2">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span>System is actively monitoring network traffic for threats...</span>
                  </p>
                </div>
              )}
            </div>

            {/* Configuration */}
            <div className="border-t border-gray-700 pt-6">
              <h4 className="font-medium text-white mb-4">Model Learning Status</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Brain className="w-5 h-5 text-blue-400" />
                    <h5 className="font-medium text-white">Model Version</h5>
                  </div>
                  <p className="text-2xl font-bold text-blue-400">{systemStatus.modelInfo?.version || 1}</p>
                  <p className="text-sm text-gray-400">Current version</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Activity className="w-5 h-5 text-green-400" />
                    <h5 className="font-medium text-white">Samples Learned</h5>
                  </div>
                  <p className="text-2xl font-bold text-green-400">{systemStatus.modelInfo?.totalSamplesTrained || 0}</p>
                  <p className="text-sm text-gray-400">Total training data</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <RefreshCw className="w-5 h-5 text-purple-400" />
                    <h5 className="font-medium text-white">Available Data</h5>
                  </div>
                  <p className="text-2xl font-bold text-purple-400">{systemStatus.trainingDataCount || 0}</p>
                  <p className="text-sm text-gray-400">Ready for training</p>
                </div>
              </div>
              
              <h4 className="font-medium text-white mb-4">Scanning Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Scan Interval (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    defaultValue="5"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Threat Sensitivity
                  </label>
                  <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                    <option>High (Low threshold)</option>
                    <option selected>Medium (Balanced)</option>
                    <option>Low (High threshold)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Network Targets */}
            <div className="border-t border-gray-700 pt-6">
              <h4 className="font-medium text-white mb-4">Monitoring Targets</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <div>
                      <p className="text-white font-medium">Hospital Network (192.168.1.0/24)</p>
                      <p className="text-gray-400 text-sm">Primary network segment</p>
                    </div>
                  </div>
                  <span className="text-green-400 text-sm">Active</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <div>
                      <p className="text-white font-medium">Medical Devices (10.0.1.0/24)</p>
                      <p className="text-gray-400 text-sm">IoT and medical equipment</p>
                    </div>
                  </div>
                  <span className="text-green-400 text-sm">Active</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div>
                      <p className="text-white font-medium">Guest Network (172.16.0.0/24)</p>
                      <p className="text-gray-400 text-sm">Visitor and patient WiFi</p>
                    </div>
                  </div>
                  <span className="text-yellow-400 text-sm">Monitoring</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold">System Information</h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Version:</span>
                <span className="text-white">v2.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Updated:</span>
                <span className="text-white">{new Date(systemStatus.lastUpdate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Model Version:</span>
                <span className="text-white">RandomForest v1.3</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Uptime:</span>
                <span className="text-white">72h 15m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">CPU Usage:</span>
                <span className="text-green-400">12%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Memory Usage:</span>
                <span className="text-blue-400">34%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};