const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class Threat {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.timestamp = data.timestamp || new Date();
    this.type = data.type;
    this.severity = data.severity;
    this.source_ip = data.source_ip || data.source;
    this.destination_ip = data.destination_ip || data.destination;
    this.source_port = data.source_port || data.sourcePort;
    this.destination_port = data.destination_port || data.destinationPort;
    this.protocol = data.protocol;
    this.packet_size = data.packet_size || data.packetSize;
    this.description = data.description;
    this.classification = data.classification;
    this.confidence = data.confidence;
    this.status = data.status || 'active';
    this.location = data.location;
    this.network_interface = data.network_interface || data.networkInterface;
    this.raw_packet_data = data.raw_packet_data || data.rawPacketData;
    this.features = data.features;
    this.alert_sent = data.alert_sent || data.alertSent || false;
    this.created_at = data.created_at || data.createdAt;
    this.updated_at = data.updated_at || data.updatedAt;
  }

  // Convert to database format
  toDatabase() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: this.type,
      severity: this.severity,
      source_ip: this.source_ip,
      destination_ip: this.destination_ip,
      source_port: this.source_port,
      destination_port: this.destination_port,
      protocol: this.protocol,
      packet_size: this.packet_size,
      description: this.description,
      classification: this.classification,
      confidence: this.confidence,
      status: this.status,
      location: this.location,
      network_interface: this.network_interface,
      raw_packet_data: this.raw_packet_data,
      features: this.features,
      alert_sent: this.alert_sent
    };
  }

  // Convert to API format (camelCase)
  toAPI() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: this.type,
      severity: this.severity,
      source: this.source_ip,
      destination: this.destination_ip,
      sourcePort: this.source_port,
      destinationPort: this.destination_port,
      protocol: this.protocol,
      packetSize: this.packet_size,
      description: this.description,
      classification: this.classification,
      confidence: this.confidence,
      status: this.status,
      location: this.location,
      networkInterface: this.network_interface,
      rawPacketData: this.raw_packet_data,
      features: this.features,
      alertSent: this.alert_sent,
      createdAt: this.created_at,
      updatedAt: this.updated_at
    };
  }

  // Save threat to database
  async save() {
    try {
      const threatData = this.toDatabase();
      
      if (this.created_at) {
        // Update existing threat
        const { data, error } = await supabase
          .from('threats')
          .update(threatData)
          .eq('id', this.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Update instance with returned data
        Object.assign(this, data);
        return this;
      } else {
        // Create new threat
        const { data, error } = await supabase
          .from('threats')
          .insert(threatData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Update instance with returned data
        Object.assign(this, data);
        return this;
      }
    } catch (error) {
      console.error('Error saving threat:', error);
      throw error;
    }
  }

  // Static methods
  static async findAll(limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('threats')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      
      return data.map(threatData => new Threat(threatData));
    } catch (error) {
      console.error('Error finding threats:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('threats')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return new Threat(data);
    } catch (error) {
      console.error('Error finding threat by ID:', error);
      throw error;
    }
  }

  static async findBySeverity(severity) {
    try {
      const { data, error } = await supabase
        .from('threats')
        .select('*')
        .eq('severity', severity)
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      return data.map(threatData => new Threat(threatData));
    } catch (error) {
      console.error('Error finding threats by severity:', error);
      throw error;
    }
  }

  static async findByStatus(status) {
    try {
      const { data, error } = await supabase
        .from('threats')
        .select('*')
        .eq('status', status)
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      return data.map(threatData => new Threat(threatData));
    } catch (error) {
      console.error('Error finding threats by status:', error);
      throw error;
    }
  }

  static async countAll() {
    try {
      const { count, error } = await supabase
        .from('threats')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      return count;
    } catch (error) {
      console.error('Error counting threats:', error);
      throw error;
    }
  }

  static async countByStatus(status) {
    try {
      const { count, error } = await supabase
        .from('threats')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      
      if (error) throw error;
      
      return count;
    } catch (error) {
      console.error('Error counting threats by status:', error);
      throw error;
    }
  }

  static async deleteById(id) {
    try {
      const { error } = await supabase
        .from('threats')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error deleting threat:', error);
      throw error;
    }
  }

  // Instance method to delete
  async delete() {
    return Threat.deleteById(this.id);
  }

  // Update instance
  async update(updates) {
    try {
      // Apply updates to instance
      Object.keys(updates).forEach(key => {
        this[key] = updates[key];
      });

      // Save to database
      return await this.save();
    } catch (error) {
      console.error('Error updating threat:', error);
      throw error;
    }
  }
}

module.exports = Threat;