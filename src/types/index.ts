export interface Threat {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  source: string;
  destination: string;
  description: string;
  classification: string;
  confidence: number;
  status: 'Active' | 'Resolved' | 'Investigating';
  location?: string;
}

export interface Alert {
  id: string;
  threat: Threat;
  timestamp: Date;
  acknowledged: boolean;
  assignedTo?: string;
  notes?: string;
}

export interface ModelData {
  features: number[];
  label: string;
  timestamp: Date;
}

export interface SystemStatus {
  isScanning: boolean;
  threatsDetected: number;
  systemHealth: 'Good' | 'Warning' | 'Critical';
  lastUpdate: Date;
  activeIncidents: number;
}

export interface NetworkMetrics {
  timestamp: Date;
  inboundTraffic: number;
  outboundTraffic: number;
  suspiciousConnections: number;
  blockedAttempts: number;
}