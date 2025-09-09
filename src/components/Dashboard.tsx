import React, { useState, useEffect } from 'react';
import { ThreatMonitor } from './ThreatMonitor';
import { AlertPanel } from './AlertPanel';
import { ModelTraining } from './ModelTraining';
import { SystemControls } from './SystemControls';
import { NetworkMetrics } from './NetworkMetrics';
import { UserManagement } from './UserManagement';
import { Shield, Activity, Bell, Brain, Settings, Users } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';
import { Threat, Alert, SystemStatus } from '../types';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('monitor');
  const [threats, setThreats] = useState<Threat[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    isScanning: false,
    threatsDetected: 0,
    systemHealth: 'Good',
    lastUpdate: new Date(),
    activeIncidents: 0
  });
  
  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    // Load initial data
    loadThreats();
    loadAlerts();
    loadSystemStatus();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('new_threat', (threat: Threat) => {
        setThreats(prev => [threat, ...prev.slice(0, 99)]);
      });

      socket.on('new_alert', (alert: Alert) => {
        setAlerts(prev => [alert, ...prev]);
      });

      socket.on('system_status', (status: SystemStatus) => {
        setSystemStatus(status);
      });
    }
  }, [socket]);

  const loadThreats = async () => {
    try {
      const data = await api.getThreats();
      setThreats(data);
    } catch (error) {
      console.error('Failed to load threats:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  const loadSystemStatus = async () => {
    try {
      const status = await api.getSystemStatus();
      setSystemStatus(status);
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  const tabs = [
    { id: 'monitor', label: 'Threat Monitor', icon: Shield },
    { id: 'metrics', label: 'Network Metrics', icon: Activity },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'model', label: 'ML Model', icon: Brain },
    { id: 'controls', label: 'System Controls', icon: Settings },
    { id: 'users', label: 'User Management', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold">CyberSecure Hospital Defense</h1>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            {/* System Health */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                systemStatus.systemHealth === 'Good' ? 'bg-green-400' :
                systemStatus.systemHealth === 'Warning' ? 'bg-yellow-400' : 'bg-red-400'
              }`}></div>
              <span className="text-sm">System {systemStatus.systemHealth}</span>
            </div>
            
            {/* Stats */}
            <div className="flex items-center space-x-6 text-sm">
              <div>
                <span className="text-gray-400">Threats: </span>
                <span className="text-red-400 font-semibold">{systemStatus.threatsDetected}</span>
              </div>
              <div>
                <span className="text-gray-400">Active: </span>
                <span className="text-yellow-400 font-semibold">{systemStatus.activeIncidents}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-300 hover:text-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {activeTab === 'monitor' && <ThreatMonitor threats={threats} />}
        {activeTab === 'metrics' && <NetworkMetrics />}
        {activeTab === 'alerts' && <AlertPanel alerts={alerts} onAcknowledge={loadAlerts} />}
        {activeTab === 'model' && <ModelTraining />}
        {activeTab === 'controls' && <SystemControls systemStatus={systemStatus} onStatusChange={loadSystemStatus} />}
        {activeTab === 'users' && <UserManagement />}
      </div>
    </div>
  );
};