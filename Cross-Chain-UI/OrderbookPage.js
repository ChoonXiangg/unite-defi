import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { config } from './config.js';

const OrderbookPage = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [executionStatus, setExecutionStatus] = useState('');


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

  // Fetch orders from orderbook
  const fetchOrders = async () => {
    try {
      console.log('Fetching orders...');
      const response = await fetch(`${config.RELAYER_API_URL}/api/orders`);
      const data = await response.json();
      console.log('Orders API response:', data);
      setOrders(data.orders || []);
      console.log('Orders set:', data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      console.error('⚠️ Cannot connect to relayer server. Please start the relayer first:');
      console.error('   cd Relayer && node server.js');
      setOrders([]); // Show empty orders instead of mock data
    }
  };



  useEffect(() => {
    fetchOrders();
  }, []);

  // Get real-time price from CoinGecko
  const getRealTimePrice = async (fromChain, toChain) => {
    try {
      let priceUrl = '';
      
      if (fromChain === 'ethereum' && toChain === 'etherlink') {
        // ETH to XTZ price - use tezos as base currency
        priceUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=tezos&vs_currencies=eth';
      } else if (fromChain === 'etherlink' && toChain === 'ethereum') {
        // XTZ to ETH price
        priceUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=tezos&vs_currencies=eth';
      } else {
        return 1.0; // Same chain
      }
      
      const response = await fetch(priceUrl);
      const data = await response.json();
      console.log('🔍 OrderbookPage CoinGecko API response:', data);
      
      if (fromChain === 'ethereum' && toChain === 'etherlink') {
        // ETH to XTZ: invert the XTZ/ETH rate to get ETH/XTZ rate
        const xtzPerEth = data.tezos?.eth;
        if (xtzPerEth && xtzPerEth > 0) {
          const ethToXtz = 1 / xtzPerEth;
          console.log(`💱 Orderbook ETH to XTZ rate: 1 ETH = ${ethToXtz.toFixed(6)} XTZ`);
          return ethToXtz;
        }
        return 1.0;
      } else if (fromChain === 'etherlink' && toChain === 'ethereum') {
        // XTZ to ETH: direct rate
        const xtzToEth = data.tezos?.eth;
        console.log(`💱 Orderbook XTZ to ETH rate: 1 XTZ = ${xtzToEth} ETH`);
        return xtzToEth || 1.0;
      }
      
      return 1.0;
    } catch (error) {
      console.error('Error fetching real-time price:', error);
      return 1.0;
    }
  };

  // Analyze profitability of an order with fallback for sync usage
  const analyzeProfitability = (order) => {
    try {
      // Ensure amounts are strings or BigInt, not Promises
      const fromAmountStr = typeof order.fromAmount === 'string' ? order.fromAmount : order.fromAmount.toString();
      const toAmountStr = typeof order.toAmount === 'string' ? order.toAmount : order.toAmount.toString();
      
      const fromAmount = parseFloat(ethers.formatEther(fromAmountStr));
      const toAmount = parseFloat(ethers.formatEther(toAmountStr));
      
      // Use a simple fallback rate for immediate display
      // Real-time rates will be fetched in background for order execution
      let currentPrice = 1.0;
      if (order.fromChain === 'ethereum' && order.toChain === 'etherlink') {
        currentPrice = 4700; // Approximate ETH to XTZ rate
      } else if (order.fromChain === 'etherlink' && order.toChain === 'ethereum') {
        currentPrice = 0.000212; // Approximate XTZ to ETH rate
      }
      
      const expectedValue = fromAmount * currentPrice;
      const profit = toAmount - expectedValue;
      const profitPercentage = expectedValue > 0 ? (profit / expectedValue) * 100 : 0;
      
      return {
        profitable: profit > 0,
        profit: profit,
        profitPercentage: profitPercentage,
        currentPrice: currentPrice,
        priceSource: 'Estimated'
      };
    } catch (error) {
      console.error('Error analyzing profitability:', error);
      return {
        profitable: false,
        profit: 0,
        profitPercentage: 0,
        currentPrice: 1.0,
        priceSource: 'Fallback'
      };
    }
  };

  // Async version for detailed analysis when executing orders
  const analyzeProfitabilityDetailed = async (order) => {
    try {
      const fromAmountStr = typeof order.fromAmount === 'string' ? order.fromAmount : order.fromAmount.toString();
      const toAmountStr = typeof order.toAmount === 'string' ? order.toAmount : order.toAmount.toString();
      
      const fromAmount = parseFloat(ethers.formatEther(fromAmountStr));
      const toAmount = parseFloat(ethers.formatEther(toAmountStr));
      
      // Get real-time market price
      const currentPrice = await getRealTimePrice(order.fromChain, order.toChain);
      const expectedValue = fromAmount * currentPrice;
      const profit = toAmount - expectedValue;
      const profitPercentage = expectedValue > 0 ? (profit / expectedValue) * 100 : 0;
      
      return {
        profitable: profit > 0,
        profit: profit,
        profitPercentage: profitPercentage,
        currentPrice: currentPrice,
        priceSource: 'CoinGecko API'
      };
    } catch (error) {
      console.error('Error analyzing detailed profitability:', error);
      return analyzeProfitability(order); // Fallback to simple version
    }
  };

  // Execute order
  const executeOrder = async (order) => {
    if (!wallet) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      setExecutionStatus('Validating order signature...');
      const isValid = await validateOrderSignature(order);
      if (!isValid) {
        throw new Error('Invalid order signature');
      }

      setExecutionStatus('Checking predicate conditions...');
      const conditionsMet = await checkPredicateConditions(order);
      if (!conditionsMet) {
        throw new Error('Predicate conditions not met');
      }

      setExecutionStatus('Triggering LimitOrderProtocol...');
      
      // Get current network to handle ENS resolution properly
      const network = await wallet.provider.getNetwork();
      const currentChainId = Number(network.chainId);
      
      // Use different contract addresses based on network
      let contractAddress;
      if (currentChainId === 128123) {
        // Etherlink - use your deployed LOP contract
        contractAddress = config.CONTRACTS.ETHERLINK_LOP;
      } else if (currentChainId === 11155111) {
        // Sepolia - use your deployed LOP contract
        contractAddress = config.CONTRACTS.SEPOLIA_LOP;
      } else {
        throw new Error('Unsupported network. Please switch to Sepolia or Etherlink.');
      }
      
      const lopContract = new ethers.Contract(
        contractAddress,
        ['function executeOrder(address maker, address fromToken, address toToken, uint256 fromAmount, uint256 toAmount, string fromChain, string toChain, uint256 nonce, uint256 deadline, bytes signature)'],
        wallet
      );

      const tx = await lopContract.executeOrder(
        order.maker,
        order.fromToken,
        order.toToken,
        order.fromAmount,
        order.toAmount,
        order.fromChain,
        order.toChain,
        order.nonce,
        order.deadline,
        order.signature
      );

      setExecutionStatus('Waiting for transaction confirmation...');
      await tx.wait();
      setExecutionStatus('Order executed successfully! Transaction: ' + tx.hash);
      
      setOrders(prev => prev.map(o => 
        o.id === order.id ? { ...o, status: 'executed', txHash: tx.hash } : o
      ));
    } catch (error) {
      console.error('Error executing order:', error);
      setExecutionStatus('Error executing order: ' + error.message);
    }
    setLoading(false);
  };

  // Validate order signature
  const validateOrderSignature = async (order) => {
    // Mock signature validation
    return true;
  };

  // Check predicate conditions
  const checkPredicateConditions = async (order) => {
    // Mock predicate checking
    return true;
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Orderbook</h1>
          <p className="text-gray-600">View and execute cross-chain swap orders</p>
          <button
            onClick={fetchOrders}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            🔄 Refresh Orders
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
              Connect Wallet to Execute Orders
            </button>
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Pending Orders</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profitability</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => {
                  const profitability = analyzeProfitability(order);
                  const fromTokenSymbol = getTokenSymbol(order.fromToken, order.fromChain);
                  const toTokenSymbol = getTokenSymbol(order.toToken, order.toChain);
                  
                  // Safe formatting with null checks
                  let fromAmount = '0';
                  let toAmount = '0';
                  try {
                    if (order.fromAmount && order.fromAmount !== null) {
                      fromAmount = ethers.formatEther(order.fromAmount.toString());
                    }
                    if (order.toAmount && order.toAmount !== null) {
                      toAmount = ethers.formatEther(order.toAmount.toString());
                    }
                  } catch (error) {
                    console.error('Error formatting amounts:', error);
                    fromAmount = order.fromAmount?.toString() || '0';
                    toAmount = order.toAmount?.toString() || '0';
                  }
                  
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{order.id}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {fromTokenSymbol} ({order.fromChain})
                        </div>
                        <div className="text-sm text-gray-500">
                          {fromAmount} {fromTokenSymbol}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {toTokenSymbol} ({order.toChain})
                        </div>
                        <div className="text-sm text-gray-500">
                          {toAmount} {toTokenSymbol}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {fromAmount} → {toAmount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${profitability.profitable ? 'text-green-600' : 'text-red-600'}`}>
                          {profitability.profitable ? '+' : ''}{profitability.profitPercentage.toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-500">
                          {profitability.profitable ? '+' : ''}{profitability.profit.toFixed(4)} {toTokenSymbol}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'executed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => executeOrder(order)}
                            disabled={loading || !wallet}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                          >
                            {loading ? 'Executing...' : 'Execute'}
                          </button>
                        )}
                        {order.status === 'executed' && (
                          <span className="text-green-600">✓ Executed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Execution Status */}
        {executionStatus && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">{executionStatus}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How to execute orders:</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Connect your resolver wallet</li>
            <li>Review pending orders and their profitability</li>
            <li>Click "Execute" on a profitable order</li>
            <li>Confirm the transaction in your wallet</li>
            <li>Wait for transaction confirmation</li>
            <li>Complete the cross-chain swap process</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default OrderbookPage; 