import { useState } from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import RealTimeTokenPrice from "../components/RealTimeTokenPrice";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Supported tokens with their CoinGecko IDs
const supportedTokens = [
  {
    name: 'ETH',
    coinGeckoId: 'ethereum'
  },
  {
    name: 'BTC',
    coinGeckoId: 'bitcoin'
  },
  {
    name: 'USDC',
    coinGeckoId: 'usd-coin'
  },
  {
    name: 'LINK',
    coinGeckoId: 'chainlink'
  }
];

export default function TokenPriceDemo() {
  const [selectedToken, setSelectedToken] = useState(supportedTokens[0]);
  const [customToken, setCustomToken] = useState({
    name: '',
    coinGeckoId: ''
  });
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleCustomTokenSubmit = (e) => {
    e.preventDefault();
    if (customToken.name && customToken.coinGeckoId) {
      setSelectedToken(customToken);
      setShowCustomInput(false);
    }
  };

  return (
    <div className={`${geistSans.className} ${geistMono.className} font-sans min-h-screen relative`} style={{
      background: 'radial-gradient(ellipse at center, #6f42c1, #5c4ba0, #58c0e0)'
    }}>
      
      {/* Navbar */}
      <nav className="bg-gray-800/90 backdrop-blur-md border-b border-gray-600/50 sticky top-0 z-50 shadow-xl">
        <div className="max-w-full px-40 py-6">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-20">
              <h1 
                onClick={() => window.location.href = '/main'}
                className="text-4xl font-bold text-white cursor-pointer hover:text-gray-200 transition-colors"
              >
                Real-Time Token Price Demo
              </h1>
              
              <div className="flex items-center gap-8 transform translate-y-1">
                <a 
                  href="/main"
                  className="text-xl font-semibold text-gray-300 hover:text-white hover:scale-[1.02] transition-all duration-200"
                >
                  ← Back to Main
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Token Selector */}
          <div className="space-y-4">
            <div className="bg-gray-800/90 rounded-2xl p-6 border border-gray-600/50 backdrop-blur-md shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4">Select Token</h2>
              
              {/* Predefined Tokens */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {supportedTokens.map((token) => (
                  <button
                    key={token.name}
                    onClick={() => setSelectedToken(token)}
                    className={`p-3 rounded-lg border transition-all duration-200 ${
                      selectedToken.name === token.name
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {token.name}
                  </button>
                ))}
              </div>

              {/* Custom Token Input */}
              <button
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 transition-colors mb-4"
              >
                {showCustomInput ? 'Hide Custom Input' : 'Enter Custom Token'}
              </button>

              {showCustomInput && (
                <form onSubmit={handleCustomTokenSubmit} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Token Name (e.g., ETH)"
                    value={customToken.name}
                    onChange={(e) => setCustomToken(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="CoinGecko ID (e.g., ethereum)"
                    value={customToken.coinGeckoId}
                    onChange={(e) => setCustomToken(prev => ({ ...prev, coinGeckoId: e.target.value }))}
                    className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                  >
                    Apply Custom Token
                  </button>
                </form>
              )}
            </div>

            {/* API Information */}
            <div className="bg-gray-800/90 rounded-2xl p-6 border border-gray-600/50 backdrop-blur-md shadow-xl">
              <h3 className="text-lg font-bold text-white mb-3">API Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Real-time Price:</span>
                  <span className="text-green-400 ml-2">CoinGecko API</span>
                </div>
                <div>
                  <span className="text-gray-400">Historical Chart:</span>
                  <span className="text-blue-400 ml-2">CoinGecko API</span>
                </div>
                <div>
                  <span className="text-gray-400">Update Frequency:</span>
                  <span className="text-white ml-2">Every 5 seconds</span>
                </div>
                <div>
                  <span className="text-gray-400">Chart Period:</span>
                  <span className="text-white ml-2">24 hours</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Price Component */}
          <div>
            <RealTimeTokenPrice 
              key={`${selectedToken.name}-${selectedToken.coinGeckoId}`}
              tokenName={selectedToken.name}
              coinGeckoId={selectedToken.coinGeckoId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}