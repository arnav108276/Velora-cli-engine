const axios = require('axios');
const config = require('./config');

class ApiClient {
  constructor() {
    const currentConfig = config.getConfig();
    this.baseURL = currentConfig.apiUrl || 'http://localhost:8002/api';
    this.userHash = currentConfig.userHash;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30050,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Hash': this.userHash || ''
      }
    });
  }

  async createService(serviceData) {
    try {
      const response = await this.client.post('/services', serviceData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || error.message);
    }
  }

  async getServices(developerId = null) {
    try {
      const params = developerId ? { developer_id: developerId } : {};
      const response = await this.client.get('/services', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || error.message);
    }
  }

  async getService(serviceId) {
    try {
      const response = await this.client.get(`/services/${serviceId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || error.message);
    }
  }

  async deleteService(serviceId) {
    try {
      const response = await this.client.delete(`/services/${serviceId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || error.message);
    }
  }

  async getPipeline(serviceId) {
    try {
      const response = await this.client.get(`/services/${serviceId}/pipeline`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || error.message);
    }
  }

  async rollbackService(serviceId) {
    try {
      const response = await this.client.post(`/services/${serviceId}/rollback`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || error.message);
    }
  }

  async getAnalytics() {
    try {
      const response = await this.client.get('/analytics/dashboard');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || error.message);
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || error.message);
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient();

module.exports = {
  createService: (data) => apiClient.createService(data),
  getServices: (developerId) => apiClient.getServices(developerId),
  getService: (id) => apiClient.getService(id),
  deleteService: (id) => apiClient.deleteService(id),
  getPipeline: (serviceId) => apiClient.getPipeline(serviceId),
  rollbackService: (serviceId) => apiClient.rollbackService(serviceId),
  getAnalytics: () => apiClient.getAnalytics(),
  healthCheck: () => apiClient.healthCheck()
};
