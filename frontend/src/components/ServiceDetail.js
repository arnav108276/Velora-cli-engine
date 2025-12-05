import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ExternalLink, 
  RefreshCw, 
  Activity, 
  GitBranch, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8002';

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchServiceDetails();
    fetchPipeline();
    
    // Poll for updates every 5 seconds if pipeline is running
    const interval = setInterval(() => {
      if (pipeline && ['pending', 'running'].includes(pipeline.status)) {
        fetchPipeline();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [serviceId, pipeline?.status]);

  const fetchServiceDetails = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/services/${serviceId}`);
      if (response.ok) {
        const data = await response.json();
        setService(data);
      } else {
        toast.error('Service not found');
        navigate('/services');
      }
    } catch (error) {
      console.error('Failed to fetch service:', error);
      toast.error('Failed to load service details');
    } finally {
      setLoading(false);
    }
  };

  const fetchPipeline = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/services/${serviceId}/pipeline`);
      if (response.ok) {
        const data = await response.json();
        setPipeline(data);
      }
    } catch (error) {
      console.error('Failed to fetch pipeline:', error);
    }
  };

  const handleRollback = async () => {
    if (!window.confirm('Are you sure you want to rollback this service?')) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/services/${serviceId}/rollback`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Rollback initiated');
        fetchPipeline();
      } else {
        toast.error('Failed to initiate rollback');
      }
    } catch (error) {
      console.error('Failed to rollback:', error);
      toast.error('Failed to initiate rollback');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${service?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/services/${serviceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Service deleted successfully');
        navigate('/services');
      } else {
        toast.error('Failed to delete service');
      }
    } catch (error) {
      console.error('Failed to delete service:', error);
      toast.error('Failed to delete service');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchServiceDetails(), fetchPipeline()]);
    setRefreshing(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'failed':
        return <XCircle className="h-6 w-6 text-red-600" />;
      case 'building':
        return <Clock className="h-6 w-6 text-yellow-600" />;
      case 'creating':
        return <AlertCircle className="h-6 w-6 text-blue-600" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'building':
        return 'bg-yellow-100 text-yellow-800';
      case 'creating':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-gray-500">Service not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/services')}
            className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to Services
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{service.name}</h1>
            <p className="text-gray-600 mt-1">{service.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleRollback}
            className="flex items-center px-3 py-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Rollback
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Status */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Service Status</h2>
              <div className="flex items-center space-x-2">
                {getStatusIcon(service.status)}
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(service.status)}`}>
                  {service.status}
                </span>
              </div>
            </div>
            
            {service.service_url && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Service URL</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={service.service_url}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg"
                  />
                  <a
                    href={service.service_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            {service.github_repo_url && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">GitHub Repository</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={service.github_repo_url}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg"
                  />
                  <a
                    href={service.github_repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                  >
                    <GitBranch className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Pipeline Status */}
          {pipeline && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Pipeline Status</h2>
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-gray-400" />
                  <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
                    pipeline.status === 'success' ? 'bg-green-100 text-green-800' :
                    pipeline.status === 'failed' ? 'bg-red-100 text-red-800' :
                    pipeline.status === 'running' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {pipeline.status}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{pipeline.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      pipeline.status === 'success' ? 'bg-green-500' :
                      pipeline.status === 'failed' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${pipeline.progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Current Stage */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Stage</label>
                <p className="text-gray-900 capitalize">{pipeline.stage.replace('_', ' ')}</p>
              </div>

              {/* Pipeline Logs */}
              {pipeline.logs && pipeline.logs.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pipeline Logs</label>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                    {pipeline.logs.map((log, index) => (
                      <div key={index} className="mb-1">
                        <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Service Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Service Type</dt>
                <dd className="text-sm text-gray-900 capitalize">{service.service_type}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(service.created_at).toLocaleDateString()} at{' '}
                  {new Date(service.created_at).toLocaleTimeString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(service.updated_at).toLocaleDateString()} at{' '}
                  {new Date(service.updated_at).toLocaleTimeString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Service ID</dt>
                <dd className="text-sm text-gray-900 font-mono">{service.id}</dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {service.service_url && (
                <a
                  href={service.service_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center w-full px-3 py-2 text-left text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Service
                </a>
              )}
              {service.github_repo_url && (
                <a
                  href={service.github_repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center w-full px-3 py-2 text-left text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <GitBranch className="h-4 w-4 mr-2" />
                  View Repository
                </a>
              )}
              <button
                onClick={handleRollback}
                className="flex items-center w-full px-3 py-2 text-left text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Rollback Service
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center w-full px-3 py-2 text-left text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}