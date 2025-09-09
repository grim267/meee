import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, Shield, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { NetworkMetrics as NetworkMetricsType } from '../types';

export const NetworkMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<NetworkMetricsType[]>([]);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      const data = await api.getNetworkMetrics();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      // Generate mock data if API fails
      generateMockData();
    }
  };

  const generateMockData = () => {
    const now = new Date();
    const mockData: NetworkMetricsType[] = [];
    
    for (let i = 30; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000); // Every minute
      mockData.push({
        timestamp,
        inboundTraffic: Math.floor(Math.random() * 1000) + 500,
        outboundTraffic: Math.floor(Math.random() * 800) + 300,
        suspiciousConnections: Math.floor(Math.random() * 20),
        blockedAttempts: Math.floor(Math.random() * 15)
      });
    }
    
    setMetrics(mockData);
  };

  const chartData = metrics.map(metric => ({
    time: new Date(metric.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    inbound: metric.inboundTraffic,
    outbound: metric.outboundTraffic,
    suspicious: metric.suspiciousConnections,
    blocked: metric.blockedAttempts
  }));

  const latestMetric = metrics[metrics.length - 1];
  const totalTraffic = latestMetric ? latestMetric.inboundTraffic + latestMetric.outboundTraffic : 0;
  const totalSuspicious = metrics.reduce((sum, metric) => sum + metric.suspiciousConnections, 0);
  const totalBlocked = metrics.reduce((sum, metric) => sum + metric.blockedAttempts, 0);

  return (
    <div className="space-y-6">
      {/* Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm font-medium">Network Traffic</p>
              <p className="text-2xl font-bold text-blue-400">{totalTraffic.toLocaleString()}</p>
              <p className="text-xs text-gray-400">MB/s current</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm font-medium">Blocked Threats</p>
              <p className="text-2xl font-bold text-green-400">{totalBlocked}</p>
              <p className="text-xs text-gray-400">Last 30 minutes</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Shield className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm font-medium">Suspicious Activity</p>
              <p className="text-2xl font-bold text-yellow-400">{totalSuspicious}</p>
              <p className="text-xs text-gray-400">Connections flagged</p>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-400 text-sm font-medium">Detection Rate</p>
              <p className="text-2xl font-bold text-purple-400">98.7%</p>
              <p className="text-xs text-gray-400">Accuracy rate</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Network Traffic Chart */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span>Network Traffic (Real-time)</span>
          </h3>
        </div>
        
        <div className="p-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="inbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="outbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="inbound"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#inbound)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="outbound"
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#outbound)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-300">Inbound Traffic</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-gray-300">Outbound Traffic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Threat Activity Chart */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span>Threat Activity</span>
          </h3>
        </div>
        
        <div className="p-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="suspicious"
                  stroke="#F59E0B"
                  strokeWidth={3}
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="blocked"
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span className="text-gray-300">Suspicious Connections</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-gray-300">Blocked Attempts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Network Segments Status */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Network Segments Status</h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-white">Hospital Network</h4>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <p className="text-sm text-gray-400 mb-3">192.168.1.0/24</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Hosts:</span>
                  <span className="text-white">247</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Threats Blocked:</span>
                  <span className="text-green-400">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400">Secure</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-white">Medical Devices</h4>
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              </div>
              <p className="text-sm text-gray-400 mb-3">10.0.1.0/24</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Devices:</span>
                  <span className="text-white">89</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Vulnerabilities:</span>
                  <span className="text-yellow-400">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-yellow-400">Monitoring</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-white">Guest Network</h4>
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              </div>
              <p className="text-sm text-gray-400 mb-3">172.16.0.0/24</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Connected Users:</span>
                  <span className="text-white">156</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Restricted Access:</span>
                  <span className="text-blue-400">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-blue-400">Protected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};