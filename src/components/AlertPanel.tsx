import React from 'react';
import { Bell, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Alert } from '../types';
import { api } from '../services/api';
import { format } from 'date-fns';

interface AlertPanelProps {
  alerts: Alert[];
  onAcknowledge: () => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, onAcknowledge }) => {
  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId);
      onAcknowledge();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged);
  const acknowledgedAlerts = alerts.filter(alert => alert.acknowledged);

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400 text-sm font-medium">Unacknowledged</p>
              <p className="text-3xl font-bold text-red-400">{unacknowledgedAlerts.length}</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg">
              <Bell className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm font-medium">Acknowledged</p>
              <p className="text-3xl font-bold text-green-400">{acknowledgedAlerts.length}</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm font-medium">Total Alerts</p>
              <p className="text-3xl font-bold text-blue-400">{alerts.length}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Unacknowledged Alerts */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-red-500/20">
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-red-400 flex items-center space-x-2">
              <Bell className="w-5 h-5" />
              <span>Unacknowledged Alerts ({unacknowledgedAlerts.length})</span>
            </h3>
          </div>
          
          <div className="p-6 space-y-4">
            {unacknowledgedAlerts.map((alert) => (
              <div key={alert.id} className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        alert.threat.severity === 'Critical' ? 'bg-red-500' :
                        alert.threat.severity === 'High' ? 'bg-orange-500' :
                        alert.threat.severity === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                      } text-white`}>
                        {alert.threat.severity}
                      </span>
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400 text-sm">
                        {format(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </span>
                    </div>
                    
                    <h4 className="font-semibold text-white mb-1">{alert.threat.type}</h4>
                    <p className="text-gray-300 text-sm mb-2">{alert.threat.description}</p>
                    
                    <div className="text-sm text-gray-400">
                      <span>Source: {alert.threat.source} → Destination: {alert.threat.destination}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Acknowledge</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledged Alerts */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span>Alert History</span>
          </h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {acknowledgedAlerts.length > 0 ? acknowledgedAlerts.map((alert) => (
              <div key={alert.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600 opacity-75">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        alert.threat.severity === 'Critical' ? 'bg-red-500' :
                        alert.threat.severity === 'High' ? 'bg-orange-500' :
                        alert.threat.severity === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                      } text-white`}>
                        {alert.threat.severity}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {format(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </span>
                    </div>
                    
                    <h4 className="font-semibold text-white mb-1">{alert.threat.type}</h4>
                    <p className="text-gray-300 text-sm">{alert.threat.description}</p>
                  </div>
                  
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No acknowledged alerts yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};