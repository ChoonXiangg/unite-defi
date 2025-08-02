import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { config } from './config.js';

const ProcessPage = () => {
  const [wallet, setWallet] = useState(null);
  const [account, setAccount] = useState('');
  const [userOrders, setUserOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // Token options for different chains
  const tokenOptions = {
    ethereum: [
      { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        address: '0x0000000000000000000000000000000000000000', 
        decimals: 18,
        logo: '🔵',
        chain: 'ethereum'
      },
      { 
        symbol: 'WETH', 
        name: 'Wrapped Ethereum', 
        address: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', 
        decimals: 18,
        logo: '🔵',
        chain: 'ethereum'
      },
      { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 
        decimals: 6,
        logo: '💵',
        chain: 'ethereum'
      },
      { 
        symbol: 'DAI', 
        name: 'Dai Stablecoin', 
        address: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', 
        decimals: 18,
        logo: '💵',
        chain: 'ethereum'
      }
    ],
    etherlink: [
      { 
        symbol: 'XTZ', 
        name: 'Tezos', 
        address: '0x0000000000000000000000000000000000000000', 
        decimals: 18,
        logo: '🟣',
        chain: 'etherlink'
      },
      { 
        symbol: 'WXTZ', 
        name: 'Wrapped Tezos', 
        address: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', 
        decimals: 18,
        logo: '🟣',
        chain: 'etherlink'
      },
      { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 
        decimals: 6,
        logo: '💵',
        chain: 'etherlink'
      },
      { 
        symbol: 'DAI', 
        name: 'Dai Stablecoin', 
        address: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', 
        decimals: 18,
        logo: '💵',
        chain: 'etherlink'
      }
    ]
  };

  // Connect wallet
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        setWallet(signer);
        setAccount(accounts[0]);
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  // Fetch user orders
  const fetchUserOrders = async () => {
    if (!account) return;
    
    try {
      console.log('Fetching user orders for account:', account);
      const response = await fetch(`${config.RELAYER_API_URL}/api/orders?user=${account}`);
      const data = await response.json();
      console.log('User orders API response:', data);
      setUserOrders(data.orders || []);
      console.log('User orders set:', data.orders || []);
    } catch (error) {
      console.error('Error fetching user orders:', error);
      console.error('⚠️ Cannot connect to relayer server. Please start the relayer first:');
      console.error('   cd Relayer && node server.js');
      setUserOrders([]); // Show empty orders instead of mock data
    }
  };

  useEffect(() => {
    if (account) {
      fetchUserOrders();
    }
  }, [account]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'executed': return 'text-green-600 bg-green-100';
      case 'completed': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get progress steps for an order
  const getProgressSteps = (order) => {
    const steps = [
      { name: 'Order Created', status: 'completed' },
      { name: 'Order Executed', status: order.status === 'pending' ? 'pending' : 'completed' },
      { name: 'Escrow Locked', status: order.status === 'executed' ? 'completed' : 'pending' },
      { name: 'Secret Provided', status: order.secretProvided ? 'completed' : 'pending' },
      { name: 'Swap Completed', status: order.status === 'completed' ? 'completed' : 'pending' }
    ];
    return steps;
  };

  // Provide secret to relayer
  const provideSecret = async (order) => {
    if (!secret.trim()) {
      alert('Please enter a secret');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.RELAYER_API_URL}/api/provide-secret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: order.id,
          secret: secret,
          userAddress: account
        })
      });

      const result = await response.json();
      if (result.success) {
        setStatus('Secret provided successfully!');
        setUserOrders(prev => prev.map(o => 
          o.id === order.id ? { ...o, secretProvided: true, status: 'completed' } : o
        ));
        setSecret('');
      } else {
        setStatus('Error providing secret: ' + result.error);
      }
    } catch (error) {
      console.error('Error providing secret:', error);
      setStatus('Error providing secret: ' + error.message);
    }
    setLoading(false);
  };

  // Verify escrow locks
  const verifyEscrowLocks = async (order) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/verify-escrow?orderId=${order.id}`);
      const result = await response.json();
      
      if (result.locked) {
        setStatus('Escrow is locked and ready for secret exchange');
      } else {
        setStatus('Escrow is not yet locked');
      }
    } catch (error) {
      console.error('Error verifying escrow:', error);
      setStatus('Error verifying escrow: ' + error.message);
    }
    setLoading(false);
  };

  // Get token symbol by address
  const getTokenSymbol = (address, chain) => {
    const tokens = tokenOptions[chain] || [];
    const token = tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token ? `${token.logo} ${token.symbol}` : 'Unknown';
  };

  // Get token name by address
  const getTokenName = (address, chain) => {
    const tokens = tokenOptions[chain] || [];
    const token = tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token ? token.name : 'Unknown Token';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Track Orders</h1>
          <p className="text-gray-600">Monitor your cross-chain swap progress</p>
          <button
            onClick={fetchUserOrders}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            🔄 Refresh My Orders
          </button>
        </div>

        {/* Connection Status */}
        {account && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <span className="text-green-800 font-medium">
                Connected: {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            </div>
          </div>
        )}

        {/* Wallet Connection */}
        {!account && (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
            <button
              onClick={connectWallet}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Connect Wallet to Track Orders
            </button>
          </div>
        )}

        {/* Orders List */}
        {account && (
          <div className="space-y-6">
            {userOrders.map((order) => {
              const fromTokenSymbol = getTokenSymbol(order.fromToken, order.fromChain);
              const toTokenSymbol = getTokenSymbol(order.toToken, order.toChain);
              
              // Safe amount formatting with wei detection
              const safeFormatAmount = (amount) => {
                if (!amount || amount === null || amount === undefined) {
                  return '0';
                }
                
                const amountStr = amount.toString();
                
                // If it's a very large number (likely wei), format from wei to ether
                if (!amountStr.includes('.') && amountStr.length >= 12) {
                  try {
                    return parseFloat(ethers.formatEther(amountStr)).toFixed(6);
                  } catch (error) {
                    console.error('Error formatting wei amount in ProcessPage:', amountStr, error);
                    return parseFloat(amountStr).toFixed(6);
                  }
                }
                
                // If it's already a decimal or small number, return as is
                return parseFloat(amountStr).toFixed(6);
              };
              
              const fromAmount = safeFormatAmount(order.fromAmount);
              const toAmount = safeFormatAmount(order.toAmount);
              const progressSteps = getProgressSteps(order);
              
              return (
                <div key={order.id} className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                  {/* Order Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Order #{order.id}</h3>
                      <p className="text-sm text-gray-500">
                        Created: {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Order Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">From</h4>
                      <div className="text-sm">
                        <div className="font-medium">{fromTokenSymbol} ({order.fromChain})</div>
                        <div className="text-gray-600">{fromAmount} {fromTokenSymbol}</div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">To</h4>
                      <div className="text-sm">
                        <div className="font-medium">{toTokenSymbol} ({order.toChain})</div>
                        <div className="text-gray-600">{toAmount} {toTokenSymbol}</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Steps */}
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-3">Progress</h4>
                    <div className="space-y-2">
                      {progressSteps.map((step, index) => (
                        <div key={index} className="flex items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                            step.status === 'completed' ? 'bg-green-500 text-white' :
                            step.status === 'pending' ? 'bg-yellow-500 text-white' :
                            'bg-gray-300 text-gray-600'
                          }`}>
                            {step.status === 'completed' ? '✓' : index + 1}
                          </div>
                          <span className={`ml-3 text-sm ${
                            step.status === 'completed' ? 'text-green-600 font-medium' :
                            step.status === 'pending' ? 'text-yellow-600 font-medium' :
                            'text-gray-500'
                          }`}>
                            {step.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Transaction Hash */}
                  {order.txHash && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm">
                        <span className="font-medium text-blue-900">Transaction:</span>
                        <div className="text-blue-700 font-mono text-xs break-all">
                          {order.txHash}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Escrow Address */}
                  {order.escrowAddress && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm">
                        <span className="font-medium text-green-900">Escrow Contract:</span>
                        <div className="text-green-700 font-mono text-xs break-all">
                          {order.escrowAddress}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-3">
                    {order.status === 'executed' && !order.secretProvided && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-900 mb-2">Provide Secret</h4>
                        <p className="text-sm text-yellow-700 mb-3">
                          Your order has been executed. Please provide the secret to complete the swap.
                        </p>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            placeholder="Enter your secret"
                            className="flex-1 px-3 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          />
                          <button
                            onClick={() => provideSecret(order)}
                            disabled={loading || !secret.trim()}
                            className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                          >
                            {loading ? 'Providing...' : 'Provide Secret'}
                          </button>
                        </div>
                      </div>
                    )}

                    {order.status === 'executed' && (
                      <button
                        onClick={() => verifyEscrowLocks(order)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        {loading ? 'Verifying...' : 'Verify Escrow Locks'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {userOrders.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg shadow-lg border border-gray-200">
                <p className="text-gray-500 text-lg">No orders found</p>
                <p className="text-gray-400 text-sm mt-2">Create an order in the "Create Order" page to see it here</p>
              </div>
            )}
          </div>
        )}

        {/* Status Messages */}
        {status && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">{status}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How to track orders:</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Connect your wallet to see your orders</li>
            <li>Monitor the progress of each order</li>
            <li>Verify escrow locks when orders are executed</li>
            <li>Provide your secret to complete the swap</li>
            <li>Track transaction status and completion</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ProcessPage; 