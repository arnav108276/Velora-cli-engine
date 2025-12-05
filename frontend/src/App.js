import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Services from './components/Services';
import CreateService from './components/CreateService';
import ServiceDetail from './components/ServiceDetail';
import AdminDashboard from './components/AdminDashboard';
import DeveloperManagement from './components/DeveloperManagement';
import './App.css';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/create" element={<CreateService />} />
            <Route path="/services/:serviceId" element={<ServiceDetail />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/developers" element={<DeveloperManagement />} />
          </Routes>
        </main>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;