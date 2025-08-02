import React from 'react';
import Navigation from '../Navigation';
import UserOrderPage from '../UserOrderPage';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="user-order" />
      <main>
        <UserOrderPage />
      </main>
    </div>
  );
} 