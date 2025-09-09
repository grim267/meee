const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class TrainingData {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.features = data.features;
    this.label = data.label;
    this.source = data.source || 'manual';
    this.validated = data.validated || false;
    this.created_at = data.created_at || data.createdAt;
    this.updated_at = data.updated_at || data.updatedAt;
  }

  // Convert to database format
  toDatabase() {
    return {
      id: this.id,
      features: this.features,
      label: this.label,
      source: this.source,
      validated: this.validated
    };
  }

  // Convert to API format (camelCase)
  toAPI() {
    return {
      id: this.id,
      features: this.features,
      label: this.label,
      source: this.source,
      validated: this.validated,
      createdAt: this.created_at,
      updatedAt: this.updated_at
    };
  }

  // Save training data to database
  async save() {
    try {
      console.log('Saving training data:', this.id, this.label);
      const trainingData = this.toDatabase();
      
      if (this.created_at) {
        // Update existing training data
        const { data, error } = await supabase
          .from('training_data')
          .update(trainingData)
          .eq('id', this.id)
          .select()
          .single();
        
        if (error) {
          console.error('Error updating training data:', error);
          throw error;
        }
        
        // Update instance with returned data
        Object.assign(this, data);
        console.log('Training data updated successfully');
        return this;
      } else {
        // Create new training data
        const { data, error } = await supabase
          .from('training_data')
          .insert(trainingData)
          .select()
          .single();
        
        if (error) {
          console.error('Error creating training data:', error);
          throw error;
        }
        
        // Update instance with returned data
        Object.assign(this, data);
        console.log('Training data created successfully');
        return this;
      }
    } catch (error) {
      console.error('Error saving training data:', error);
      throw error;
    }
  }

  // Static methods
  static async findAll(limit = 1000) {
    try {
      const { data, error } = await supabase
        .from('training_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return data.map(trainingData => new TrainingData(trainingData));
    } catch (error) {
      console.error('Error finding training data:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('training_data')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return new TrainingData(data);
    } catch (error) {
      console.error('Error finding training data by ID:', error);
      throw error;
    }
  }

  static async findByLabel(label) {
    try {
      const { data, error } = await supabase
        .from('training_data')
        .select('*')
        .eq('label', label)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(trainingData => new TrainingData(trainingData));
    } catch (error) {
      console.error('Error finding training data by label:', error);
      throw error;
    }
  }

  static async countAll() {
    try {
      const { count, error } = await supabase
        .from('training_data')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      return count;
    } catch (error) {
      console.error('Error counting training data:', error);
      throw error;
    }
  }

  static async deleteById(id) {
    try {
      const { error } = await supabase
        .from('training_data')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error deleting training data:', error);
      throw error;
    }
  }

  // Instance method to delete
  async delete() {
    return TrainingData.deleteById(this.id);
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
      console.error('Error updating training data:', error);
      throw error;
    }
  }
}

module.exports = TrainingData;