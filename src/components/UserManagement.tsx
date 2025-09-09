import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Mail, Shield, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'security_analyst' | 'it_manager' | 'viewer';
  alertPreferences: {
    emailEnabled: boolean;
    severityLevels: string[];
    threatTypes: string[];
    immediateAlert: boolean;
    dailySummary: boolean;
    weeklySummary: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmailResult, setTestEmailResult] = useState<any>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userData: Partial<User>) => {
    try {
      console.log('Adding user:', userData);
      const result = await api.createUser(userData);
      console.log('User creation result:', result);
      
      if (!result.success) {
        const errorMsg = result.error || 'Unknown error';
        const details = result.details ? `\nDetails: ${result.details}` : '';
        alert(`Failed to create user: ${errorMsg}${details}`);
        return;
      }
      
      setShowAddUser(false);
      loadUsers();
    } catch (error) {
      console.error('Failed to add user:', error);
      alert('Failed to add user: ' + (error.message || 'Network error'));
    }
  };

  const handleUpdateUser = async (userId: string, userData: Partial<User>) => {
    try {
      console.log('Updating user:', userId, userData);
      const result = await api.updateUser(userId, userData);
      console.log('User update result:', result);
      
      if (!result.success) {
        const errorMsg = result.error || 'Unknown error';
        const details = result.details ? `\nDetails: ${result.details}` : '';
        alert(`Failed to update user: ${errorMsg}${details}`);
        return;
      }
      
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('Failed to update user: ' + (error.message || 'Network error'));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        console.log('Deleting user:', userId);
        const result = await api.deleteUser(userId);
        console.log('User deletion result:', result);
        
        if (!result.success) {
          const errorMsg = result.error || 'Unknown error';
          const details = result.details ? `\nDetails: ${result.details}` : '';
          alert(`Failed to delete user: ${errorMsg}${details}`);
          return;
        }
        
        loadUsers();
      } catch (error) {
        console.error('Failed to delete user:', error);
        alert('Failed to delete user: ' + (error.message || 'Network error'));
      }
    }
  };

  const handleTestEmail = async () => {
    try {
      const result = await api.testEmail();
      setTestEmailResult(result);
    } catch (error) {
      setTestEmailResult({ success: false, error: 'Failed to test email' });
    }
  };

  const handleSendTestThreat = async () => {
    try {
      const result = await api.sendTestThreatAlert();
      setTestEmailResult(result);
    } catch (error) {
      setTestEmailResult({ success: false, error: 'Failed to send test threat alert' });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'security_analyst': return 'bg-orange-500';
      case 'it_manager': return 'bg-blue-500';
      case 'viewer': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-8 h-8 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">User Management</h2>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Email Testing */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <span>Email System Testing</span>
          </h3>
        </div>
        
        <div className="p-6">
          <div className="flex space-x-4 mb-4">
            <button
              onClick={handleTestEmail}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>Test Email Configuration</span>
            </button>
            
            <button
              onClick={handleSendTestThreat}
              className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span>Send Test Threat Alert</span>
            </button>
          </div>
          
          {testEmailResult && (
            <div className={`p-4 rounded-lg ${testEmailResult.success ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
              <div className="flex items-center space-x-2">
                {testEmailResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={testEmailResult.success ? 'text-green-400' : 'text-red-400'}>
                  {testEmailResult.success ? testEmailResult.message : testEmailResult.error}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Users ({users.length})</h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-semibold text-white">{user.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getRoleColor(user.role)}`}>
                          {user.role.replace('_', ' ').toUpperCase()}
                        </span>
                        {!user.isActive && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-500 text-white">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm">{user.email}</p>
                      
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-400">
                        <span>Email Alerts: {user.alertPreferences.emailEnabled ? 'Enabled' : 'Disabled'}</span>
                        <span>Severity: {user.alertPreferences.severityLevels.join(', ')}</span>
                        <span>Immediate: {user.alertPreferences.immediateAlert ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <UserModal
          onClose={() => setShowAddUser(false)}
          onSave={handleAddUser}
          title="Add New User"
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <UserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(userData) => handleUpdateUser(editingUser.id, userData)}
          title="Edit User"
        />
      )}
    </div>
  );
};

interface UserModalProps {
  user?: User;
  onClose: () => void;
  onSave: (userData: Partial<User>) => void;
  title: string;
}

const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSave, title }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'viewer',
    isActive: user?.isActive ?? true,
    alertPreferences: {
      emailEnabled: user?.alertPreferences.emailEnabled ?? true,
      severityLevels: user?.alertPreferences.severityLevels || ['Critical', 'High'],
      threatTypes: user?.alertPreferences.threatTypes || ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'],
      immediateAlert: user?.alertPreferences.immediateAlert ?? true,
      dailySummary: user?.alertPreferences.dailySummary ?? true,
      weeklySummary: user?.alertPreferences.weeklySummary ?? false
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const severityOptions = ['Critical', 'High', 'Medium', 'Low'];
  const threatTypeOptions = ['Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
                disabled={!!user} // Disable email editing for existing users
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="viewer">Viewer</option>
                <option value="it_manager">IT Manager</option>
                <option value="security_analyst">Security Analyst</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-300">Active User</span>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <h4 className="text-lg font-medium text-white mb-4">Alert Preferences</h4>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.alertPreferences.emailEnabled}
                  onChange={(e) => setFormData({
                    ...formData,
                    alertPreferences: { ...formData.alertPreferences, emailEnabled: e.target.checked }
                  })}
                  className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-300">Enable Email Alerts</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Severity Levels</label>
                <div className="grid grid-cols-2 gap-2">
                  {severityOptions.map((severity) => (
                    <label key={severity} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.alertPreferences.severityLevels.includes(severity)}
                        onChange={(e) => {
                          const levels = e.target.checked
                            ? [...formData.alertPreferences.severityLevels, severity]
                            : formData.alertPreferences.severityLevels.filter(l => l !== severity);
                          setFormData({
                            ...formData,
                            alertPreferences: { ...formData.alertPreferences, severityLevels: levels }
                          });
                        }}
                        className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300 text-sm">{severity}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.alertPreferences.immediateAlert}
                    onChange={(e) => setFormData({
                      ...formData,
                      alertPreferences: { ...formData.alertPreferences, immediateAlert: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-300 text-sm">Immediate Alerts</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.alertPreferences.dailySummary}
                    onChange={(e) => setFormData({
                      ...formData,
                      alertPreferences: { ...formData.alertPreferences, dailySummary: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-300 text-sm">Daily Summary</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.alertPreferences.weeklySummary}
                    onChange={(e) => setFormData({
                      ...formData,
                      alertPreferences: { ...formData.alertPreferences, weeklySummary: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-300 text-sm">Weekly Summary</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};