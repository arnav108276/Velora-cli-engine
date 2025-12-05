import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Server, 
  Globe, 
  Settings, 
  Database,
  Rocket,
  GitBranch,
  Package
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8002';

const serviceTypes = [
  {
    id: 'api',
    name: 'API Service',
    description: 'FastAPI or Express.js REST API with auto-scaling',
    icon: Server,
    color: 'bg-blue-500',
    features: ['REST API', 'Health checks', 'Auto-scaling', 'Metrics']
  },
  {
    id: 'frontend',
    name: 'Frontend Service',
    description: 'React, Vue, or static sites with CDN integration',
    icon: Globe,
    color: 'bg-green-500',
    features: ['CDN integration', 'SSL certificates', 'Build optimization', 'Static hosting']
  },
  {
    id: 'worker',
    name: 'Worker Service',
    description: 'Background job processing with queue integration',
    icon: Settings,
    color: 'bg-yellow-500',
    features: ['Queue integration', 'Auto-scaling', 'Job scheduling', 'Monitoring']
  },
  {
    id: 'database',
    name: 'Database Service',
    description: 'PostgreSQL, MongoDB, or Redis with persistent storage',
    icon: Database,
    color: 'bg-purple-500',
    features: ['Persistent storage', 'Automated backups', 'Scaling', 'Monitoring']
  }
];

export default function CreateService() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    service_type: '',
    developer_id: 'default-developer' // In a real app, this would come from auth
  });
  const [developers, setDevelopers] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchDevelopers();
  }, []);

  const fetchDevelopers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/developers`);
      const data = await response.json();
      setDevelopers(data);
      
      // Set first developer as default if available
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, developer_id: data[0].id }));
      }
    } catch (error) {
      console.error('Failed to fetch developers:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleServiceTypeSelect = (serviceType) => {
    setFormData(prev => ({ ...prev, service_type: serviceType }));
    setStep(2);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Service name is required');
      return false;
    }
    
    if (!formData.description.trim()) {
      toast.error('Service description is required');
      return false;
    }
    
    if (!formData.service_type) {
      toast.error('Service type is required');
      return false;
    }
    
    if (!/^[a-z0-9-]+$/.test(formData.name)) {
      toast.error('Service name must contain only lowercase letters, numbers, and hyphens');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setCreating(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const service = await response.json();
        toast.success('Service created successfully! Pipeline started.');
        navigate(`/services/${service.id}`);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create service');
      }
    } catch (error) {
      console.error('Failed to create service:', error);
      toast.error('Failed to create service');
    } finally {
      setCreating(false);
    }
  };

  const selectedServiceType = serviceTypes.find(type => type.id === formData.service_type);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center mb-8">
        <button
          onClick={() => navigate('/services')}
          className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back to Services
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Service</h1>
          <p className="text-gray-600 mt-1">Deploy a new service with automated CI/CD pipeline</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
            step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          } font-semibold`}>
            1
          </div>
          <div className={`flex-1 h-1 mx-4 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
            step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          } font-semibold`}>
            2
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-sm text-gray-600">Choose Service Type</span>
          <span className="text-sm text-gray-600">Configure Service</span>
        </div>
      </div>

      {step === 1 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Choose Service Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {serviceTypes.map((type) => (
              <div
                key={type.id}
                onClick={() => handleServiceTypeSelect(type.id)}
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group"
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg ${type.color} group-hover:scale-110 transition-transform`}>
                    <type.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{type.name}</h3>
                    <p className="text-gray-600 mb-4">{type.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {type.features.map((feature, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="flex items-center mb-6">
            <button
              onClick={() => setStep(1)}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">Configure Service</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Service Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Service Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="my-awesome-service"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use lowercase letters, numbers, and hyphens only
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe what this service does..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Developer */}
                <div>
                  <label htmlFor="developer_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Developer
                  </label>
                  <select
                    id="developer_id"
                    name="developer_id"
                    value={formData.developer_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {developers.map((developer) => (
                      <option key={developer.id} value={developer.id}>
                        {developer.name} ({developer.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Creating Service...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-5 w-5 mr-2" />
                      Create Service
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Preview</h3>
              
              {selectedServiceType && (
                <div className="space-y-4">
                  {/* Service Type */}
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${selectedServiceType.color}`}>
                      <selectedServiceType.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedServiceType.name}</p>
                      <p className="text-sm text-gray-600">{formData.name || 'Service Name'}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      {formData.description || 'Service description will appear here'}
                    </p>
                  </div>

                  {/* What Will Be Created */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">What will be created:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <GitBranch className="h-4 w-4" />
                        <span>GitHub repository with starter code</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Docker className="h-4 w-4" />
                        <span>Docker image and container setup</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Settings className="h-4 w-4" />
                        <span>CI/CD pipeline with Jenkins</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Rocket className="h-4 w-4" />
                        <span>Kubernetes deployment</span>
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Included features:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedServiceType.features.map((feature, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}