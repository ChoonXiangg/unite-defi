import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { useState, useEffect } from "react";
import { WalletService, oneInchUtils } from "../utils/walletUtils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Empty Glassmorphism Box Component
const LeaderboardCard = () => {
  return (
    <div className="relative w-full">
      <div className="relative bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-purple-600/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 hover:scale-[1.02] h-28">
        
        {/* Glowing border effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-400/30 via-pink-400/30 to-purple-500/30 rounded-2xl blur-sm -z-10 opacity-60"></div>
        
      </div>
    </div>
  );
};

export default function Main() {
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("USDC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [gasEstimate, setGasEstimate] = useState(null);
  const [currentRate, setCurrentRate] = useState(null);
  const [gasData, setGasData] = useState(null);

  // Wallet states
  const [walletService] = useState(() => new WalletService());
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [swapping, setSwapping] = useState(false);
  const [swapStatus, setSwapStatus] = useState(null);

  // Backend-supported tokens with CoinGecko logos
  const tokens = [
    { 
      symbol: "ETH", 
      name: "Ethereum", 
      chain: "Ethereum", 
      chainId: 1,
      logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    },
    { 
      symbol: "ETH", 
      name: "Ethereum", 
      chain: "Arbitrum", 
      chainId: 42161,
      logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    },
    { 
      symbol: "ETH", 
      name: "Ethereum", 
      chain: "Base", 
      chainId: 8453,
      logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    },
    { 
      symbol: "USDC", 
      name: "USD Coin", 
      chain: "Ethereum", 
      chainId: 1,
      logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
      address: "0xA0b86a33E6441b8C4C8C0C4C8C0C4C8C0C4C8C0C"
    },
    { 
      symbol: "USDC", 
      name: "USD Coin", 
      chain: "Arbitrum", 
      chainId: 42161,
      logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
    },
    { 
      symbol: "USDC", 
      name: "USD Coin", 
      chain: "Polygon", 
      chainId: 137,
      logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
    },
    { 
      symbol: "USDT", 
      name: "Tether USD", 
      chain: "Ethereum", 
      chainId: 1,
      logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    },
    { 
      symbol: "BNB", 
      name: "BNB", 
      chain: "BSC", 
      chainId: 56,
      logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    },
    { 
      symbol: "MATIC", 
      name: "Polygon", 
      chain: "Polygon", 
      chainId: 137,
      logo: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    },
    { 
      symbol: "AVAX", 
      name: "Avalanche", 
      chain: "Avalanche", 
      chainId: 43114,
      logo: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    },
    { 
      symbol: "XTZ", 
      name: "Tezos", 
      chain: "Tezos", 
      chainId: null,
      logo: "https://assets.coingecko.com/coins/images/976/small/Tezos-logo.png",
      address: "native"
    },
    { 
      symbol: "kUSD", 
      name: "Kolibri USD", 
      chain: "Tezos", 
      chainId: null,
      logo: "https://assets.coingecko.com/coins/images/14441/small/kolibri-logo.png",
      address: "KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV"
    }
  ];

  const chains = [
    { 
      name: "Ethereum", 
      chainId: 1, 
      logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      rpc: "https://eth.llamarpc.com"
    },
    { 
      name: "Arbitrum", 
      chainId: 42161, 
      logo: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
      rpc: "https://arb1.arbitrum.io/rpc"
    },
    { 
      name: "Base", 
      chainId: 8453, 
      logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      rpc: "https://mainnet.base.org"
    },
    { 
      name: "Polygon", 
      chainId: 137, 
      logo: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
      rpc: "https://polygon-rpc.com"
    },
    { 
      name: "BSC", 
      chainId: 56, 
      logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
      rpc: "https://bsc-dataseed1.binance.org"
    },
    { 
      name: "Avalanche", 
      chainId: 43114, 
      logo: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
      rpc: "https://api.avax.network/ext/bc/C/rpc"
    },
    { 
      name: "Tezos", 
      chainId: null, 
      logo: "https://assets.coingecko.com/coins/images/976/small/Tezos-logo.png",
      rpc: "https://mainnet.api.tez.ie"
    }
  ];

  // Fetch real-time prices from API
  const fetchPrices = async (tokenList) => {
    try {
      const response = await fetch(`/api/price/tokens?tokens=${tokenList.join(',')}&chainId=1`);
      const data = await response.json();
      if (data.success) {
        setPrices(data.prices);
      }
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    }
  };

  // Fetch real-time gas data
  const fetchGasData = async () => {
    try {
      const response = await fetch('/api/price/gas-estimate?chainId=1');
      const data = await response.json();
      if (data.success) {
        setGasData(data);
      }
    } catch (error) {
      console.error('Failed to fetch gas data:', error);
    }
  };

  // Fetch swap quote from 1inch
  const fetchSwapQuote = async (from, to, amount) => {
    if (!amount || parseFloat(amount) <= 0) return null;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/price/swap-quote?fromToken=${from}&toToken=${to}&amount=${amount}&chainId=1`);
      const data = await response.json();
      setLoading(false);
      
      if (data.success) {
        // Update gas estimate and rate from API response
        if (data.gasEstimate) {
          setGasEstimate(data.gasEstimate);
        }
        if (data.rate) {
          setCurrentRate(data.rate);
        }
        return data.toAmount;
      }
    } catch (error) {
      console.error('Failed to fetch swap quote:', error);
      setLoading(false);
    }
    return null;
  };

  // Wallet connection function
  const connectWallet = async () => {
    try {
      const { address } = await walletService.connectWallet();
      setWalletConnected(true);
      setWalletAddress(address);
      setSwapStatus('Wallet connected successfully!');
      setTimeout(() => setSwapStatus(null), 3000);
    } catch (error) {
      console.error('Wallet connection failed:', error);
      setSwapStatus(`Connection failed: ${error.message}`);
      setTimeout(() => setSwapStatus(null), 5000);
    }
  };

  // Enhanced swap function with 1inch integration
  const handleSwap = async () => {
    if (!walletConnected) {
      await connectWallet();
      return;
    }

    if (!fromAmount || !toAmount || parseFloat(fromAmount) <= 0) {
      setSwapStatus('Please enter a valid amount');
      setTimeout(() => setSwapStatus(null), 3000);
      return;
    }

    setSwapping(true);
    setSwapStatus('Preparing swap...');

    try {
      // Get token data
      const fromTokenData = tokens.find(t => t.symbol === fromToken);
      const toTokenData = tokens.find(t => t.symbol === toToken);

      if (!fromTokenData || !toTokenData) {
        throw new Error('Token configuration not found');
      }

      // Add decimals to token data if not present
      const fromTokenWithDecimals = {
        ...fromTokenData,
        decimals: getTokenDecimals(fromToken)
      };
      const toTokenWithDecimals = {
        ...toTokenData,
        decimals: getTokenDecimals(toToken)
      };

      setSwapStatus('Building swap transaction...');

      // Build swap transaction using 1inch
      const swapData = await oneInchUtils.buildSwapData(
        fromTokenWithDecimals,
        toTokenWithDecimals,
        fromAmount,
        walletAddress,
        fromTokenData.chainId
      );

      if (!swapData.success) {
        throw new Error(swapData.error || 'Failed to build swap transaction');
      }

      // Check if token approval is needed (skip for native tokens)
      if (fromTokenData.address !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        setSwapStatus('Checking token allowance...');
        
        const routerAddress = oneInchUtils.getRouterAddress(fromTokenData.chainId);
        const requiredAmount = oneInchUtils.toSmallestUnit(fromAmount, fromTokenWithDecimals.decimals);
        const allowance = await walletService.checkTokenAllowance(
          fromTokenData.address,
          routerAddress,
          fromTokenData.chainId
        );

        if (allowance < requiredAmount) {
          setSwapStatus('Approving token spend...');
          const approveTx = await walletService.approveToken(
            fromTokenData.address,
            routerAddress,
            requiredAmount
          );
          
          setSwapStatus('Waiting for approval confirmation...');
          await approveTx.wait();
        }
      }

      setSwapStatus('Executing swap...');

      // Execute the swap
      const swapTx = await walletService.executeSwap(swapData.transaction);
      
      setSwapStatus('Waiting for swap confirmation...');
      const receipt = await swapTx.wait();

      setSwapStatus('Swap completed successfully! 🎉');
      console.log('Swap completed:', receipt);

      // Reset form
      setFromAmount('');
      setToAmount('');
      
      setTimeout(() => setSwapStatus(null), 5000);

    } catch (error) {
      console.error('Swap failed:', error);
      setSwapStatus(`Swap failed: ${error.message}`);
      setTimeout(() => setSwapStatus(null), 8000);
    } finally {
      setSwapping(false);
    }
  };

  // Bidirectional calculation
  const handleFromAmountChange = async (value) => {
    const validatedValue = validateAndFormatInput(value);
    setFromAmount(validatedValue);
    
    if (validatedValue && !isNaN(validatedValue) && parseFloat(validatedValue) > 0) {
      // Use real-time swap quote from 1inch
      const quoteAmount = await fetchSwapQuote(fromToken, toToken, validatedValue);
      if (quoteAmount) {
        // Keep precision but clean up display
        const cleanAmount = parseFloat(quoteAmount).toString();
        setToAmount(validateAndFormatInput(cleanAmount));
      } else {
        // Fallback to real-time rate calculation if API fails
        const rate = getConversionRate(fromToken, toToken);
        const result = (parseFloat(validatedValue) * rate).toFixed(8);
        const cleanResult = parseFloat(result).toString();
        setToAmount(validateAndFormatInput(cleanResult));
      }
    } else {
      setToAmount("");
    }
  };

  const handleToAmountChange = async (value) => {
    const validatedValue = validateAndFormatInput(value);
    setToAmount(validatedValue);
    
    if (validatedValue && !isNaN(validatedValue) && parseFloat(validatedValue) > 0) {
      // Use real-time swap quote from 1inch (reverse direction)
      const quoteAmount = await fetchSwapQuote(toToken, fromToken, validatedValue);
      if (quoteAmount) {
        // Keep precision but clean up display
        const cleanAmount = parseFloat(quoteAmount).toString();
        setFromAmount(validateAndFormatInput(cleanAmount));
      } else {
        // Fallback to real-time rate calculation if API fails
        const rate = getConversionRate(toToken, fromToken);
        const result = (parseFloat(validatedValue) * rate).toFixed(8);
        const cleanResult = parseFloat(result).toString();
        setFromAmount(validateAndFormatInput(cleanResult));
      }
    } else {
      setFromAmount("");
    }
  };

  const getConversionRate = (from, to) => {
    // Use real-time prices if available, otherwise fallback to default
    const fromPrice = prices[from.toUpperCase()] || getDefaultPrice(from);
    const toPrice = prices[to.toUpperCase()] || getDefaultPrice(to);
    return toPrice / fromPrice;
  };

  const getDefaultPrice = (tokenSymbol) => {
    const fallbackRates = {
      ETH: 2450,
      USDC: 1,
      USDT: 1,
      BTC: 45000,
      XTZ: 1.2,
      kUSD: 1,
      BNB: 320,
      MATIC: 0.8,
      AVAX: 25
    };
    return fallbackRates[tokenSymbol.toUpperCase()] || 1;
  };

  const getTokenLogo = (symbol, chain = null) => {
    const token = tokens.find(token => 
      token.symbol === symbol && (chain ? token.chain === chain : true)
    );
    return token?.logo || "https://via.placeholder.com/32x32/666666/ffffff?text=" + symbol;
  };

  const getChainLogo = (chainName) => {
    return chains.find(chain => chain.name === chainName)?.logo || "https://via.placeholder.com/20x20/666666/ffffff?text=?";
  };

  const getTokenChain = (symbol) => {
    return tokens.find(token => token.symbol === symbol)?.chain || "Ethereum";
  };

  const getChainColor = (chainName) => {
    const colors = {
      'Ethereum': 'bg-blue-500',
      'Arbitrum': 'bg-blue-400', 
      'Base': 'bg-blue-600',
      'Polygon': 'bg-purple-500',
      'BSC': 'bg-yellow-500',
      'Avalanche': 'bg-red-500',
      'Tezos': 'bg-indigo-500'
    };
    return colors[chainName] || 'bg-gray-500';
  };

  const getUSDEquivalent = (amount, token) => {
    // Use real-time price if available, otherwise fallback to default
    const price = prices[token.toUpperCase()] || getDefaultPrice(token);
    const value = parseFloat(amount) * price;
    
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatAmount = (amount) => {
    if (!amount || amount === "0") return "";
    const num = parseFloat(amount);
    if (isNaN(num)) return "";
    // Remove trailing zeros
    return num.toString();
  };

  const getTokenDecimals = (symbol) => {
    const decimals = {
      ETH: 18,
      WETH: 18,
      USDC: 6,
      USDT: 6,
      DAI: 18,
      WBTC: 8,
      BNB: 18,
      MATIC: 18,
      AVAX: 18,
      XTZ: 6,
      kUSD: 18
    };
    
    return decimals[symbol.toUpperCase()] || 18;
  };

  const validateAndFormatInput = (value) => {
    // Only allow numbers and decimal point
    let cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const decimalCount = (cleanValue.match(/\./g) || []).length;
    if (decimalCount > 1) {
      cleanValue = cleanValue.replace(/\.(?=.*\.)/g, '');
    }
    
    // Prevent starting with decimal point
    if (cleanValue.startsWith('.')) {
      cleanValue = '0' + cleanValue;
    }
    
    // Limit to 5 digits before decimal point
    const parts = cleanValue.split('.');
    if (parts[0] && parts[0].length > 5) {
      parts[0] = parts[0].substring(0, 5);
    }
    
    // Limit to 6 decimal places
    if (parts[1] && parts[1].length > 6) {
      parts[1] = parts[1].substring(0, 6);
    }
    
    return parts.join('.');
  };

  // Load initial prices and gas data on component mount
  useEffect(() => {
    const tokenSymbols = [...new Set(tokens.map(t => t.symbol))];
    fetchPrices(tokenSymbols);
    fetchGasData();
    
    // Check if wallet is already connected
    const checkWalletConnection = async () => {
      if (window.ethereum && window.ethereum.selectedAddress) {
        try {
          const { address } = await walletService.connectWallet();
          setWalletConnected(true);
          setWalletAddress(address);
        } catch (error) {
          console.log('Wallet auto-connection failed:', error);
        }
      }
    };
    
    checkWalletConnection();
    
    // Refresh prices every 30 seconds and gas data every 60 seconds
    const priceInterval = setInterval(() => {
      fetchPrices(tokenSymbols);
    }, 30000);
    
    const gasInterval = setInterval(() => {
      fetchGasData();
    }, 60000);
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(gasInterval);
    };
  }, [walletService]);

  return (
    <div className={`${geistSans.className} ${geistMono.className} font-sans min-h-screen relative`} style={{
      background: 'radial-gradient(ellipse at center, #6f42c1, #5c4ba0, #58c0e0)',
      backgroundSize: '200% 200%',
      animation: 'gradientShift 6s ease-in-out infinite alternate'
    }}>
      <style jsx>{`
        @keyframes gradientShift {
          0% {
            background: radial-gradient(ellipse at 20% 50%, #6f42c1 0%, #5c4ba0 50%, #58c0e0 100%);
          }
          100% {
            background: radial-gradient(ellipse at 80% 50%, #6f42c1 0%, #5c4ba0 50%, #58c0e0 100%);
          }
        }
      `}</style>
      
      {/* Navbar with same styling as swap UI */}
      <nav className="bg-gray-800/90 backdrop-blur-md border-b border-gray-600/50 sticky top-0 z-50 shadow-xl">
        <div className="max-w-full px-40 py-6">
          <div className="flex items-center justify-between h-12">
            {/* Left side - Title and Nav Links */}
            <div className="flex items-center gap-20">
              {/* Title */}
              <img 
                src="/title.svg"
                alt="PegaSwap"
                onClick={() => window.location.href = '/main'}
                className="h-12 scale-150 cursor-pointer hover:opacity-80 transition-opacity duration-200"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'block';
                }}
              />
              <h1 
                onClick={() => window.location.href = '/main'}
                className="text-4xl font-bold text-white cursor-pointer hover:text-gray-200 transition-colors hidden"
              >
                PegaSwap
              </h1>
              
              {/* Navigation Links */}
              <div className="flex items-center gap-6 transform translate-y-1">
                <a 
                  href="/portfolio"
                  className="text-xl font-semibold text-gray-300 hover:text-white hover:scale-[1.02] transition-all duration-200"
                >
                  Portfolio
                </a>
                <span className="text-xl font-semibold text-gray-300 hover:text-white hover:scale-[1.02] transition-all duration-200 cursor-pointer">
                  NFT
                </span>
              </div>
            </div>
            
            {/* Wallet & Settings - Right */}
            <div className="flex items-center gap-4">
              {/* Wallet Address Box */}
              <div className="bg-gray-700/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-600 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${walletConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-mono text-gray-300">
                    {walletConnected 
                      ? `${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)}`
                      : 'Not Connected'
                    }
                  </span>
                </div>
              </div>
              
              {/* Settings Icon */}
              <button className="bg-gray-700/80 backdrop-blur-sm rounded-lg p-2 border border-gray-600 shadow-sm hover:bg-gray-600/90 transition-colors">
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4">
        <div className="flex gap-4">
          {/* Left Side - Swap Interface and Leaderboard */}
          <div className="flex-shrink-0 -ml-40 space-y-0">
            <div className="bg-gray-800/90 rounded-2xl p-6 shadow-2xl border border-gray-600/50 scale-85 w-[572px] min-w-[572px] max-w-[572px] backdrop-blur-md">
              
              {/* Pay Section */}
              <div className="bg-gray-700/50 rounded-xl p-8 mb-6">
                <label className="block text-xl font-medium text-gray-400 mb-4">Pay</label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatAmount(fromAmount)}
                        onChange={(e) => handleFromAmountChange(e.target.value)}
                        onKeyPress={(e) => {
                          if (!/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                            e.preventDefault();
                          }
                        }}
                        placeholder="0"
                        className="w-full bg-transparent text-4xl font-bold text-white placeholder-gray-500 focus:outline-none max-w-[150px] min-w-0"
                        style={{ width: '150px' }}
                      />
                      {fromAmount && parseFloat(fromAmount) > 0 && (
                        <div className="text-base text-gray-400 mt-1">
                          ≈ ${getUSDEquivalent(fromAmount, fromToken)}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowFromDropdown(!showFromDropdown)}
                        className="flex items-center gap-4 bg-gray-800 hover:bg-gray-700 rounded-2xl px-5 py-4 transition-all duration-200 border border-gray-600 hover:border-gray-500 shadow-lg"
                      >
                        <div className="relative">
                          <img 
                            src={getTokenLogo(fromToken, getTokenChain(fromToken))} 
                            alt={fromToken}
                            className="w-10 h-10 rounded-full"
                            onError={(e) => {
                              e.target.src = "https://via.placeholder.com/32x32/666666/ffffff?text=" + fromToken;
                            }}
                          />
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${getChainColor(getTokenChain(fromToken))} border-2 border-gray-800 flex items-center justify-center`}>
                            <img 
                              src={getChainLogo(getTokenChain(fromToken))} 
                              alt={getTokenChain(fromToken)}
                              className="w-3 h-3 rounded-full"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="text-white font-semibold text-xl">{fromToken}</div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Token Dropdown */}
                      {showFromDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-96 bg-gray-800 rounded-2xl shadow-2xl border border-gray-600 z-20 max-h-96 overflow-hidden">
                          <div className="p-4 border-b border-gray-700">
                            <h3 className="text-white font-semibold text-lg">Select a token</h3>
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {tokens.map((token, index) => (
                              <button
                                key={`${token.symbol}-${token.chain}-${index}`}
                                onClick={() => {
                                  setFromToken(token.symbol);
                                  setShowFromDropdown(false);
                                  // Recalculate amounts when token changes
                                  if (fromAmount) {
                                    handleFromAmountChange(fromAmount);
                                  }
                                }}
                                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-700 transition-colors text-left"
                              >
                                <div className="relative">
                                  <img 
                                    src={token.logo} 
                                    alt={token.symbol}
                                    className="w-10 h-10 rounded-full"
                                    onError={(e) => {
                                      e.target.src = "https://via.placeholder.com/40x40/666666/ffffff?text=" + token.symbol;
                                    }}
                                  />
                                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${getChainColor(token.chain)} border-2 border-gray-800 flex items-center justify-center`}>
                                    <img 
                                      src={getChainLogo(token.chain)} 
                                      alt={token.chain}
                                      className="w-3 h-3 rounded-full"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="text-white font-semibold text-base">{token.symbol}</div>
                                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${getChainColor(token.chain)}`}>
                                      {token.chain}
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-400">{token.name}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white font-medium">0.00</div>
                                  <div className="text-xs text-gray-400">$0.00</div>
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="p-4 border-t border-gray-700">
                            <button className="w-full flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <span className="font-medium">Import token</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Swap Arrow */}
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 bg-gray-600 hover:bg-gray-500 rounded-full flex items-center justify-center text-white cursor-pointer transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              {/* Receive Section */}
              <div className="bg-gray-700/50 rounded-xl p-8 mb-8">
                <label className="block text-xl font-medium text-gray-400 mb-4">Receive</label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatAmount(toAmount)}
                        onChange={(e) => handleToAmountChange(e.target.value)}
                        onKeyPress={(e) => {
                          if (!/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                            e.preventDefault();
                          }
                        }}
                        placeholder="0"
                        className="w-full bg-transparent text-4xl font-bold text-white placeholder-gray-500 focus:outline-none max-w-[150px] min-w-0"
                        style={{ width: '150px' }}
                      />
                      {toAmount && parseFloat(toAmount) > 0 && (
                        <div className="text-base text-gray-400 mt-1">
                          ≈ ${getUSDEquivalent(toAmount, toToken)}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowToDropdown(!showToDropdown)}
                        className="flex items-center gap-4 bg-gray-800 hover:bg-gray-700 rounded-2xl px-5 py-4 transition-all duration-200 border border-gray-600 hover:border-gray-500 shadow-lg"
                      >
                        {toToken ? (
                          <>
                            <div className="relative">
                              <img 
                                src={getTokenLogo(toToken, getTokenChain(toToken))} 
                                alt={toToken}
                                className="w-10 h-10 rounded-full"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/32x32/666666/ffffff?text=" + toToken;
                                }}
                              />
                              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getChainColor(getTokenChain(toToken))} border-2 border-gray-800 flex items-center justify-center`}>
                                <img 
                                  src={getChainLogo(getTokenChain(toToken))} 
                                  alt={getTokenChain(toToken)}
                                  className="w-3 h-3 rounded-full"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-white font-semibold text-lg">{toToken}</div>
                            </div>
                          </>
                        ) : (
                          <span className="text-white font-medium">Select token</span>
                        )}
                        <svg className="w-5 h-5 text-gray-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Token Dropdown */}
                      {showToDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-96 bg-gray-800 rounded-2xl shadow-2xl border border-gray-600 z-20 max-h-96 overflow-hidden">
                          <div className="p-4 border-b border-gray-700">
                            <h3 className="text-white font-semibold text-lg">Select a token</h3>
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {tokens.map((token, index) => (
                              <button
                                key={`${token.symbol}-${token.chain}-${index}`}
                                onClick={() => {
                                  setToToken(token.symbol);
                                  setShowToDropdown(false);
                                  // Recalculate amounts when token changes
                                  if (fromAmount) {
                                    handleFromAmountChange(fromAmount);
                                  }
                                }}
                                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-700 transition-colors text-left"
                              >
                                <div className="relative">
                                  <img 
                                    src={token.logo} 
                                    alt={token.symbol}
                                    className="w-10 h-10 rounded-full"
                                    onError={(e) => {
                                      e.target.src = "https://via.placeholder.com/40x40/666666/ffffff?text=" + token.symbol;
                                    }}
                                  />
                                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${getChainColor(token.chain)} border-2 border-gray-800 flex items-center justify-center`}>
                                    <img 
                                      src={getChainLogo(token.chain)} 
                                      alt={token.chain}
                                      className="w-3 h-3 rounded-full"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="text-white font-semibold text-base">{token.symbol}</div>
                                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${getChainColor(token.chain)}`}>
                                      {token.chain}
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-400">{token.name}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white font-medium">0.00</div>
                                  <div className="text-xs text-gray-400">$0.00</div>
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="p-4 border-t border-gray-700">
                            <button className="w-full flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <span className="font-medium">Import token</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Exchange Info - Inside Main Box */}
              <div className="bg-gray-700/30 rounded-xl p-6 mb-8">
                <div className="space-y-3 text-base">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Rate:</span>
                    <span className="text-white font-medium">
                      {currentRate ? 
                        `1 ${fromToken} ≈ ${parseFloat(currentRate).toFixed(6)} ${toToken}` :
                        fromAmount && toAmount && parseFloat(fromAmount) > 0 ? 
                        `1 ${fromToken} ≈ ${(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} ${toToken}` :
                        `1 ${fromToken} ≈ ${getConversionRate(fromToken, toToken).toFixed(6)} ${toToken}`
                      }
                      {loading && <span className="text-yellow-400 ml-2">↻</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Gas Fee:</span>
                    <span className="text-white font-medium">
                      {gasEstimate && gasData ? (
                        <>
                          {((parseInt(gasEstimate) * gasData.gasPrice) / 1e9).toFixed(6)} ETH ≈ ${((parseInt(gasEstimate) * gasData.gasPrice * (prices.ETH || gasData.ethPrice)) / 1e9).toFixed(2)}
                        </>
                      ) : gasData?.estimates?.uniswap_swap ? (
                        <>
                          {gasData.estimates.uniswap_swap.gasCostEth} ETH ≈ ${((parseFloat(gasData.estimates.uniswap_swap.gasCostEth) * (prices.ETH || gasData.ethPrice))).toFixed(2)}
                        </>
                      ) : (
                        loading ? "Calculating..." : `${((150000 * (gasData?.gasPrice || 20)) / 1e9).toFixed(6)} ETH ≈ $${((150000 * (gasData?.gasPrice || 20) * (prices.ETH || 2450)) / 1e9).toFixed(2)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">$PGS mint:</span>
                    <span className="text-white font-medium">20.999</span>
                  </div>
                </div>
              </div>

              {/* Swap Status Display */}
              {swapStatus && (
                <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4 mb-5">
                  <div className="text-center text-blue-300 text-base font-medium">
                    {swapStatus}
                  </div>
                </div>
              )}

              {/* Swap Button */}
              <button
                onClick={handleSwap}
                disabled={swapping}
                className={`w-full py-5 px-8 rounded-xl font-bold text-xl transition-colors shadow-lg ${
                  swapping 
                    ? 'bg-gray-600 cursor-not-allowed text-gray-300' 
                    : walletConnected
                      ? 'bg-pink-600 hover:bg-pink-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {swapping 
                  ? 'Processing...' 
                  : walletConnected 
                    ? 'Swap' 
                    : 'Connect Wallet'
                }
              </button>
            </div>
            
          </div>

          {/* Right Side - Picture - More to the right */}
          <div className="flex items-center justify-start ml-20">
            <img 
              src="/pegasus.svg" 
              alt="PegaSwap" 
              className="h-[720px] w-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 