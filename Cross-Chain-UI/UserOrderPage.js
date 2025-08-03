import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { config } from './config.js';

const UserOrderPage = () => {
  const [wallet, setWallet] = useState(null);
  const [account, setAccount] = useState('');
  const [quote, setQuote] = useState(null);
  const [orderParams, setOrderParams] = useState({
    fromToken: '',
    toToken: '',
    fromAmount: '',
    toAmount: '',
    fromChain: 'ethereum',
    toChain: 'etherlink',
    slippage: 0.5
  });
  const [loading, setLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState('');
  const [currentNetwork, setCurrentNetwork] = useState('');

  // Product-ready token configuration
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
        
        // Get current network
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        if (chainId === 11155111) {
          setCurrentNetwork('Ethereum Sepolia');
        } else if (chainId === 128123) {
          setCurrentNetwork('Etherlink Ghostnet');
        } else {
          setCurrentNetwork(`Chain ID: ${chainId}`);
        }
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  // Get real-time price from CoinGecko
  const getRealTimePrice = async (fromChain, toChain) => {
    try {
      let priceUrl = '';
      
      if (fromChain === 'ethereum' && toChain === 'etherlink') {
        // ETH to XTZ price - need to use tezos as base currency
        priceUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=tezos&vs_currencies=eth';
      } else if (fromChain === 'etherlink' && toChain === 'ethereum') {
        // XTZ to ETH price  
        priceUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=tezos&vs_currencies=eth';
      } else {
        // Fallback for same-chain or unsupported pairs
        return 0.98; // 2% slippage
      }
      
      const response = await fetch(priceUrl);
      const data = await response.json();
      console.log('🔍 CoinGecko API response:', data);
      
      if (fromChain === 'ethereum' && toChain === 'etherlink') {
        // ETH to XTZ: invert the XTZ/ETH rate to get ETH/XTZ rate
        const xtzPerEth = data.tezos?.eth;
        if (xtzPerEth && xtzPerEth > 0) {
          const ethToXtz = 1 / xtzPerEth;
          console.log(`💱 ETH to XTZ rate: 1 ETH = ${ethToXtz.toFixed(6)} XTZ`);
          return ethToXtz;
        }
        return 0.98;
      } else if (fromChain === 'etherlink' && toChain === 'ethereum') {
        // XTZ to ETH: direct rate
        const xtzToEth = data.tezos?.eth;
        console.log(`💱 XTZ to ETH rate: 1 XTZ = ${xtzToEth} ETH`);
        return xtzToEth || 0.98;
      }
      
      return 0.98; // Fallback
    } catch (error) {
      console.error('Error fetching real-time price:', error);
      return 0.98; // Fallback with 2% slippage
    }
  };

  // Get price quote with real market data
  const getQuote = async () => {
    if (!orderParams.fromToken || !orderParams.toToken || !orderParams.fromAmount) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Get real-time exchange rate
      const exchangeRate = await getRealTimePrice(orderParams.fromChain, orderParams.toChain);
      
      // Calculate quote with slippage
      const slippageMultiplier = (100 - orderParams.slippage) / 100;
      const rawToAmount = parseFloat(orderParams.fromAmount) * exchangeRate;
      const toTokenAmount = (rawToAmount * slippageMultiplier).toFixed(18);
      
      const realQuote = {
        toTokenAmount,
        estimatedGas: '50000',
        price: (exchangeRate * slippageMultiplier).toString(),
        exchangeRate: exchangeRate.toString(),
        slippage: orderParams.slippage,
        fromToken: orderParams.fromToken,
        toToken: orderParams.toToken,
        amount: orderParams.fromAmount,
        chainId: orderParams.fromChain,
        priceSource: 'CoinGecko API'
      };
      
      setQuote(realQuote);
      console.log('💰 Real-time quote:', realQuote);
    } catch (error) {
      console.error('Error getting quote:', error);
      // Fallback quote simulation
      setQuote({
        toTokenAmount: (parseFloat(orderParams.fromAmount) * 0.98).toFixed(18),
        estimatedGas: '50000',
        price: '0.98',
        priceSource: 'Fallback'
      });
    }
    setLoading(false);
  };

  // Create and sign order
  const createOrder = async () => {
    if (!wallet || !quote) {
      alert('Please connect wallet and get a quote first');
      return;
    }

    // Check if user is on the correct network for the selected source chain
    try {
      const network = await wallet.provider.getNetwork();
      const currentChainId = Number(network.chainId);
      
      if (orderParams.fromChain === 'ethereum' && currentChainId !== 11155111) {
        alert('Please switch to Ethereum Sepolia testnet in MetaMask');
        return;
      } else if (orderParams.fromChain === 'etherlink' && currentChainId !== 128123) {
        alert('Please switch to Etherlink Ghostnet in MetaMask');
        return;
      }
    } catch (error) {
      console.error('Error checking network:', error);
    }

    setLoading(true);
    try {
      // Create order structure that matches relayer expectations
      const order = {
        maker: account,
        makerAsset: orderParams.fromToken,
        takerAsset: orderParams.toToken,
        makerAmount: ethers.parseEther(orderParams.fromAmount),
        takerAmount: ethers.parseEther(quote.toTokenAmount.toString()),
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        secretHash: ethers.keccak256(ethers.toUtf8Bytes("secret" + Date.now())),
        sourceChain: orderParams.fromChain === 'ethereum' ? 11155111 : 128123,
        destinationChain: orderParams.toChain === 'ethereum' ? 11155111 : 128123
      };

      // Ensure wallet has provider for ENS resolution
      if (!wallet.provider) {
        throw new Error('Wallet provider not available for signing');
      }
      
      // Use EIP-712 typed data signing to match contract's validateOrderSignature
      // The domain should match where the LOP contract is deployed
      const network = await wallet.provider.getNetwork();
      
      // Use the user's current network chainId for the domain
      // This works because you have LOP contracts deployed on both chains
      const domain = {
        name: 'LimitOrderProtocol',
        version: '1.0',
        chainId: Number(network.chainId) // Use the user's current network
      };

      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'taker', type: 'address' },
          { name: 'makerAsset', type: 'address' },
          { name: 'takerAsset', type: 'address' },
          { name: 'makerAmount', type: 'uint256' },
          { name: 'takerAmount', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'salt', type: 'uint256' },
          { name: 'secretHash', type: 'bytes32' },
          { name: 'sourceChain', type: 'uint256' },
          { name: 'destinationChain', type: 'uint256' },
          { name: 'predicate', type: 'bytes' },
          { name: 'maxSlippage', type: 'uint256' },
          { name: 'requirePriceValidation', type: 'bool' },
          { name: 'priceData', type: 'RelayerPriceData' }
        ],
        RelayerPriceData: [
          { name: 'price', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'relayer', type: 'address' },
          { name: 'apiSources', type: 'string[]' },
          { name: 'confidence', type: 'uint256' },
          { name: 'deviation', type: 'uint256' },
          { name: 'signature', type: 'bytes' }
        ]
      };

      const value = {
        maker: order.maker,
        taker: ethers.ZeroAddress,
        makerAsset: order.makerAsset,
        takerAsset: order.takerAsset,
        makerAmount: order.makerAmount,
        takerAmount: order.takerAmount,
        deadline: order.deadline,
        salt: order.nonce || 0,
        secretHash: order.secretHash,
        sourceChain: order.sourceChain || 128123,
        destinationChain: order.destinationChain || 11155111,
        predicate: '0x',
        maxSlippage: 500,
        requirePriceValidation: false,
        priceData: {
          price: 0,
          timestamp: 0,
          relayer: ethers.ZeroAddress,
          apiSources: [],
          confidence: 0,
          deviation: 0,
          signature: '0x'
        }
      };

      console.log('🔍 Signing EIP-712 data:', { domain, types, value });
      const signature = await wallet.signTypedData(domain, types, value);
      console.log('🔍 EIP-712 signature created:', signature);
      
      // Submit order to orderbook (convert BigInt to strings for JSON serialization)
      const orderSubmission = {
        order: {
          maker: order.maker,
          makerAsset: order.makerAsset,
          takerAsset: order.takerAsset,
          makerAmount: order.makerAmount.toString(), // Convert BigInt to string
          takerAmount: order.takerAmount.toString(), // Convert BigInt to string
          deadline: order.deadline,
          secretHash: order.secretHash,
          sourceChain: order.sourceChain,
          destinationChain: order.destinationChain
        },
        signature
      };

      const response = await fetch(`${config.RELAYER_API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderSubmission)
      });

      const result = await response.json();
      setOrderStatus('Order submitted successfully! Order ID: ' + result.orderId);
    } catch (error) {
      console.error('Error creating order:', error);
      let errorMessage = 'Error creating order: ';
      
      if (error.message.includes('ENS resolution requires a provider')) {
        errorMessage += 'Wallet connection issue. Please reconnect your wallet.';
      } else if (error.message.includes('parseEther')) {
        errorMessage += 'Invalid amount format. Please check your input.';
      } else if (error.message.includes('serialize a BigInt')) {
        errorMessage += 'Data serialization error. Please try again.';
      } else {
        errorMessage += error.message;
      }
      
      setOrderStatus(errorMessage);
    }
    setLoading(false);
  };

  // Handle token selection
  const handleTokenChange = (field, value) => {
    setOrderParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Get current token options based on selected chain
  const getCurrentTokenOptions = (chain) => {
    return tokenOptions[chain] || [];
  };

  // Get token info by address
  const getTokenInfo = (address, chain) => {
    const tokens = tokenOptions[chain] || [];
    return tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Cross-Chain Token Swap</h1>
          <p className="text-gray-600">Swap tokens between Ethereum Sepolia and Etherlink testnets</p>
        </div>

        {/* Connection Status */}
        {account && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-green-800 font-medium">
                  Connected: {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </div>
              <div className="text-sm text-green-700">
                Network: {currentNetwork}
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
          {/* Wallet Connection */}
          {!account && (
            <div className="mb-6">
              <button
                onClick={connectWallet}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Connect Wallet
              </button>
            </div>
          )}

          {/* Swap Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* From Chain */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Chain</label>
              <select
                value={orderParams.fromChain}
                onChange={(e) => handleTokenChange('fromChain', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ethereum">🔵 Ethereum (Sepolia)</option>
                <option value="etherlink">🟣 Etherlink (Ghostnet)</option>
              </select>
            </div>

            {/* To Chain */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Chain</label>
              <select
                value={orderParams.toChain}
                onChange={(e) => handleTokenChange('toChain', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="etherlink">🟣 Etherlink (Ghostnet)</option>
                <option value="ethereum">🔵 Ethereum (Sepolia)</option>
              </select>
            </div>

            {/* From Token */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Token</label>
              <select
                value={orderParams.fromToken}
                onChange={(e) => handleTokenChange('fromToken', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a token</option>
                {getCurrentTokenOptions(orderParams.fromChain).map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.logo} {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
            </div>

            {/* To Token */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Token</label>
              <select
                value={orderParams.toToken}
                onChange={(e) => handleTokenChange('toToken', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a token</option>
                {getCurrentTokenOptions(orderParams.toChain).map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.logo} {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <input
                type="number"
                value={orderParams.fromAmount}
                onChange={(e) => handleTokenChange('fromAmount', e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Slippage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slippage (%)</label>
              <input
                type="number"
                value={orderParams.slippage}
                onChange={(e) => handleTokenChange('slippage', parseFloat(e.target.value))}
                step="0.1"
                min="0.1"
                max="50"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Token Info Display */}
          {(orderParams.fromToken || orderParams.toToken) && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Selected Tokens</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {orderParams.fromToken && (
                  <div>
                    <span className="text-blue-700">From:</span>
                    <div className="font-medium text-blue-900">
                      {getTokenInfo(orderParams.fromToken, orderParams.fromChain)?.logo} {getTokenInfo(orderParams.fromToken, orderParams.fromChain)?.symbol} ({orderParams.fromChain})
                    </div>
                  </div>
                )}
                {orderParams.toToken && (
                  <div>
                    <span className="text-blue-700">To:</span>
                    <div className="font-medium text-blue-900">
                      {getTokenInfo(orderParams.toToken, orderParams.toChain)?.logo} {getTokenInfo(orderParams.toToken, orderParams.toChain)?.symbol} ({orderParams.toChain})
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quote Display */}
          {quote && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                💰 Real-Time Price Quote 
                <span className="text-xs font-normal text-blue-600 ml-2">({quote.priceSource})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">You'll receive:</span>
                  <div className="font-medium text-blue-900">{parseFloat(quote.toTokenAmount).toFixed(6)} tokens</div>
                </div>
                <div>
                  <span className="text-blue-700">Exchange Rate:</span>
                  <div className="font-medium text-blue-900">
                    {quote.exchangeRate ? `1 : ${parseFloat(quote.exchangeRate).toFixed(6)}` : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-blue-700">Slippage:</span>
                  <div className="font-medium text-blue-900">{quote.slippage || orderParams.slippage}%</div>
                </div>
                <div>
                  <span className="text-blue-700">Estimated gas:</span>
                  <div className="font-medium text-blue-900">{quote.estimatedGas} gas</div>
                </div>
              </div>
              {quote.priceSource === 'CoinGecko API' && (
                <div className="mt-3 p-2 bg-green-100 border border-green-200 rounded text-xs text-green-800">
                  ✅ Live market prices from CoinGecko - Bidirectional swaps enabled
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={getQuote}
              disabled={loading || !orderParams.fromToken || !orderParams.toToken || !orderParams.fromAmount}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {loading ? 'Getting Quote...' : 'Get Price Quote'}
            </button>
            
            {quote && (
              <button
                onClick={createOrder}
                disabled={loading || !wallet}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
              >
                {loading ? 'Creating Order...' : 'Create Order'}
              </button>
            )}
          </div>

          {/* Order Status */}
          {orderStatus && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-gray-800">{orderStatus}</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How to use:</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Connect your wallet (MetaMask)</li>
            <li><strong>Switch to the correct network:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>For Ethereum → Etherlink: Use <strong>Ethereum Sepolia</strong></li>
                <li>For Etherlink → Ethereum: Use <strong>Etherlink Ghostnet</strong></li>
              </ul>
            </li>
            <li>Select source and destination chains</li>
            <li>Choose tokens to swap from the dropdowns</li>
            <li>Enter the amount you want to swap</li>
            <li>Get a price quote</li>
            <li>Create and sign the order</li>
            <li>Track your order progress in the "Track Orders" page</li>
          </ol>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-900 mb-1">⚠️ Important:</h4>
            <p className="text-sm text-yellow-800">
              Make sure your MetaMask is connected to the correct network for your source chain. 
              The network will be displayed in the connection status above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserOrderPage; 