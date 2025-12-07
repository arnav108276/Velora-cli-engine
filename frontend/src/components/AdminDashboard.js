import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Server, 
  Activity, 
  TrendingUp, 
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:8002';
const USER_HASH = process.env.REACT_APP_USER_HASH;    // 🔥 NEW

// 🔥 This will be added to every API call
const getHeaders = () => ({
  "Content-Type": "application/json",
  "x-user-hash": USER_HASH
});

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [services, setServices] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {

      const [analyticsRes, servicesRes, developersRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/analytics/dashboard`, { headers: getHeaders() }),
        fetch(`${BACKEND_URL}/api/services`, { headers: getHeaders() }),
        fetch(`${BACKEND_URL}/api/developers`, { headers: getHeaders() })
      ]);

      // 🔥 If wrong or missing hash → backend returns 400/401
      if (!analyticsRes.ok || !servicesRes.ok || !developersRes.ok) {
        console.error("❌ Unauthorized – check your REACT_APP_USER_HASH");
        return;
      }

      const [analyticsData, servicesData, developersData] = await Promise.all([
        analyticsRes.json(),
        servicesRes.json(),
        developersRes.json()
      ]);

      setAnalytics(analyticsData);
      setServices(servicesData);
      setDevelopers(developersData);

    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Services',
      value: analytics?.total_services || 0,
      icon: Server,
      color: 'bg-blue-500',
      //change: '+12%',
      changeType: 'positive'
    },
    {
      name: 'Active Developers',
      value: analytics?.total_developers || 0,
      icon: Users,
      color: 'bg-green-500',
      //change: '+5%',
      changeType: 'positive'
    },
    {
      name: 'Monthly Deployments',
      value: services.length,
      icon: Activity,
      color: 'bg-purple-500',
      //change: '+18%',
      changeType: 'positive'
    },
    {
      name: 'Success Rate',
      value: analytics?.services_by_status?.running ? 
        Math.round((analytics.services_by_status.running / analytics.total_services) * 100) + '%' : 
        '100%',
      icon: CheckCircle,
      color: 'bg-emerald-500',
      //change: '+2%',
      changeType: 'positive'
    }
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'building':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'creating':
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Monitor platform usage and performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-1"> </span>
                </div>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SERVICES & DEVELOPER ACTIVITY BELOW — unchanged */}
      {/* (your entire UI remains exactly the same) */}

      {/* --- SERVICES OVERVIEW + DEVELOPER ACTIVITY + RECENT SERVICES --- */}

      {/* leaving all your UI code unchanged for readability */}
      {/* your entire bottom UI is exactly same as original */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Services Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Services Overview</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">By Status</h4>
              {Object.entries(analytics?.services_by_status || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    {getStatusIcon(status)}
                    <span className="text-sm text-gray-700 ml-2 capitalize">{status}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">By Type</h4>
              {Object.entries(analytics?.services_by_type || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      type === 'api' ? 'bg-blue-500' :
                      type === 'frontend' ? 'bg-green-500' :
                      type === 'worker' ? 'bg-yellow-500' :
                      'bg-purple-500'
                    }`}></div>
                    <span className="text-sm text-gray-700 capitalize">{type}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Developer Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Developer Activity</h3>
          <div className="space-y-4">
            {developers.slice(0, 5).map((developer) => {
              const developerServices = services.filter(s => s.developer_id === developer.id);
              return (
                <div key={developer.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {developer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{developer.name}</p>
                      <p className="text-xs text-gray-500">{developer.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{developerServices.length}</p>
                    <p className="text-xs text-gray-500">services</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Services */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Services</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="bg-white divide-y divide-gray-200">
              {services.slice(0, 10).map((service) => {
                const developer = developers.find(d => d.id === service.developer_id);
                return (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{service.name}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">{service.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">{service.service_type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{developer?.name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{developer?.email || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(service.status)}
                        <span className="text-sm text-gray-900 ml-2 capitalize">{service.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(service.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
