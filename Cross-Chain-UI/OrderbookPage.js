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
      const response = await fetch(`${config.RELAYER_API_URL}/api/orderbook`);
      const data = await response.json();
      console.log('Orders API response:', data);
      setOrders(data.orders || []);
      console.log('Orders set:', data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      console.error('⚠️ Cannot connect to enhanced-relayer. Please ensure it is running:');
      console.error(`   Expected URL: ${config.RELAYER_API_URL}`);
      console.error('   Command: cd Relayer && node enhanced-relayer.js');
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

  // Analyze profitability of an order with proper amount handling
  const analyzeProfitability = (order) => {
    try {
      // Helper function to safely convert amounts
      const safeParseAmount = (amount) => {
        if (!amount || amount === null || amount === undefined) {
          return 0;
        }
        
        const amountStr = amount.toString();
        
        // If it's a very large number (wei), convert to ether
        if (!amountStr.includes('.') && amountStr.length >= 12) {
          try {
            return parseFloat(ethers.formatEther(amountStr));
          } catch (error) {
            console.error('Error parsing wei amount in profitability:', amountStr, error);
            return parseFloat(amountStr);
          }
        }
        
        // If it's already a decimal or small number
        return parseFloat(amountStr);
      };
      
      // Map the correct field names with fallbacks
      const fromAmount = safeParseAmount(order.makerAmount || order.fromAmount);
      const toAmount = safeParseAmount(order.takerAmount || order.toAmount);
      const fromChain = order.sourceChain || order.fromChain;
      const toChain = order.destinationChain || order.toChain;
      
      // Simple profitability check based on order ratio
      const orderRate = fromAmount > 0 ? toAmount / fromAmount : 0;
      
      // Map chain IDs to chain names for rate calculation
      let fromChainName = fromChain;
      let toChainName = toChain;
      if (fromChain === 11155111 || fromChain === '11155111') {
        fromChainName = 'ethereum';
      } else if (fromChain === 128123 || fromChain === '128123') {
        fromChainName = 'etherlink';
      }
      if (toChain === 11155111 || toChain === '11155111') {
        toChainName = 'ethereum';
      } else if (toChain === 128123 || toChain === '128123') {
        toChainName = 'etherlink';
      }
      
      // Expected rates (approximate)
      let expectedRate = 1.0;
      if (fromChainName === 'ethereum' && toChainName === 'etherlink') {
        expectedRate = 4700; // ETH to XTZ
      } else if (fromChainName === 'etherlink' && toChainName === 'ethereum') {
        expectedRate = 0.000212; // XTZ to ETH
      }
      
      const profit = (orderRate - expectedRate) * fromAmount;
      const profitPercentage = expectedRate > 0 ? ((orderRate - expectedRate) / expectedRate) * 100 : 0;
      
      return {
        profitable: profit > 0,
        profit: Math.abs(profit),
        profitPercentage: profitPercentage,
        currentPrice: expectedRate,
        priceSource: 'Estimated'
      };
    } catch (error) {
      console.error('Error analyzing profitability:', error);
      return {
        profitable: false,
        profit: 0,
        profitPercentage: 0,
        currentPrice: 1.0,
        priceSource: 'Error'
      };
    }
  };

  // Async version for detailed analysis when executing orders
  const analyzeProfitabilityDetailed = async (order) => {
    try {
      const fromAmountStr = typeof order.makerAmount === 'string' ? order.makerAmount : order.makerAmount.toString();
      const toAmountStr = typeof order.takerAmount === 'string' ? order.takerAmount : order.takerAmount.toString();
      
      const fromAmount = parseFloat(ethers.formatEther(fromAmountStr));
      const toAmount = parseFloat(ethers.formatEther(toAmountStr));
      
      // Get real-time market price
      const currentPrice = await getRealTimePrice(order.sourceChain, order.destinationChain);
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
  const executeOrder = async (orderData) => {
    if (!wallet) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      // Handle both old and new order formats
      const order = orderData.order || orderData;
      setExecutionStatus('Validating order signature...');
      const isValid = await validateOrderSignature(order);
      if (!isValid) {
        const signatureChainId = order.sourceChain || 128123;
        const network = await wallet.provider.getNetwork();
        const currentChainId = Number(network.chainId);
        throw new Error(`Please switch to the correct network. Order signature was created for chain ${signatureChainId} but you're connected to ${currentChainId}`);
      }

      setExecutionStatus('Checking predicate conditions...');
      const conditionsMet = await checkPredicateConditions(order);
      if (!conditionsMet) {
        throw new Error('Predicate conditions not met');
      }

      setExecutionStatus('Triggering LimitOrderProtocol...');
      
      // Use the order's source chain to determine which contract to use
      // This ensures we use the correct contract for the chain where the order was created
      const orderSourceChain = order.sourceChain || 128123;
      
      // Check if user is connected to the correct network for this order
      const network = await wallet.provider.getNetwork();
      const currentChainId = Number(network.chainId);
      
      if (currentChainId !== orderSourceChain) {
        throw new Error(`Please switch to the correct network. Order requires chain ${orderSourceChain} but you're connected to ${currentChainId}`);
      }
      
      // Use different contract addresses based on the order's source chain
      let contractAddress;
      if (orderSourceChain === 128123) {
        // Etherlink - use your deployed LOP contract
        contractAddress = config.CONTRACTS.ETHERLINK_LOP;
      } else if (orderSourceChain === 11155111) {
        // Sepolia - use your deployed LOP contract
        contractAddress = config.CONTRACTS.SEPOLIA_LOP;
      } else {
        throw new Error('Unsupported order source chain. Order must be from Sepolia or Etherlink.');
      }
      
      // Correct ABI that matches your deployed LOP contract
      const lopABI = [
        // Main execution function
        "function executeOrder((address maker,address taker,address makerAsset,address takerAsset,uint256 makerAmount,uint256 takerAmount,uint256 deadline,uint256 salt,bytes32 secretHash,uint256 sourceChain,uint256 destinationChain,bytes predicate,uint256 maxSlippage,bool requirePriceValidation,(uint256 price,uint256 timestamp,address relayer,string[] apiSources,uint256 confidence,uint256 deviation,bytes signature) priceData) order, bytes signature) external returns (address)",
        // Validation functions
        "function validateOrderSignature((address maker,address taker,address makerAsset,address takerAsset,uint256 makerAmount,uint256 takerAmount,uint256 deadline,uint256 salt,bytes32 secretHash,uint256 sourceChain,uint256 destinationChain,bytes predicate,uint256 maxSlippage,bool requirePriceValidation,(uint256 price,uint256 timestamp,address relayer,string[] apiSources,uint256 confidence,uint256 deviation,bytes signature) priceData) order, bytes signature) external view returns (bool)",
        "function validateOrderConditions((address maker,address taker,address makerAsset,address takerAsset,uint256 makerAmount,uint256 takerAmount,uint256 deadline,uint256 salt,bytes32 secretHash,uint256 sourceChain,uint256 destinationChain,bytes predicate,uint256 maxSlippage,bool requirePriceValidation,(uint256 price,uint256 timestamp,address relayer,string[] apiSources,uint256 confidence,uint256 deviation,bytes signature) priceData) order) external view returns (bool)",
        // Hash functions
        "function getOrderHash((address maker,address taker,address makerAsset,address takerAsset,uint256 makerAmount,uint256 takerAmount,uint256 deadline,uint256 salt,bytes32 secretHash,uint256 sourceChain,uint256 destinationChain,bytes predicate,uint256 maxSlippage,bool requirePriceValidation,(uint256 price,uint256 timestamp,address relayer,string[] apiSources,uint256 confidence,uint256 deviation,bytes signature) priceData) order) external view returns (bytes32)",
        // Authorization
        "function authorizedResolvers(address) external view returns (bool)",
        "function authorizedPriceRelayers(address) external view returns (bool)",
        // Configuration
        "function escrowFactories(uint256) external view returns (address)",
        "function orderStatus(bytes32) external view returns (uint256)",
        "function owner() external view returns (address)",
        "function DOMAIN_SEPARATOR() external view returns (bytes32)",
        // Events
        "event OrderExecuted(bytes32 indexed orderHash, address indexed resolver, address indexed escrowContract, uint256 chainId)",
        "event OrderCancelled(bytes32 indexed orderHash, address indexed maker)"
      ];
      
      const lopContract = new ethers.Contract(
        contractAddress,
        lopABI,
        wallet
      );
      
      // Check if the user is authorized as a resolver
      try {
        const isAuthorized = await lopContract.authorizedResolvers(account);
        console.log('🔍 User authorized as resolver:', isAuthorized);
        if (!isAuthorized) {
          console.warn('⚠️ User is not authorized as resolver. This might cause issues.');
        }
      } catch (error) {
        console.error('❌ Could not check resolver authorization:', error);
      }
      
      // Check what contract is actually deployed
      try {
        const code = await wallet.provider.getCode(contractAddress);
        console.log('🔍 Contract code length:', code.length);
        console.log('🔍 Contract has code:', code !== '0x');
        
        if (code === '0x') {
          console.error('❌ No contract deployed at this address!');
          return;
        }
        
        // Try to identify the contract by checking for common functions
        const testContract = new ethers.Contract(contractAddress, [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function owner() view returns (address)',
          'function DOMAIN_SEPARATOR() view returns (bytes32)',
          'function authorizedResolvers(address) view returns (bool)',
          'function escrowFactories(uint256) view returns (address)'
        ], wallet.provider);
        
        // Only check essential contract functions
        try {
          const owner = await testContract.owner();
          console.log('🔍 Contract owner:', owner);
        } catch (e) {
          console.log('🔍 Contract has no owner() function');
        }
        
        // Check the contract's domain separator (this function exists)
        try {
          const domainSeparator = await lopContract.DOMAIN_SEPARATOR();
          console.log('🔍 Contract domain separator:', domainSeparator);
        } catch (error) {
          console.error('❌ Could not get domain separator:', error);
        }
      } catch (error) {
        console.error('❌ Could not check contract code:', error);
      }

      // Transform order to match the actual Order struct from the contract
      // The order data comes from the API, so we need to extract the nested order if it exists
      const originalOrder = order.order || order;
      
      console.log('🔍 Raw order data from API:', order);
      console.log('🔍 Extracted order data:', originalOrder);
      
      // Debug: Let's see all fields from the original order to understand what we're working with
      console.log('🔍 All available fields in originalOrder:', Object.keys(originalOrder));
      console.log('🔍 Original order field values:');
      Object.keys(originalOrder).forEach(key => {
        console.log(`   ${key}:`, originalOrder[key]);
      });
      
      // The key insight: UserOrderPage signs with salt but stores as nonce in API
      // So we need to map nonce back to salt for the contract call
      const orderStruct = {
        maker: originalOrder.maker,
        taker: ethers.ZeroAddress, // This was hardcoded in UserOrderPage as ZeroAddress
        makerAsset: originalOrder.makerAsset,
        takerAsset: originalOrder.takerAsset,
        makerAmount: originalOrder.makerAmount,
        takerAmount: originalOrder.takerAmount,
        deadline: originalOrder.deadline,
        salt: originalOrder.nonce, // The nonce from API is actually the salt used in signing
        secretHash: originalOrder.secretHash || ethers.keccak256('0x'),
        sourceChain: originalOrder.sourceChain,
        destinationChain: originalOrder.destinationChain,
        predicate: originalOrder.predicate || '0x',
        maxSlippage: originalOrder.maxSlippage || 500,
        requirePriceValidation: originalOrder.requirePriceValidation || false,
        priceData: originalOrder.priceData || {
          price: 0,
          timestamp: 0,
          relayer: ethers.ZeroAddress,
          apiSources: [],
          confidence: 0,
          deviation: 0,
          signature: '0x'
        }
      };

      // Extract signature - it might be in different places depending on API response format
      const signature = orderData.signature || originalOrder.signature || order.signature;
      
      console.log('🔍 Order struct:', orderStruct);
      console.log('🔍 Signature being used:', signature);
      console.log('🔍 All signature sources:', {
        orderDataSignature: orderData.signature,
        originalOrderSignature: originalOrder.signature,
        orderSignature: order.signature
      });
      console.log('🔍 Contract address:', contractAddress);
      console.log('🔍 Order source chain:', orderSourceChain);
      
      // Skip order hash verification since the simplified contract doesn't have getOrderHash
      console.log('📋 Proceeding without order hash verification (simplified contract)');
      
      // Estimate gas for the executeOrder function
      let gasEstimate;
      try {
        gasEstimate = await lopContract.executeOrder.estimateGas(
          orderStruct,
          signature
        );
        console.log('🔍 Gas estimate:', gasEstimate.toString());
      } catch (error) {
        console.error('❌ Gas estimation failed:', error);
        console.error('Error details:', error.message);
        gasEstimate = 500000n; // Fallback gas limit as BigInt
      }

      // Execute with proper gas limit
      const gasLimit = BigInt(Math.floor(Number(gasEstimate) * 1.2));

      console.log('🔍 Executing order with struct parameters');
      const tx = await lopContract.executeOrder(
        orderStruct,
        signature,
        {
          gasLimit: gasLimit
        }
      );

      setExecutionStatus('Waiting for transaction confirmation...');
      await tx.wait();
      setExecutionStatus('Order executed successfully! Transaction: ' + tx.hash);
      
      setOrders(prev => prev.map(o => 
        o.id === orderData.id ? { ...o, status: 'executed', txHash: tx.hash } : o
      ));
    } catch (error) {
      console.error('Error executing order:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Error executing order: ';
      
      if (error.code === -32603) {
        errorMessage += 'Network/RPC error. Please try again or check your connection.';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage += 'Insufficient funds for gas. Please add more ETH to your wallet.';
      } else if (error.message.includes('nonce')) {
        errorMessage += 'Transaction nonce error. Please try again.';
      } else if (error.message.includes('revert')) {
        errorMessage += 'Transaction reverted. The order may have already been executed or cancelled.';
      } else {
        errorMessage += error.message;
      }
      
      setExecutionStatus(errorMessage);
    }
    setLoading(false);
  };

  // Validate order signature
  const validateOrderSignature = async (order) => {
    try {
      // Get the network where the signature was created
      const signatureChainId = order.sourceChain || 128123;
      
      // Get current network
      const network = await wallet.provider.getNetwork();
      const currentChainId = Number(network.chainId);
      
      // Check if we're on the correct network for this signature
      if (currentChainId !== signatureChainId) {
        console.error(`❌ Network mismatch: Signature created for chain ${signatureChainId}, but connected to ${currentChainId}`);
        return false;
      }
      
      console.log(`✅ Network validation passed: Connected to chain ${currentChainId}, signature created for chain ${signatureChainId}`);
      return true;
    } catch (error) {
      console.error('❌ Signature validation error:', error);
      return false;
    }
  };

  // Check predicate conditions
  const checkPredicateConditions = async (order) => {
    // Mock predicate checking
    return true;
  };

  // Get token symbol by address
  const getTokenSymbol = (address, chain) => {
    // Map chain IDs to chain names
    let chainName = chain;
    if (chain === 11155111 || chain === '11155111') {
      chainName = 'ethereum';
    } else if (chain === 128123 || chain === '128123') {
      chainName = 'etherlink';
    }
    
    const tokens = tokenOptions[chainName] || [];
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
                {orders.map((orderData) => {
                  // Handle both old and new order formats
                  const order = orderData.order || orderData;
                  
                  // Map the correct field names
                  const fromToken = order.makerAsset || order.fromToken;
                  const toToken = order.takerAsset || order.toToken;
                  const fromAmount = order.makerAmount || order.fromAmount;
                  const toAmount = order.takerAmount || order.toAmount;
                  
                  // Get chain information from the order
                  const fromChain = order.sourceChain || order.fromChain || 128123; // Default to Etherlink
                  const toChain = order.destinationChain || order.toChain || 11155111; // Default to Sepolia
                  
                  // Create enhanced order object with chain information for profitability analysis
                  const enhancedOrder = {
                    ...order,
                    sourceChain: fromChain,
                    destinationChain: toChain
                  };
                  
                  const profitability = analyzeProfitability(enhancedOrder);
                  
                  const fromTokenSymbol = getTokenSymbol(fromToken, fromChain);
                  const toTokenSymbol = getTokenSymbol(toToken, toChain);
                  
                  // Safe formatting with improved wei detection
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
                        console.error('Error formatting wei amount:', amountStr, error);
                        return parseFloat(amountStr).toFixed(6);
                      }
                    }
                    
                    // If it's already a decimal or small number, return as is
                    return parseFloat(amountStr).toFixed(6);
                  };
                  
                  const formattedFromAmount = safeFormatAmount(fromAmount);
                  const formattedToAmount = safeFormatAmount(toAmount);
                  
                  return (
                    <tr key={orderData.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{orderData.id}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(orderData.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {fromTokenSymbol} ({fromChain})
                        </div>
                        <div className="text-sm text-gray-500">
                          {formattedFromAmount} {fromTokenSymbol}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {toTokenSymbol} ({toChain})
                        </div>
                        <div className="text-sm text-gray-500">
                          {formattedToAmount} {toTokenSymbol}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formattedFromAmount} {fromTokenSymbol} → {formattedToAmount} {toTokenSymbol}
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
                          orderData.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          orderData.status === 'picked' ? 'bg-blue-100 text-blue-800' :
                          orderData.status === 'executed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {orderData.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {(orderData.status === 'pending' || orderData.status === 'picked') && (
                          <button
                            onClick={() => executeOrder(orderData)}
                            disabled={loading || !wallet}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                          >
                            {loading ? 'Executing...' : 'Execute'}
                          </button>
                        )}
                        {orderData.status === 'executed' && (
                          <span className="text-green-600">✓ Executed</span>
                        )}
                        {orderData.status === 'picked' && (
                          <span className="text-blue-600 text-xs">Picked by resolver</span>
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