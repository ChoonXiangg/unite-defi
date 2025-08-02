import React from 'react';
import Navigation from '../Navigation';
import ProcessPage from '../ProcessPage';

export default function Process() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="process" />
      <main>
        <ProcessPage />
      </main>
    </div>
  );
}