import { useState, useEffect } from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import { WalletService } from "../utils/walletUtils";
import RealTimeTokenPrice from "../components/RealTimeTokenPrice";
import useRealTimePrice from "../hooks/useRealTimePrice";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Mock portfolio data - in real app this would come from API
const mockPortfolioData = [
  {
    symbol: "ETH",
    name: "Ethereum", 
    balance: "2.45",
    value: 6002.50,
    price: 2450.00,
    change24h: 5.2,
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    priceHistory: [2380, 2410, 2390, 2420, 2450, 2480, 2450, 2470, 2450]
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    balance: "1500.00", 
    value: 1500.00,
    price: 1.00,
    change24h: 0.1,
    logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    priceHistory: [0.999, 1.000, 0.998, 1.001, 1.000, 0.999, 1.000, 1.001, 1.000]
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    balance: "0.05",
    value: 2250.00,
    price: 45000.00,
    change24h: -2.1,
    logo: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    priceHistory: [44500, 45200, 44800, 45500, 45000, 46000, 45200, 44800, 45000]
  },
  {
    symbol: "MATIC",
    name: "Polygon",
    balance: "800.00",
    value: 640.00,
    price: 0.80,
    change24h: 3.4,
    logo: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
    priceHistory: [0.75, 0.78, 0.76, 0.82, 0.80, 0.84, 0.81, 0.79, 0.80]
  }
];


// Helper function to map token symbols to CoinGecko IDs
const getCoinGeckoId = (symbol) => {
  const coinGeckoMapping = {
    'ETH': 'ethereum',
    'BTC': 'bitcoin',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'MATIC': 'matic-network',
    'BNB': 'binancecoin',
    'AVAX': 'avalanche-2',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'DAI': 'dai'
  };
  
  return coinGeckoMapping[symbol?.toUpperCase()] || 'ethereum';
};

export default function Portfolio() {
  const [selectedToken, setSelectedToken] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  
  // Wallet states
  const [walletService] = useState(() => new WalletService());
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);

  // Get real-time price for selected token
  const { 
    price: realTimePrice, 
    loading: priceLoading, 
    error: priceError, 
    usingFallback, 
    isLive 
  } = useRealTimePrice(selectedToken?.symbol);

  useEffect(() => {
    // Sort by value and set highest as default
    const sortedPortfolio = [...mockPortfolioData].sort((a, b) => b.value - a.value);
    setPortfolio(sortedPortfolio);
    setSelectedToken(sortedPortfolio[0]);
    
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
  }, [walletService]);

  const totalValue = portfolio.reduce((sum, token) => sum + token.value, 0);

  // Calculate real-time value using live Price
  const getRealTimeValue = (token) => {
    if (token.symbol === selectedToken?.symbol && realTimePrice && !priceLoading) {
      return parseFloat(token.balance) * realTimePrice;
    }
    return token.value; // fallback to mock value
  };

  return (
    <div className={`${geistSans.className} ${geistMono.className} font-sans min-h-screen relative`} style={{
      background: 'radial-gradient(ellipse at center, #6f42c1, #5c4ba0, #58c0e0)'
    }}>
      
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
              <div className="flex items-center gap-8 transform translate-y-1">
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

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex gap-6 h-screen">
          {/* Left Side - Token Holdings */}
          <div className="w-1/3">
            {/* Combined Portfolio Summary and Holdings */}
            <div className="bg-gray-800/90 rounded-2xl border border-gray-600/50 backdrop-blur-md shadow-xl overflow-hidden">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white mb-2">Total Portfolio Value</h2>
                <div className="text-3xl font-bold text-green-400 mb-4">
                  ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {portfolio.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => setSelectedToken(token)}
                    className={`w-full p-4 flex items-center gap-4 hover:bg-gray-700 transition-colors border-l-4 ${
                      selectedToken?.symbol === token.symbol 
                        ? 'bg-gray-700 border-l-blue-500' 
                        : 'border-l-transparent'
                    }`}
                  >
                    <img 
                      src={token.logo} 
                      alt={token.symbol}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        e.target.src = `https://via.placeholder.com/40x40/666666/ffffff?text=${token.symbol}`;
                      }}
                    />
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">{token.symbol}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          token.change24h >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {token.change24h >= 0 ? '+' : ''}{token.change24h}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">{token.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">
                        ${token.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-400">
                        {parseFloat(token.balance).toLocaleString()} {token.symbol}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Real-Time Price and Token Details */}
          <div className="flex-1 space-y-4">
            {selectedToken && (
              <>
                {/* Token Info Header - Updated with Real-Time Data */}
                <div className="bg-gray-800/90 rounded-2xl p-6 border border-gray-600/50 backdrop-blur-md shadow-xl">
                  <div className="flex items-center gap-4 mb-4">
                    <img 
                      src={selectedToken.logo} 
                      alt={selectedToken.symbol}
                      className="w-12 h-12 rounded-full"
                      onError={(e) => {
                        e.target.src = `https://via.placeholder.com/48x48/666666/ffffff?text=${selectedToken.symbol}`;
                      }}
                    />
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedToken.name}</h2>
                      <div className="text-gray-400">{selectedToken.symbol}</div>
                      {(priceError || usingFallback) && (
                        <div className="text-xs text-yellow-400">
                          ⚠ {priceError || 'Using fallback price'}
                        </div>
                      )}
                      {isLive && (
                        <div className="text-xs text-green-400">
                          ● Live price from 1inch
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">Real-Time Price (1inch)</div>
                      <div className="text-xl font-bold text-white">
                        {priceLoading ? (
                          <div className="animate-pulse bg-gray-700 h-6 w-20 rounded"></div>
                        ) : (
                          `$${realTimePrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || selectedToken.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Balance (Mock)</div>
                      <div className="text-xl font-bold text-white">
                        {parseFloat(selectedToken.balance).toLocaleString()} {selectedToken.symbol}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Value (Real-Time)</div>
                      <div className="text-xl font-bold text-white">
                        {priceLoading ? (
                          <div className="animate-pulse bg-gray-700 h-6 w-24 rounded"></div>
                        ) : (
                          `$${getRealTimeValue(selectedToken).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Real-time indicator */}
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                    <div className={`w-2 h-2 rounded-full ${
                      isLive 
                        ? 'bg-green-500 animate-pulse' 
                        : usingFallback 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                    }`}></div>
                    <span>
                      {isLive 
                        ? 'Live price updates via 1inch API' 
                        : usingFallback 
                          ? 'Using fallback prices' 
                          : 'Price service unavailable'
                      }
                    </span>
                  </div>
                </div>

                {/* Real-Time Token Price Component - Moved Below Token Info */}
                <RealTimeTokenPrice 
                  tokenName={selectedToken?.symbol || 'ETH'}
                  coinGeckoId={getCoinGeckoId(selectedToken?.symbol || 'ETH')}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}