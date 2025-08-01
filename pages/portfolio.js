import { useState, useEffect } from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import { WalletService } from "../utils/walletUtils";

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

// Simple Line Chart Component
const LineChart = ({ data, height = 200 }) => {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = ((max - value) / range) * 80 + 10; // 10% margin top/bottom
    return `${x},${y}`;
  }).join(' ');

  const isPositive = data[data.length - 1] >= data[0];
  const strokeColor = isPositive ? '#10b981' : '#ef4444';
  const fillColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gradient-${data.length}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path
          d={`M ${points} L 100,100 L 0,100 Z`}
          fill={`url(#gradient-${data.length})`}
        />
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default function Portfolio() {
  const [selectedToken, setSelectedToken] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  
  // Wallet states
  const [walletService] = useState(() => new WalletService());
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);

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

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex gap-6 h-screen">
          {/* Left Side - Token Holdings */}
          <div className="w-1/3 space-y-4">
            {/* Portfolio Summary */}
            <div className="bg-gray-800/90 rounded-2xl p-6 border border-gray-600/50 backdrop-blur-md shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2">Total Portfolio Value</h2>
              <div className="text-3xl font-bold text-green-400">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Token Holdings List */}
            <div className="bg-gray-800/90 rounded-2xl border border-gray-600/50 backdrop-blur-md shadow-xl overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Holdings</h3>
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

          {/* Right Side - Chart and Token Details */}
          <div className="flex-1 space-y-4">
            {selectedToken && (
              <>
                {/* Token Info Header */}
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
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">Price</div>
                      <div className="text-xl font-bold text-white">
                        ${selectedToken.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Balance</div>
                      <div className="text-xl font-bold text-white">
                        {parseFloat(selectedToken.balance).toLocaleString()} {selectedToken.symbol}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Value</div>
                      <div className="text-xl font-bold text-white">
                        ${selectedToken.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price Chart */}
                <div className="bg-gray-800/90 rounded-2xl p-6 border border-gray-600/50 backdrop-blur-md shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Price Chart</h3>
                    <div className={`text-sm px-3 py-1 rounded-full ${
                      selectedToken.change24h >= 0 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {selectedToken.change24h >= 0 ? '+' : ''}{selectedToken.change24h}% (24h)
                    </div>
                  </div>
                  
                  <div className="h-64 mb-4">
                    <LineChart data={selectedToken.priceHistory} height={250} />
                  </div>
                  
                  <div className="text-xs text-gray-400 text-center">
                    Last 9 data points
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}