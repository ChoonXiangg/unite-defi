import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { useState } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Main() {
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("USDC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  // Mock token data - in real app, this would come from API
  const tokens = [
    { symbol: "ETH", name: "Ethereum", chain: "EVM", icon: "🔷" },
    { symbol: "USDC", name: "USD Coin", chain: "EVM", icon: "🔵" },
    { symbol: "USDC", name: "USD Coin", chain: "Tezos", icon: "🔵" },
    { symbol: "USDT", name: "Tether", chain: "EVM", icon: "🟢" },
    { symbol: "BTC", name: "Bitcoin", chain: "EVM", icon: "🟡" },
    { symbol: "XTZ", name: "Tezos", chain: "Tezos", icon: "🟣" },
    { symbol: "kUSD", name: "Kolibri USD", chain: "Tezos", icon: "💰" },
    { symbol: "BNB", name: "BNB", chain: "EVM", icon: "🟠" },
    { symbol: "MATIC", name: "Polygon", chain: "EVM", icon: "🟣" },
    { symbol: "AVAX", name: "Avalanche", chain: "EVM", icon: "🔴" },
  ];

  const chains = [
    { name: "EVM", icon: "🔷" },
    { name: "Tezos", icon: "🟣" },
  ];

  const handleSwap = () => {
    console.log(`Swapping ${fromAmount} ${fromToken} to ${toToken}`);
  };

  // Bidirectional calculation
  const handleFromAmountChange = (value) => {
    setFromAmount(value);
    if (value && !isNaN(value) && parseFloat(value) > 0) {
      // Mock conversion rate - in real app, this would come from API
      const rate = getConversionRate(fromToken, toToken);
      setToAmount((parseFloat(value) * rate).toFixed(6));
    } else {
      setToAmount("");
    }
  };

  const handleToAmountChange = (value) => {
    setToAmount(value);
    if (value && !isNaN(value) && parseFloat(value) > 0) {
      // Mock conversion rate - in real app, this would come from API
      const rate = getConversionRate(toToken, fromToken);
      setFromAmount((parseFloat(value) * rate).toFixed(6));
    } else {
      setFromAmount("");
    }
  };

  const getConversionRate = (from, to) => {
    const rates = {
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
    return (rates[to] || 1) / (rates[from] || 1);
  };

  const getTokenIcon = (symbol) => {
    return tokens.find(token => token.symbol === symbol)?.icon || "🪙";
  };

  const getChainIcon = (chainName) => {
    return chains.find(chain => chain.name === chainName)?.icon || "🔷";
  };

  const getTokenChain = (symbol) => {
    return tokens.find(token => token.symbol === symbol)?.chain || "EVM";
  };

  const getUSDEquivalent = (amount, token) => {
    const rates = {
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
    const value = parseFloat(amount) * (rates[token] || 1);
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

  return (
    <div className={`${geistSans.className} ${geistMono.className} font-sans min-h-screen bg-gray-900`}>
      {/* Dark Navbar */}
      <nav className="bg-gray-800/50 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex justify-center items-center">
            {/* Logo/Title - Centered */}
            <h1 className="text-4xl font-bold text-white">PegaSwap</h1>
          </div>
        </div>
      </nav>

      {/* Wallet & Settings - Absolute positioned in top right */}
      <div className="fixed top-6 right-8 flex items-center gap-4 z-50">
        {/* Wallet Address Box */}
        <div className="bg-gray-700/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-600 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-mono text-gray-300">0x1234...5678</span>
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

      <div className="max-w-7xl mx-auto p-8">
        <div className="flex gap-4">
          {/* Left Side - Swap Interface (30%) - Smaller and more left */}
          <div className="w-3/10 ml-4">
            <div className="bg-gray-800 rounded-2xl p-5 shadow-2xl border border-gray-700 scale-85">
              
              {/* Pay Section */}
              <div className="bg-gray-700/50 rounded-xl p-6 mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-3">Pay</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={formatAmount(fromAmount)}
                      onChange={(e) => handleFromAmountChange(e.target.value)}
                      placeholder="0"
                      className="flex-1 bg-transparent text-3xl font-bold text-white placeholder-gray-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="relative">
                      <button
                        onClick={() => setShowFromDropdown(!showFromDropdown)}
                        className="flex items-center gap-3 bg-gray-600 hover:bg-gray-500 rounded-xl px-4 py-3 transition-colors"
                      >
                        <span className="text-2xl">{getTokenIcon(fromToken)}</span>
                        <div className="text-left">
                          <div className="text-white font-medium text-lg">{fromToken}</div>
                        </div>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Token Dropdown */}
                      {showFromDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-72 bg-gray-700 rounded-xl shadow-xl border border-gray-600 z-10 max-h-60 overflow-y-auto">
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
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-600 transition-colors text-left first:rounded-t-xl last:rounded-b-xl"
                            >
                              <span className="text-xl">{token.icon}</span>
                              <div className="flex-1">
                                <div className="text-white font-medium">{token.symbol}</div>
                                <div className="text-sm text-gray-400">{token.name}</div>
                              </div>
                              <div className="text-xs text-gray-500">on {token.chain}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Chain Label */}
                  <div className="text-xs text-gray-500 ml-1">
                    on {getTokenChain(fromToken)}
                  </div>
                  
                  {/* USD Equivalent */}
                  {fromAmount && parseFloat(fromAmount) > 0 && (
                    <div className="text-sm text-gray-400 ml-1">
                      ≈ ${getUSDEquivalent(fromAmount, fromToken)}
                    </div>
                  )}
                </div>
              </div>

              {/* Swap Arrow */}
              <div className="flex justify-center mb-4">
                <div className="w-10 h-10 bg-gray-600 hover:bg-gray-500 rounded-full flex items-center justify-center text-white cursor-pointer transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              {/* Receive Section */}
              <div className="bg-gray-700/50 rounded-xl p-6 mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-3">Receive</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={formatAmount(toAmount)}
                      onChange={(e) => handleToAmountChange(e.target.value)}
                      placeholder="0"
                      className="flex-1 bg-transparent text-3xl font-bold text-white placeholder-gray-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="relative">
                      <button
                        onClick={() => setShowToDropdown(!showToDropdown)}
                        className="flex items-center gap-3 bg-pink-600 hover:bg-pink-500 rounded-xl px-4 py-3 transition-colors"
                      >
                        {toToken ? (
                          <>
                            <span className="text-2xl">{getTokenIcon(toToken)}</span>
                            <div className="text-left">
                              <div className="text-white font-medium text-lg">{toToken}</div>
                            </div>
                          </>
                        ) : (
                          <span className="text-white font-medium">Select token</span>
                        )}
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Token Dropdown */}
                      {showToDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-72 bg-gray-700 rounded-xl shadow-xl border border-gray-600 z-10 max-h-60 overflow-y-auto">
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
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-600 transition-colors text-left first:rounded-t-xl last:rounded-b-xl"
                            >
                              <span className="text-xl">{token.icon}</span>
                              <div className="flex-1">
                                <div className="text-white font-medium">{token.symbol}</div>
                                <div className="text-sm text-gray-400">{token.name}</div>
                              </div>
                              <div className="text-xs text-gray-500">on {token.chain}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Chain Label */}
                  {toToken && (
                    <div className="text-xs text-gray-500 ml-1">
                      on {getTokenChain(toToken)}
                    </div>
                  )}
                  
                  {/* USD Equivalent */}
                  {toAmount && parseFloat(toAmount) > 0 && (
                    <div className="text-sm text-gray-400 ml-1">
                      ≈ ${getUSDEquivalent(toAmount, toToken)}
                    </div>
                  )}
                </div>
              </div>

              {/* Exchange Info - Inside Main Box */}
              <div className="bg-gray-700/30 rounded-xl p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Rate:</span>
                    <span className="text-white font-medium">1 ETH ≈ 2450 USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Gas Fee:</span>
                    <span className="text-white font-medium">0.004 ETH ≈ $6.20</span>
                  </div>
                </div>
              </div>

              {/* Swap Button */}
              <button
                onClick={handleSwap}
                className="w-full bg-pink-600 hover:bg-pink-500 text-white py-4 px-6 rounded-xl font-bold text-lg transition-colors shadow-lg"
              >
                Swap
              </button>
            </div>
          </div>

          {/* Right Side - Picture (60%) */}
          <div className="w-3/5 flex items-center justify-center">
            <img 
              src="/pegaswap-pic.png" 
              alt="PegaSwap" 
              className="max-w-full h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 