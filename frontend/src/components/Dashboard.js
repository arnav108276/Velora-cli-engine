import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Users, 
  Activity, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle 
} from 'lucide-react';

const BACKEND_URL ='http://localhost:8002';
const USER_HASH = process.env.REACT_APP_USER_HASH;    // 🔥 NEW

// 🔥 Standard header for all backend calls
const getHeaders = () => ({
  "Content-Type": "application/json",
  "x-user-hash": USER_HASH
});

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/analytics/dashboard`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.total_services === 0 && data.total_developers === 0 && data.recent_activities?.length === 0) {
        console.log("Analytics data is empty, but request succeeded.");
      }

      setAnalytics(data);

    } catch (error) {
      console.error('Failed to fetch analytics:', error);

      setAnalytics({
        total_services: 0,
        total_developers: 0,
        services_by_status: {},
        services_by_type: {},
        recent_activities: []
      });
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
      change: '+12%',
      changeType: 'positive'
    },
    {
      name: 'Active Developers',
      value: analytics?.total_developers || 0,
      icon: Users,
      color: 'bg-green-500',
      change: '+5%',
      changeType: 'positive'
    },
    {
      name: 'Running Services',
      value: analytics?.services_by_status?.running || 0,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      change: '+8%',
      changeType: 'positive'
    },
    {
      name: 'Failed Deployments',
      value: analytics?.services_by_status?.failed || 0,
      icon: XCircle,
      color: 'bg-red-500',
      change: '-3%',
      changeType: 'negative'
    }
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to your Velora Developer Platform</p>
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
                  <span className="text-sm text-gray-500 ml-1">from last month</span>
                </div>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Services by Type */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Services by Type</h3>
          <div className="space-y-4">
            {Object.entries(analytics?.services_by_type || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    type === 'api' ? 'bg-blue-500' :
                    type === 'frontend' ? 'bg-green-500' :
                    type === 'worker' ? 'bg-yellow-500' :
                    'bg-purple-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Services by Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Services by Status</h3>
          <div className="space-y-4">
            {Object.entries(analytics?.services_by_status || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center">
                  {status === 'running' && <CheckCircle className="w-4 h-4 text-green-500 mr-3" />}
                  {status === 'failed' && <XCircle className="w-4 h-4 text-red-500 mr-3" />}
                  {status === 'building' && <Clock className="w-4 h-4 text-yellow-500 mr-3" />}
                  {status === 'creating' && <AlertCircle className="w-4 h-4 text-blue-500 mr-3" />}
                  <span className="text-sm font-medium text-gray-700 capitalize">{status}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
        </div>
        <div className="p-6">
          {analytics?.recent_activities?.length > 0 ? (
            <div className="space-y-4">
              {analytics.recent_activities.map((service) => (
                <div key={service.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-2 h-2 rounded-full ${
                      service.status === 'running' ? 'bg-green-500' :
                      service.status === 'failed' ? 'bg-red-500' :
                      service.status === 'building' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      <p className="text-sm text-gray-500">{service.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium capitalize ${
                      service.status === 'running' ? 'text-green-600' :
                      service.status === 'failed' ? 'text-red-600' :
                      service.status === 'building' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`}>
                      {service.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(service.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No recent activities</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
