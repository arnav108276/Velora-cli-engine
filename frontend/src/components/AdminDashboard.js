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
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Cpu,
  HardDrive,
  Network,
  Gauge
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8002';
const USER_HASH = process.env.REACT_APP_USER_HASH;
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-user-hash': USER_HASH,
});
export default function AdminDashboard() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  // Dashboard state
  const [analytics, setAnalytics] = useState(null);
  const [services, setServices] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [cloudWatchMetrics, setCloudWatchMetrics] = useState(null);
  const [podStats, setPodStats] = useState(null);
  const [costEstimate, setCostEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Time range selector
  const [timeRange, setTimeRange] = useState('1h');

  const handleAuthenticate = async (e) => {
    e.preventDefault();
    setAuthenticating(true);
    setAuthError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/authenticate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setPassword('');
        fetchDashboardData();
      } else {
        const error = await response.json();
        setAuthError(error.detail || 'Invalid password');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthError('Failed to authenticate. Please check your connection.');
    } finally {
      setAuthenticating(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [
        analyticsRes,
        servicesRes,
        developersRes,
        cloudWatchRes,
        podStatsRes,
        costRes,
      ] = await Promise.all([
        fetch(`${BACKEND_URL}/api/analytics/dashboard`, { headers: getHeaders() }),
        fetch(`${BACKEND_URL}/api/services`, { headers: getHeaders() }),
        fetch(`${BACKEND_URL}/api/developers`, { headers: getHeaders() }),
        fetch(`${BACKEND_URL}/api/admin/cloudwatch/metrics`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ time_range: timeRange }),
        }),
        fetch(`${BACKEND_URL}/api/admin/pods/stats`, { headers: getHeaders() }),
        fetch(`${BACKEND_URL}/api/admin/cost/estimate`, { headers: getHeaders() }),
      ]);

      if (analyticsRes.ok && servicesRes.ok && developersRes.ok) {
        const [analyticsData, servicesData, developersData] = await Promise.all([
          analyticsRes.json(),
          servicesRes.json(),
          developersRes.json(),
        ]);

        setAnalytics(analyticsData);
        setServices(servicesData);
        setDevelopers(developersData);
      }

      if (cloudWatchRes.ok) {
        const cloudWatchData = await cloudWatchRes.json();
        setCloudWatchMetrics(cloudWatchData);
      }

      if (podStatsRes.ok) {
        const podData = await podStatsRes.json();
        setPodStats(podData);
      }

      if (costRes.ok) {
        const costData = await costRes.json();
        setCostEstimate(costData);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
    // Refetch CloudWatch metrics with new time range
    if (isAuthenticated) {
      fetchCloudWatchMetrics(newRange);
    }
  };

  const fetchCloudWatchMetrics = async (range) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/cloudwatch/metrics`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ time_range: range }),
      });

      if (response.ok) {
        const data = await response.json();
        setCloudWatchMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch CloudWatch metrics:', error);
    }
  };
  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-100 rounded-full">
              <Lock className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
            Admin Dashboard
          </h2>
          <p className="text-center text-gray-600 mb-6">
            Enter password to access CloudWatch metrics
          </p>
          <form onSubmit={handleAuthenticate}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter admin password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{authError}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={authenticating}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authenticating ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Protected by password authentication</p>
          </div>
        </div>
      </div>
    );
  }
  // Loading screen
  if (loading && !cloudWatchMetrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }
  // Prepare chart data for CloudWatch metrics
  const prepareChartData = (metricData) => {
    if (!metricData || !metricData.timestamps || !metricData.values) return [];
    
    return metricData.timestamps.map((timestamp, index) => ({
      time: new Date(timestamp).toLocaleTimeString(),
      value: metricData.values[index]
    }));
  };
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  // Stats cards data
  const stats = [
    {
      name: 'Total Pods',
      value: podStats?.total_pods || 0,
      icon: Server,
      color: 'bg-blue-500',
      subtext: `${podStats?.running_pods || 0} running`
    }
  ];
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Cluster: {cloudWatchMetrics?.cluster_name || 'arnav-velora2'} 
            {cloudWatchMetrics?.cluster_status && (
              <span className="ml-2 text-sm text-green-600">● {cloudWatchMetrics.cluster_status}</span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Time Range Selector */}
          <div className="flex bg-white rounded-lg shadow-sm border border-gray-200">
            {['1h', '24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                } ${range === '1h' ? 'rounded-l-lg' : ''} ${range === '30d' ? 'rounded-r-lg' : ''}`}>
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.subtext}</p>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
        {/* Pod Statistics */}
        {podStats && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pod Statistics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-sm font-medium">Running</span>
                </div>
                <span className="text-lg font-bold text-green-600">{podStats.running_pods}</span>
              </div> 
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-yellow-600 mr-2" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <span className="text-lg font-bold text-yellow-600">{podStats.pending_pods}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-sm font-medium">Failed</span>
                </div>
                <span className="text-lg font-bold text-red-600">{podStats.failed_pods}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* CloudWatch Metrics Charts */}
      {cloudWatchMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        </div>
      )}
      {/* Pod Details Table (if available) */}
      {podStats?.pod_details && podStats.pod_details.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Pod Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pod Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Namespace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Containers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Node
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {podStats.pod_details.map((pod, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pod.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {pod.namespace}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        pod.status === 'Running' ? 'bg-green-100 text-green-800' :
                        pod.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {pod.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {pod.containers}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {pod.node}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Developer Management & Services Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Services by Type */}
        {analytics && analytics.services_by_type && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Services by Type</h3>
            <div className="space-y-3">
              {Object.entries(analytics.services_by_type).map(([type, count], idx) => (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    ></div>
                    <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
