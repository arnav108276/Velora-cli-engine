import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Users, 
  Mail, 
  Github, 
  Calendar,
  Shield,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8002';
const USER_HASH = process.env.REACT_APP_USER_HASH;

const headers = {
  "Content-Type": "application/json",
  "x-user-hash": USER_HASH,
};

export default function DeveloperManagement() {
  const [developers, setDevelopers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    github_username: '',
    is_admin: false
  });

  // ============================
  // LOAD DEVELOPERS + SERVICES
  // ============================

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {

      const [developersRes, servicesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/developers`, { headers }),
        fetch(`${BACKEND_URL}/api/services`, { headers })
      ]);

      // If backend returns 400/401 → handle safely
      if (!developersRes.ok || !servicesRes.ok) {
        console.error("❌ API returned an error. Most likely missing/incorrect x-user-hash.");
        setDevelopers([]);
        setServices([]);
        return;
      }

      const developersData = await developersRes.json();
      const servicesData = await servicesRes.json();

      // Safe fallback: ensure arrays
      setDevelopers(Array.isArray(developersData) ? developersData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);

    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load developers.");
      setDevelopers([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // FORM HANDLERS
  // ======================

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${BACKEND_URL}/api/developers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success("Developer created successfully.");
        setShowCreateModal(false);
        setFormData({ name: "", email: "", github_username: "", is_admin: false });
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to create developer");
      }

    } catch (error) {
      console.error("Failed to create developer:", error);
      toast.error("Failed to create developer");
    }
  };

  // ======================
  // UTILS
  // ======================

  const getDeveloperServices = (id) =>
    services.filter(s => s.developer_id === id);

  const filteredDevelopers = developers.filter(dev => {
    const term = searchTerm.toLowerCase();
    return (
      dev.name.toLowerCase().includes(term) ||
      dev.email.toLowerCase().includes(term) ||
      (dev.github_username && dev.github_username.toLowerCase().includes(term))
    );
  });

  // ======================
  // LOADING STATE
  // ======================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ======================
  // PAGE RENDER
  // ======================

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Developer Management</h1>
          <p className="text-gray-600 mt-1">Manage developers and their access</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Developer
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search developers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Developers Grid */}
      {filteredDevelopers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevelopers.map((developer) => {
            const devServices = getDeveloperServices(developer.id);

            return (
              <div key={developer.id} className="bg-white rounded-lg shadow-sm border p-6">
                
                {/* Card Header */}
                <div className="flex justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-semibold text-blue-600">
                        {developer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{developer.name}</h3>

                      {developer.is_admin && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-2" />
                    {developer.email}
                  </div>

                  {developer.github_username && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Github className="h-4 w-4 mr-2" />
                      <a
                        href={`https://github.com/${developer.github_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600"
                      >
                        {developer.github_username}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    Joined {new Date(developer.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Services</span>
                    <span className="text-sm font-semibold text-gray-900">{devServices.length}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-sm text-gray-600">Running</span>
                    <span className="text-sm font-semibold text-green-600">
                      {devServices.filter(s => s.status === 'running').length}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No developers found</p>
        </div>
      )}

      {/* Create Developer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Developer</h2>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="text-sm font-medium">GitHub Username</label>
                <input
                  type="text"
                  name="github_username"
                  value={formData.github_username}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_admin"
                  checked={formData.is_admin}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <label className="text-sm">Admin Privileges</label>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg"
                >
                  Create Developer
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
