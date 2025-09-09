const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class Alert {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.threat_id = data.threat_id || data.threatId;
    this.threat_data = data.threat_data || data.threat || data.threatData;
    this.timestamp = data.timestamp || new Date();
    this.acknowledged = data.acknowledged || false;
    this.acknowledged_by = data.acknowledged_by || data.acknowledgedBy;
    this.acknowledged_at = data.acknowledged_at || data.acknowledgedAt;
    this.assigned_to = data.assigned_to || data.assignedTo;
    this.notes = data.notes;
    this.email_sent = data.email_sent || data.emailSent || false;
    this.escalated = data.escalated || false;
    this.created_at = data.created_at || data.createdAt;
    this.updated_at = data.updated_at || data.updatedAt;
  }

  // Convert to database format
  toDatabase() {
    return {
      id: this.id,
      threat_id: this.threat_id,
      threat_data: this.threat_data,
      timestamp: this.timestamp,
      acknowledged: this.acknowledged,
      acknowledged_by: this.acknowledged_by,
      acknowledged_at: this.acknowledged_at,
      assigned_to: this.assigned_to,
      notes: this.notes,
      email_sent: this.email_sent,
      escalated: this.escalated
    };
  }

  // Convert to API format (camelCase)
  toAPI() {
    return {
      id: this.id,
      threatId: this.threat_id,
      threat: this.threat_data,
      timestamp: this.timestamp,
      acknowledged: this.acknowledged,
      acknowledgedBy: this.acknowledged_by,
      acknowledgedAt: this.acknowledged_at,
      assignedTo: this.assigned_to,
      notes: this.notes,
      emailSent: this.email_sent,
      escalated: this.escalated,
      createdAt: this.created_at,
      updatedAt: this.updated_at
    };
  }

  // Save alert to database
  async save() {
    try {
      const alertData = this.toDatabase();
      
      if (this.created_at) {
        // Update existing alert
        const { data, error } = await supabase
          .from('alerts')
          .update(alertData)
          .eq('id', this.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Update instance with returned data
        Object.assign(this, data);
        return this;
      } else {
        // Create new alert
        const { data, error } = await supabase
          .from('alerts')
          .insert(alertData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Update instance with returned data
        Object.assign(this, data);
        return this;
      }
    } catch (error) {
      console.error('Error saving alert:', error);
      throw error;
    }
  }

  // Static methods
  static async findAll(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return data.map(alertData => new Alert(alertData));
    } catch (error) {
      console.error('Error finding alerts:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return new Alert(data);
    } catch (error) {
      console.error('Error finding alert by ID:', error);
      throw error;
    }
  }

  static async findUnacknowledged() {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('acknowledged', false)
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      return data.map(alertData => new Alert(alertData));
    } catch (error) {
      console.error('Error finding unacknowledged alerts:', error);
      throw error;
    }
  }

  static async deleteById(id) {
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error deleting alert:', error);
      throw error;
    }
  }

  // Instance method to delete
  async delete() {
    return Alert.deleteById(this.id);
  }

  // Update instance
  async update(updates) {
    try {
      // Apply updates to instance
      Object.keys(updates).forEach(key => {
        if (key === 'acknowledgedBy') {
          this.acknowledged_by = updates[key];
        } else if (key === 'acknowledgedAt') {
          this.acknowledged_at = updates[key];
        } else if (key === 'assignedTo') {
          this.assigned_to = updates[key];
        } else if (key === 'emailSent') {
          this.email_sent = updates[key];
        } else {
          this[key] = updates[key];
        }
      });

      // Save to database
      return await this.save();
    } catch (error) {
      console.error('Error updating alert:', error);
      throw error;
    }
  }

  // Acknowledge alert
  async acknowledge(acknowledgedBy = 'System') {
    return await this.update({
      acknowledged: true,
      acknowledgedBy: acknowledgedBy,
      acknowledgedAt: new Date()
    });
  }
}

module.exports = Alert;