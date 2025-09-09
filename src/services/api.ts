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
  },

  // User Management
  getUsers: async () => {
    const response = await fetch(`${API_BASE}/users`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  createUser: async (userData: any) => {
    console.log('API: Creating user with data:', userData);
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    const result = await response.json();
    console.log('API: User creation response:', result);
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }
    return result;
  },

  updateUser: async (userId: string, userData: any) => {
    console.log('API: Updating user:', userId, 'with data:', userData);
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    const result = await response.json();
    console.log('API: User update response:', result);
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }
    return result;
  },

  deleteUser: async (userId: string) => {
    console.log('API: Deleting user:', userId);
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
    });
    
    const result = await response.json();
    console.log('API: User deletion response:', result);
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }
    return result;
  },

  // Email Testing
  testEmail: async () => {
    const response = await fetch(`${API_BASE}/email/test`, {
      method: 'POST',
    });
    return response.json();
  },

  sendTestThreatAlert: async () => {
    const response = await fetch(`${API_BASE}/email/send-test-threat`, {
      method: 'POST',
    });
    return response.json();
  }
};