import React from 'react';
import { AlertTriangle, Shield, Activity, MapPin } from 'lucide-react';
import { Threat } from '../types';
import { format } from 'date-fns';

interface ThreatMonitorProps {
  threats: Threat[];
}

export const ThreatMonitor: React.FC<ThreatMonitorProps> = ({ threats }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-500';
      case 'High': return 'bg-orange-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'Critical': return <AlertTriangle className="w-5 h-5" />;
      case 'High': return <Shield className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const recentThreats = threats.slice(0, 20);
  const criticalThreats = threats.filter(t => t.severity === 'Critical').length;
  const highThreats = threats.filter(t => t.severity === 'High').length;
  const mediumThreats = threats.filter(t => t.severity === 'Medium').length;
  const lowThreats = threats.filter(t => t.severity === 'Low').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400 text-sm font-medium">Critical Threats</p>
              <p className="text-3xl font-bold text-red-400">{criticalThreats}</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-400 text-sm font-medium">High Priority</p>
              <p className="text-3xl font-bold text-orange-400">{highThreats}</p>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <Shield className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm font-medium">Medium Priority</p>
              <p className="text-3xl font-bold text-yellow-400">{mediumThreats}</p>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <Activity className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm font-medium">Low Priority</p>
              <p className="text-3xl font-bold text-blue-400">{lowThreats}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Threat Feed */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span>Real-time Threat Detection</span>
          </h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {recentThreats.length > 0 ? recentThreats.map((threat) => (
              <div key={threat.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${getSeverityColor(threat.severity)}/20`}>
                      <div className={`text-white`}>
                        {getSeverityIcon(threat.severity)}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(threat.severity)} text-white`}>
                          {threat.severity}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {format(new Date(threat.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </span>
                      </div>
                      
                      <h4 className="font-semibold text-white mb-1">{threat.type}</h4>
                      <p className="text-gray-300 text-sm mb-2">{threat.description}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <span>Source: {threat.source}</span>
                        <span>→</span>
                        <span>Dest: {threat.destination}</span>
                        {threat.location && (
                          <>
                            <MapPin className="w-4 h-4" />
                            <span>{threat.location}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          Classification: <span className="text-white">{threat.classification}</span>
                        </span>
                        <span className="text-sm text-gray-400">
                          Confidence: <span className="text-white">{(threat.confidence * 100).toFixed(1)}%</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    threat.status === 'Active' ? 'bg-red-500/20 text-red-400' :
                    threat.status === 'Investigating' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {threat.status}
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-400">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No threats detected. System is monitoring...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};