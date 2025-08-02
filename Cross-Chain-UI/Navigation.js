import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const Navigation = ({ currentPage }) => {
  const router = useRouter();
  
  const pages = [
    { id: 'user-order', name: 'Create Order', icon: '📝', href: '/' },
    { id: 'orderbook', name: 'Orderbook', icon: '📊', href: '/orderbook' },
    { id: 'process', name: 'Track Orders', icon: '📈', href: '/process' }
  ];

  const getCurrentPage = () => {
    if (router.pathname === '/') return 'user-order';
    if (router.pathname === '/orderbook') return 'orderbook';
    if (router.pathname === '/process') return 'process';
    return currentPage || 'user-order';
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">U</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Unite DeFi</span>
          </div>

          {/* Navigation Links */}
          <div className="flex space-x-1">
            {pages.map((page) => (
              <Link key={page.id} href={page.href}>
                <span
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    getCurrentPage() === page.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span>{page.icon}</span>
                  <span>{page.name}</span>
                </span>
              </Link>
            ))}
          </div>

          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Connected</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation; 