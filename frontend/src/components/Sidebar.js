import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Server, 
  Plus, 
  Settings, 
  Users, 
  BarChart3,
  Rocket,
  Cloud
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Services', href: '/services', icon: Server },
  { name: 'Create Service', href: '/services/create', icon: Plus },
  { name: 'Admin Dashboard', href: '/admin', icon: BarChart3 }
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col bg-white shadow-lg">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Velora</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 flex-shrink-0 ${
                  isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Cloud className="h-4 w-4" />
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  );
}