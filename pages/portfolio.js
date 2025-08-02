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
    symbol: "1INCH",
    name: "1inch Network", 
    balance: "15000.00",
    value: 8750.00,
    price: 0.583,
    change24h: 12.4,
    logo: "https://assets.coingecko.com/coins/images/13469/small/1inch-token.png",
    priceHistory: [0.520, 0.545, 0.560, 0.575, 0.583, 0.590, 0.585, 0.580, 0.583]
  },
  {
    symbol: "PGS",
    name: "PegaSwap",
    balance: "2500.00",
    value: 6750.00,
    price: 2.70,
    change24h: 8.5,
    logo: "/PGS-logo-original.svg",
    priceHistory: [2.45, 2.52, 2.61, 2.68, 2.70, 2.75, 2.72, 2.69, 2.70]
  },
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
    symbol: "XTZ",
    name: "Tezos",
    balance: "3500.00",
    value: 4200.00,
    price: 1.20,
    change24h: 3.2,
    logo: "https://assets.coingecko.com/coins/images/976/small/Tezos-logo.png",
    priceHistory: [1.15, 1.18, 1.16, 1.19, 1.20, 1.22, 1.21, 1.18, 1.20]
  }
];


// Helper function to map token symbols to CoinGecko IDs
const getCoinGeckoId = (symbol) => {
  const coinGeckoMapping = {
    '1INCH': '1inch',
    'ETH': 'ethereum',
    'USDC': 'usd-coin',
    'XTZ': 'tezos',
    'PGS': 'ethereum' // PGS uses ethereum as fallback since it's custom token
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
  
  // Multi-chain portfolio states
  const [multiChainData, setMultiChainData] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState(null);
  const [selectedChain, setSelectedChain] = useState(null);

  // Get real-time price for selected token
  const { 
    price: realTimePrice, 
    loading: priceLoading, 
    error: priceError, 
    usingFallback, 
    isLive 
  } = useRealTimePrice(selectedToken?.symbol);

  // Fetch multi-chain portfolio data
  const fetchMultiChainPortfolio = async (address) => {
    if (!address) return;
    
    setPortfolioLoading(true);
    setPortfolioError(null);
    
    try {
      console.log('🔄 Fetching multi-chain portfolio for:', address);
      const response = await fetch(`/api/portfolio/multi-chain?walletAddress=${address}`);
      const result = await response.json();
      
      if (result.success) {
        setMultiChainData(result.data);
        
        // Convert to portfolio format for compatibility
        const allTokens = [];
        
        Object.values(result.data.chains).forEach(chain => {
          if (chain.tokens && chain.tokens.length > 0) {
            chain.tokens.forEach(token => {
              if (token.metadata && token.numericBalance > 0) {
                const tokenInfo = {
                  symbol: token.metadata.symbol,
                  name: token.metadata.name,
                  balance: token.formattedBalance,
                  value: token.estimatedValueUSD || 0,
                  price: result.data.tokenLogos[token.metadata.symbol]?.currentPrice || 0,
                  change24h: result.data.tokenLogos[token.metadata.symbol]?.priceChange24h || 0,
                  logo: result.data.tokenLogos[token.metadata.symbol]?.logoUrl || token.metadata.logoURI || `https://via.placeholder.com/40x40/666666/ffffff?text=${token.metadata.symbol}`,
                  chainId: token.chainId,
                  chainName: token.chainName,
                  address: token.address,
                  decimals: token.metadata.decimals,
                  isRealData: true
                };
                allTokens.push(tokenInfo);
              }
            });
          }
        });

        // Add mock holdings for PGS, 1INCH, and Tezos if not found in real data
        const foundSymbols = new Set(allTokens.map(token => token.symbol.toUpperCase()));
        
        const mockTokensToAdd = [
          {
            symbol: "PGS",
            name: "PegaSwap",
            balance: "2500.00",
            value: 6750.00,
            price: 2.70,
            change24h: 8.5,
            logo: "/PGS-logo-original.svg",
            chainName: "Mock",
            isRealData: false
          },
          {
            symbol: "1INCH",
            name: "1inch Network", 
            balance: "15000.00",
            value: 8750.00,
            price: 0.583,
            change24h: 12.4,
            logo: "https://assets.coingecko.com/coins/images/13469/small/1inch-token.png",
            chainName: "Mock",
            isRealData: false
          },
          {
            symbol: "XTZ",
            name: "Tezos",
            balance: "3500.00",
            value: 4200.00,
            price: 1.20,
            change24h: 3.2,
            logo: "https://assets.coingecko.com/coins/images/976/small/Tezos-logo.png",
            chainName: "Mock",
            isRealData: false
          }
        ];

        // Add mock tokens if they weren't found in real wallet data
        mockTokensToAdd.forEach(mockToken => {
          if (!foundSymbols.has(mockToken.symbol)) {
            allTokens.push(mockToken);
            console.log(`📝 Added mock holding for ${mockToken.symbol}: ${mockToken.balance} (${mockToken.value} USD)`);
          }
        });
        
        // Sort by balance value and set as portfolio
        const sortedTokens = allTokens.sort((a, b) => b.value - a.value);
        setPortfolio(sortedTokens);
        
        if (sortedTokens.length > 0) {
          setSelectedToken(sortedTokens[0]);
        }
        
        console.log(`✅ Portfolio loaded: ${allTokens.length} tokens across ${result.data.summary.networksWithBalance} networks`);
        
      } else {
        throw new Error(result.error || 'Failed to fetch portfolio');
      }
    } catch (error) {
      console.error('❌ Failed to load multi-chain portfolio:', error);
      setPortfolioError(error.message);
      
      // Fallback to mock data
      const sortedPortfolio = [...mockPortfolioData].sort((a, b) => b.value - a.value);
      setPortfolio(sortedPortfolio);
      setSelectedToken(sortedPortfolio[0]);
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    // Check if wallet is already connected
    const checkWalletConnection = async () => {
      if (window.ethereum && window.ethereum.selectedAddress) {
        try {
          const { address } = await walletService.connectWallet();
          setWalletConnected(true);
          setWalletAddress(address);
          
          // Fetch real portfolio data
          await fetchMultiChainPortfolio(address);
          
        } catch (error) {
          console.log('Wallet auto-connection failed:', error);
          // Fallback to mock data
          const sortedPortfolio = [...mockPortfolioData].sort((a, b) => b.value - a.value);
          setPortfolio(sortedPortfolio);
          setSelectedToken(sortedPortfolio[0]);
        }
      } else {
        // No wallet connected, use mock data
        const sortedPortfolio = [...mockPortfolioData].sort((a, b) => b.value - a.value);
        setPortfolio(sortedPortfolio);
        setSelectedToken(sortedPortfolio[0]);
      }
      
      // Store PGS balance in localStorage for nft.js to access
      const pgsToken = mockPortfolioData.find(token => token.symbol === 'PGS');
      if (pgsToken) {
        localStorage.setItem('pgsBalance', pgsToken.balance);
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
    <div className={`${geistSans.className} ${geistMono.className} min-h-screen relative`} style={{
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
                  className="text-xl font-semibold text-white hover:scale-[1.02] transition-all duration-200 font-supercell"
                >
                  Portfolio
                </a>
                <a 
                  href="/nft"
                  className="text-xl font-semibold text-gray-300 hover:text-white hover:scale-[1.02] transition-all duration-200 font-supercell"
                >
                  NFT
                </a>
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
                <h2 className="text-xl font-bold text-white mb-2 font-supercell">Holdings</h2>
                <div className="text-3xl font-bold text-green-400 mb-4">
                  ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
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
                    {token.symbol === 'PGS' ? (
                      <div className="w-10 h-10 rounded-full bg-white border border-gray-300 flex items-center justify-center">
                        <img 
                          src="/PGS-logo-original.svg"
                          alt={token.symbol}
                          className="w-12 h-12 object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<span class="text-xs font-bold text-gray-600">PGS</span>';
                          }}
                        />
                      </div>
                    ) : (
                      <img 
                        src={token.logo} 
                        alt={token.symbol}
                        className="w-10 h-10 rounded-full"
                        onError={(e) => {
                          e.target.src = `https://via.placeholder.com/40x40/666666/ffffff?text=${token.symbol}`;
                        }}
                      />
                    )}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold font-supercell" style={{fontSize: '80%'}}>{token.symbol}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          token.change24h >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {token.change24h >= 0 ? '+' : ''}{token.change24h}%
                        </span>
                        {token.isRealData === false && (
                          <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                            Mock
                          </span>
                        )}
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
                    {selectedToken.symbol === 'PGS' ? (
                      <div className="w-12 h-12 rounded-full bg-white border border-gray-300 flex items-center justify-center">
                        <img 
                          src="/PGS-logo-original.svg"
                          alt={selectedToken.symbol}
                          className="w-16 h-16 object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<span class="text-sm font-bold text-gray-600">PGS</span>';
                          }}
                        />
                      </div>
                    ) : (
                      <img 
                        src={selectedToken.logo} 
                        alt={selectedToken.symbol}
                        className="w-12 h-12 rounded-full"
                        onError={(e) => {
                          e.target.src = `https://via.placeholder.com/48x48/666666/ffffff?text=${selectedToken.symbol}`;
                        }}
                      />
                    )}
                    <div>
                      <h2 className="text-2xl font-bold text-white font-supercell">{selectedToken.name}</h2>
                      <div className="text-gray-400">{selectedToken.symbol}</div>
                      {(priceError || usingFallback) && (
                        <div className="text-xs text-yellow-400">
                          ⚠ {priceError || 'Using fallback price'}
                        </div>
                      )}
                      {isLive && (
                        <div className="text-xs text-green-400">
                          ● Live price from CoinGecko
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">Real-Time Price (CoinGecko)</div>
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
                        ? 'Live price updates via CoinGecko API' 
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

        {/* Multi-Chain Portfolio Overview Section */}
        {multiChainData && walletConnected && (
          <div className="mt-8 bg-gray-800/90 rounded-2xl border border-gray-600/50 backdrop-blur-md shadow-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6 font-supercell">🌐 Multi-Chain Portfolio Overview</h2>
            
            {/* Portfolio Loading State */}
            {portfolioLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-gray-300">Loading multi-chain portfolio...</span>
              </div>
            )}
            
            {/* Portfolio Error State */}
            {portfolioError && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-red-400">❌ {portfolioError}</p>
                <p className="text-red-300 text-sm mt-1">Showing mock data as fallback</p>
              </div>
            )}
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                <p className="text-2xl font-bold text-indigo-400">{multiChainData.summary.totalChains}</p>
                <p className="text-sm text-indigo-300">Total Chains</p>
              </div>
              <div className="text-center p-4 bg-green-500/20 rounded-lg border border-green-500/30">
                <p className="text-2xl font-bold text-green-400">{multiChainData.summary.networksWithBalance}</p>
                <p className="text-sm text-green-300">Active Networks</p>
              </div>
              <div className="text-center p-4 bg-purple-500/20 rounded-lg border border-purple-500/30">
                <p className="text-2xl font-bold text-purple-400">{multiChainData.summary.totalTokens}</p>
                <p className="text-sm text-purple-300">Total Tokens</p>
              </div>
              <div className="text-center p-4 bg-orange-500/20 rounded-lg border border-orange-500/30">
                <p className="text-2xl font-bold text-orange-400">{Object.keys(multiChainData.gasContext).length}</p>
                <p className="text-sm text-orange-300">Gas Data</p>
              </div>
            </div>

            {/* Chain Details */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-300 mb-3 font-supercell">Chain Details:</h4>
              {Object.entries(multiChainData.chains).map(([chainId, chainData]) => (
                <div key={chainId} className="bg-gray-700/50 rounded-lg border border-gray-600/30">
                  <div className="flex justify-between items-center p-4">
                    <div>
                      <span className="font-medium text-white font-supercell">{chainData.chainName}</span>
                      <span className="text-sm text-gray-400 ml-2">({chainId})</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-indigo-400">{chainData.tokenCount || 0}</span>
                      <span className="text-sm text-gray-400 ml-1">tokens</span>
                      {chainData.gasInfo && (
                        <div className="text-xs text-gray-500">
                          Gas: {typeof chainData.gasInfo.standard === 'object' ? 
                            (chainData.gasInfo.standard.maxFeePerGas || chainData.gasInfo.standard.gasPrice || 'N/A') : 
                            chainData.gasInfo.standard} gwei
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Token Details */}
                  {chainData.tokens && chainData.tokens.length > 0 && (
                    <div className="px-4 pb-4">
                      <div className="text-xs text-gray-400 mb-2">Tokens:</div>
                      <div className="space-y-2">
                        {chainData.tokens.slice(0, 10).map((token, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-gray-600/30 p-3 rounded border border-gray-600/20">
                            <div className="flex items-center gap-3">
                              {multiChainData.tokenLogos[token.metadata?.symbol] ? (
                                <img 
                                  src={multiChainData.tokenLogos[token.metadata.symbol].logoUrl}
                                  alt={token.metadata?.symbol}
                                  className="w-6 h-6 rounded-full"
                                  onError={(e) => {
                                    e.target.src = `https://via.placeholder.com/24x24/666666/ffffff?text=${token.metadata?.symbol}`;
                                  }}
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center text-xs text-white">
                                  {token.metadata?.symbol?.charAt(0) || '?'}
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-white">
                                  {token.metadata?.symbol || `${token.address.slice(0, 6)}...`}
                                </span>
                                {token.metadata?.name && (
                                  <span className="text-gray-400 ml-1">({token.metadata.name})</span>
                                )}
                              </div>
                            </div>
                            <div className="font-mono text-gray-300 text-right">
                              <div>{token.formattedBalance}</div>
                              {multiChainData.tokenLogos[token.metadata?.symbol]?.currentPrice && (
                                <div className="text-xs text-gray-500">
                                  ${multiChainData.tokenLogos[token.metadata?.symbol]?.currentPrice?.toFixed(4)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {chainData.tokens.length > 10 && (
                          <div className="text-xs text-gray-500 text-center py-2">
                            ... and {chainData.tokens.length - 10} more tokens
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 text-xs text-gray-500 text-center">
              🔗 Powered by 1inch Balance API + Gas API + Token API + CoinGecko Logos
            </div>
          </div>
        )}

        {/* Connect Wallet Prompt */}
        {!walletConnected && (
          <div className="mt-8 bg-gray-800/90 rounded-2xl border border-gray-600/50 backdrop-blur-md shadow-xl p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-4 font-supercell">Connect Wallet for Real Portfolio Data</h3>
            <p className="text-gray-400 mb-6">
              Connect your wallet to see your actual multi-chain token holdings and balances
            </p>
            <button
              onClick={async () => {
                try {
                  const { address } = await walletService.connectWallet();
                  setWalletConnected(true);
                  setWalletAddress(address);
                  await fetchMultiChainPortfolio(address);
                } catch (error) {
                  console.error('Failed to connect wallet:', error);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}