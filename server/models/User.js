const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class User {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.email = data.email || '';
    this.full_name = data.full_name || data.name || '';
    this.username = data.username || data.email || '';
    this.role = data.role || 'viewer';
    this.role_level = data.role_level || 4;
    this.password_hash = data.password_hash || '';
    this.alert_preferences = data.alert_preferences || data.alertPreferences || JSON.stringify({
      emailEnabled: true,
      severityLevels: ['Critical', 'High'],
      threatTypes: ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'],
      immediateAlert: true,
      dailySummary: true,
      weeklySummary: false
    });
    this.is_active = data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true);
    this.last_login = data.last_login || data.lastLogin;
    this.created_at = data.created_at || data.createdAt;
    this.updated_at = data.updated_at || data.updatedAt;
    this.failed_login_attempts = data.failed_login_attempts || 0;
    this.account_locked_until = data.account_locked_until;
  }

  // Convert to database format
  toDatabase() {
    return {
      id: this.id,
      email: this.email,
      full_name: this.full_name,
      username: this.username,
      role: this.role,
      role_level: this.role_level,
      password_hash: this.password_hash,
      is_active: this.is_active,
      last_login: this.last_login,
      failed_login_attempts: this.failed_login_attempts,
      account_locked_until: this.account_locked_until
    };
  }

  // Convert to API format (camelCase)
  toAPI() {
    let alertPreferences;
    try {
      alertPreferences = typeof this.alert_preferences === 'string' 
        ? JSON.parse(this.alert_preferences) 
        : this.alert_preferences;
    } catch (e) {
      alertPreferences = {
        emailEnabled: true,
        severityLevels: ['Critical', 'High'],
        threatTypes: ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'],
        immediateAlert: true,
        dailySummary: true,
        weeklySummary: false
      };
    }

    return {
      id: this.id,
      email: this.email,
      name: this.full_name,
      role: this.role,
      alertPreferences: alertPreferences,
      isActive: this.is_active,
      lastLogin: this.last_login,
      createdAt: this.created_at,
      updatedAt: this.updated_at
    };
  }

  // Save user to database
  async save() {
    try {
      const userData = this.toDatabase();
      console.log('Saving user data to database:', userData);
      
      if (this.created_at) {
        // Update existing user
        const { data, error } = await supabase
          .from('users')
          .update(userData)
          .eq('id', this.id)
          .select()
          .single();
        
        if (error) {
          console.error('Error updating user:', error);
          throw error;
        }
        
        // Update instance with returned data
        Object.assign(this, data);
        return this;
      } else {
        // Create new user
        const { data, error } = await supabase
          .from('users')
          .insert(userData)
          .select()
          .single();
        
        if (error) {
          console.error('Error creating user:', error);
          throw error;
        }
        
        console.log('User created successfully:', data);
        // Update instance with returned data
        Object.assign(this, data);
        return this;
      }
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  // Static methods
  static async findAll() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(userData => new User(userData));
    } catch (error) {
      console.error('Error finding users:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return new User(data);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return new User(data);
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findByRole(role) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', role)
        .eq('is_active', true);
      
      if (error) throw error;
      
      return data.map(userData => new User(userData));
    } catch (error) {
      console.error('Error finding users by role:', error);
      throw error;
    }
  }

  static async countByRole(role) {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', role);
      
      if (error) throw error;
      
      return count;
    } catch (error) {
      console.error('Error counting users by role:', error);
      throw error;
    }
  }

  static async deleteById(id) {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Instance method to delete
  async delete() {
    return User.deleteById(this.id);
  }

  // Update instance
  async update(updates) {
    try {
      // Apply updates to instance
      Object.keys(updates).forEach(key => {
        if (key === 'alertPreferences') {
          this.alert_preferences = updates[key];
        } else if (key === 'isActive') {
          this.is_active = updates[key];
        } else {
          this[key] = updates[key];
        }
      });

      // Save to database
      return await this.save();
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }
}

module.exports = User;