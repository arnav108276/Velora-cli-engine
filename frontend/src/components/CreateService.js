import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Server, 
  Globe, 
  Settings, 
  Database,
  Rocket,
  GitBranch
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8002';
const USER_HASH = process.env.REACT_APP_USER_HASH;

// COMMON HEADERS
const headers = {
  "Content-Type": "application/json",
  "x-user-hash": USER_HASH,
};

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
  const [developers, setDevelopers] = useState([]);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    service_type: '',
    developer_id: '',
  });

  useEffect(() => {
    fetchDevelopers();
  }, []);

  // -----------------------------
  // LOAD DEVELOPERS
  // -----------------------------
  const fetchDevelopers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/developers`, {
        headers,
      });

      const data = await response.json();

      // Prevent frontend crash
      const safeData = Array.isArray(data) ? data : [];

      setDevelopers(safeData);

      if (safeData.length > 0) {
        setFormData(prev => ({ ...prev, developer_id: safeData[0].id }));
      }
    } catch (error) {
      console.error("Failed to load developers", error);
      setDevelopers([]); // fallback
    }
  };

  // -----------------------------
  // FORM CHANGE
  // -----------------------------
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleServiceTypeSelect = (serviceType) => {
    setFormData(prev => ({ ...prev, service_type: serviceType }));
    setStep(2);
  };

  // -----------------------------
  // VALIDATE
  // -----------------------------
  const validateForm = () => {
    if (!formData.name.trim()) return toast.error("Service name required");
    if (!formData.description.trim()) return toast.error("Description required");
    if (!formData.service_type) return toast.error("Select service type");

    if (!/^[a-z0-9-]+$/.test(formData.name)) {
      return toast.error("Name must be lowercase, numbers, hyphens");
    }
    return true;
  };

  // -----------------------------
  // SUBMIT
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setCreating(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/services`, {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const service = await response.json();
        toast.success("Service created successfully!");
        navigate(`/services/${service.id}`);
      } else {
        const err = await response.json();
        toast.error(err.detail || "Failed to create service");
      }
    } catch (error) {
      console.error(error);
      toast.error("Request failed");
    } finally {
      setCreating(false);
    }
  };

  const selectedServiceType = serviceTypes.find(s => s.id === formData.service_type);

  // -------------------------------------
  // UI STARTS HERE
  // -------------------------------------
  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-center mb-8">
        <button onClick={() => navigate('/services')} className="flex items-center text-gray-600">
          <ArrowLeft className="h-5 w-5 mr-1" /> Back
        </button>
        <h1 className="text-3xl font-bold ml-4">Create New Service</h1>
      </div>

      {/* STEP VIEW */}
      {step === 1 && (
        <>
          <h2 className="text-xl font-semibold mb-6">Choose Service Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {serviceTypes.map(type => (
              <div
                key={type.id}
                className="p-6 border rounded-lg hover:border-blue-500 cursor-pointer"
                onClick={() => handleServiceTypeSelect(type.id)}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg ${type.color}`}>
                    <type.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{type.name}</h3>
                    <p className="text-gray-600">{type.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* FORM */}
          <div className="bg-white p-6 border rounded-lg">
            <form onSubmit={handleSubmit} className="space-y-6">

              <div>
                <label className="block mb-2 text-sm font-medium">Service Name</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded-lg"
                  placeholder="my-awesome-api"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded-lg"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">Developer</label>
                <select
                  name="developer_id"
                  value={formData.developer_id}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded-lg"
                  required
                >
                  {developers.map(dev => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name} ({dev.email})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full bg-blue-600 text-white py-3 rounded-lg"
              >
                {creating ? "Creating..." : "Create Service"}
              </button>

            </form>
          </div>

          {/* PREVIEW */}
          <div className="bg-white p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Preview</h3>

            {selectedServiceType && (
              <>
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-lg ${selectedServiceType.color}`}>
                    <selectedServiceType.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold">{selectedServiceType.name}</p>
                    <p className="text-gray-600">{formData.name || "Service Name"}</p>
                  </div>
                </div>

                <p className="mt-4 text-gray-700">
                  {formData.description || "Service description will appear here."}
                </p>
              </>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
