import React from 'react';
import Navigation from '../Navigation';
import OrderbookPage from '../OrderbookPage';

export default function Orderbook() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="orderbook" />
      <main>
        <OrderbookPage />
      </main>
    </div>
  );
}