const API_BASE = 'http://localhost:3001/api';

export const api = {
  // Threats
  getThreats: async () => {
    const response = await fetch(`${API_BASE}/threats`);
    return response.json();
  },

  // Alerts
  getAlerts: async () => {
    const response = await fetch(`${API_BASE}/alerts`);
    return response.json();
  },

  acknowledgeAlert: async (alertId: string) => {
    const response = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
    return response.json();
  },

  // Model Training
  uploadTrainingData: async (file: File) => {
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_BASE}/model/train`, {
        method: 'POST',
        body: formData,
      });
      return response.json();
    } else {
      const response = await fetch(`${API_BASE}/model/train`, {
        method: 'POST',
      });
      return response.json();
    }
  },

  trainModel: async () => {
    const response = await fetch(`${API_BASE}/model/train`, {
      method: 'POST',
    });
    return response.json();
  },

  // System Control
  startScanning: async () => {
    const response = await fetch(`${API_BASE}/system/start-scan`, {
      method: 'POST',
    });
    return response.json();
  },

  stopScanning: async () => {
    const response = await fetch(`${API_BASE}/system/stop-scan`, {
      method: 'POST',
    });
    return response.json();
  },

  getSystemStatus: async () => {
    const response = await fetch(`${API_BASE}/system/status`);
    return response.json();
  },

  // Network Metrics
  getNetworkMetrics: async () => {
    const response = await fetch(`${API_BASE}/metrics/network`);
    return response.json();
  }
};