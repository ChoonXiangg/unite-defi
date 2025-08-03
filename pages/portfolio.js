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

// PGS token configuration - deployed on Arbitrum
const PGS_TOKEN_CONFIG = {
  symbol: "PGS",
  name: "PegaSwap",
  address: "0x4a109A21EeD37d5D1AA0e8e2DE9e50005850eC6c", // Deployed PGS contract on Arbitrum
  chainId: 42161, // Arbitrum One
  decimals: 18,
  logo: "/PGS-logo-original.svg"
};


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

// Helper function to format USD values with appropriate decimal places
const formatUSDValue = (value) => {
  
  if (value === 0) return '$0.00';
  
  // For very small amounts, show more decimal places
  if (value < 0.01) {
    const formatted = value.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 4, 
      maximumFractionDigits: 6 
    });
    return formatted;
  }
  // For small amounts, show 3 decimal places
  else if (value < 1) {
    const formatted = value.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 3, 
      maximumFractionDigits: 3 
    });
    return formatted;
  }
  // For normal amounts, show 2 decimal places
  else {
    return value.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }
};

// Helper function to format token balance with appropriate decimal places
const formatTokenBalance = (balance, symbol) => {
  const numBalance = parseFloat(balance);
  if (numBalance === 0) return '0';
  
  // For ETH/WETH, show up to 6 decimal places for small amounts
  if (symbol === 'ETH' || symbol === 'WETH') {
    if (numBalance < 0.001) {
      return numBalance.toFixed(6);
    } else if (numBalance < 1) {
      return numBalance.toFixed(4);
    } else {
      return numBalance.toFixed(3);
    }
  }
  
  // For other tokens, use standard formatting
  if (numBalance < 1) {
    return numBalance.toFixed(4);
  } else {
    return numBalance.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    });
  }
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
        
        // Convert to portfolio format for compatibility and fetch real prices from 1inch API
        const tokenPromises = [];
        
        Object.values(result.data.chains).forEach(chain => {
          if (chain.tokens && chain.tokens.length > 0) {
            chain.tokens.forEach(token => {
              if (token.metadata && token.numericBalance > 0) {
                tokenPromises.push(async () => {
                  // Clean token symbol and fetch real price + 24h change from 1inch API
                  let tokenPrice = 0;
                  let change24h = 0;
                  
                  // Clean the token symbol (remove suffixes like _1, _2, etc.)
                  const cleanSymbol = token.metadata.symbol.replace(/_\d+$/, '');
                  const chainId = token.chainId;
                  
                  console.log(`🔍 Processing token: ${token.metadata.symbol} -> ${cleanSymbol} on chain ${chainId}`);
                  
                  try {
                    // Get current price from 1inch API
                    const priceResponse = await fetch(`/api/price/realtime-oneinch?tokenSymbol=${cleanSymbol}&chainId=${chainId}`);
                    if (priceResponse.ok) {
                      const priceData = await priceResponse.json();
                      if (priceData.success && priceData.price > 0) {
                        tokenPrice = priceData.price;
                        console.log(`💰 1inch price for ${cleanSymbol} on chain ${chainId}: $${tokenPrice}`);
                      } else if (priceData.usingFallback && priceData.price > 0) {
                        tokenPrice = priceData.price;
                        console.log(`⚠️ 1inch fallback price for ${cleanSymbol}: $${tokenPrice}`);
                      } else {
                        throw new Error('No valid price from 1inch API');
                      }
                    } else {
                      throw new Error(`HTTP ${priceResponse.status}`);
                    }
                    
                    // Get 24h change from 1inch historical API
                    try {
                      const historicalResponse = await fetch(`/api/price/oneinch-historical?tokenSymbol=${cleanSymbol}&chainId=${chainId}&days=1`);
                      if (historicalResponse.ok) {
                        const historicalData = await historicalResponse.json();
                        if (historicalData.success) {
                          change24h = historicalData.change24h || 0;
                          console.log(`📈 1inch 24h change for ${cleanSymbol}: ${change24h}%`);
                        }
                      }
                    } catch (changeError) {
                      console.warn(`⚠️ Failed to fetch 24h change for ${cleanSymbol}:`, changeError.message);
                      change24h = 0;
                    }
                  } catch (error) {
                    console.error(`❌ Failed to fetch 1inch price for ${cleanSymbol} on chain ${chainId}:`, error.message);
                    
                    // Fallback to CoinGecko price if available (try both original and clean symbol)
                    const coinGeckoPrice = result.data.tokenLogos[token.metadata.symbol]?.currentPrice || 
                                         result.data.tokenLogos[cleanSymbol]?.currentPrice;
                    if (coinGeckoPrice && coinGeckoPrice > 0) {
                      tokenPrice = coinGeckoPrice;
                      console.log(`🦎 Using CoinGecko fallback price for ${cleanSymbol}: $${tokenPrice}`);
                    } else {
                      // No price available from any API - user wants 1inch API only
                      tokenPrice = 0;
                      console.warn(`⚠️ No price available for ${cleanSymbol} from 1inch or CoinGecko APIs, using $0`);
                    }
                  }
                  
                  const balance = token.numericBalance; // Use numericBalance for calculation
                  const calculatedValue = balance * tokenPrice;
                  
                  
                  const tokenInfo = {
                    symbol: cleanSymbol, // Use cleaned symbol for display (USDC instead of USDC_1)
                    originalSymbol: token.metadata.symbol, // Keep original for reference
                    name: token.metadata.name,
                    balance: token.formattedBalance,
                    value: calculatedValue,
                    price: tokenPrice,
                    change24h: change24h, // Use 1inch historical data instead of CoinGecko
                    logo: result.data.tokenLogos[token.metadata.symbol]?.logoUrl || token.metadata.logoURI || `https://via.placeholder.com/40x40/666666/ffffff?text=${cleanSymbol}`,
                    chainId: token.chainId,
                    chainName: token.chainName,
                    address: token.address,
                    decimals: token.metadata.decimals,
                    isRealData: true
                  };
                  
                  console.log(`📊 Token ${cleanSymbol} (${token.metadata.symbol}): ${balance} tokens × $${tokenPrice} = $${calculatedValue.toFixed(2)}`);
                  return tokenInfo;
                });
              }
            });
          }
        });
        
        // Execute all price fetches with rate limiting
        const allTokens = [];
        for (let i = 0; i < tokenPromises.length; i++) {
          const tokenInfo = await tokenPromises[i]();
          allTokens.push(tokenInfo);
          
          // Rate limit: wait 100ms between requests to respect API limits
          if (i < tokenPromises.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Get PGS price and 24h change from 1inch API (before fetching balance)
        const pgsPrice = await fetch(`/api/price/realtime-oneinch?tokenSymbol=PGS`);
        const pgsPriceData = pgsPrice.ok ? await pgsPrice.json() : null;
        
        // Get PGS 24h change from 1inch historical API
        let pgsChange24h = 0;
        try {
          const pgsHistorical = await fetch(`/api/price/oneinch-historical?tokenSymbol=PGS&chainId=${PGS_TOKEN_CONFIG.chainId}&days=1`);
          if (pgsHistorical.ok) {
            const pgsHistoricalData = await pgsHistorical.json();
            if (pgsHistoricalData.success) {
              pgsChange24h = pgsHistoricalData.change24h || 0;
              console.log(`📈 PGS 24h change: ${pgsChange24h}%`);
            }
          }
        } catch (pgsChangeError) {
          console.warn(`⚠️ Failed to fetch PGS 24h change:`, pgsChangeError.message);
        }

        // Fetch PGS token balance using the same method as token-test page
        try {
          console.log(`🔍 Fetching PGS balance for wallet ${address} using enhanced API...`);
          const pgsResponse = await fetch(`/api/get-balance?userAddress=${address}`);
          if (pgsResponse.ok) {
            const pgsData = await pgsResponse.json();
            console.log(`📊 Enhanced PGS API response:`, pgsData);

            if (pgsData.success && pgsData.balance && parseFloat(pgsData.balance) > 0) {
              const foundPgsBalance = parseFloat(pgsData.balance);
              console.log(`💰 PGS balance found: ${foundPgsBalance} PGS`);
              
              const realPgsBalance = parseFloat(pgsData.balance);
              const pgsCurrentPrice = pgsPriceData?.price || 0; // Use 0 if 1inch API fails (no hardcoded fallbacks)
              
              const pgsToken = {
                symbol: PGS_TOKEN_CONFIG.symbol,
                name: PGS_TOKEN_CONFIG.name,
                balance: realPgsBalance.toFixed(2),
                value: realPgsBalance * pgsCurrentPrice,
                price: pgsCurrentPrice,
                change24h: pgsChange24h, // Use 1inch historical data for PGS
                logo: PGS_TOKEN_CONFIG.logo,
                chainId: PGS_TOKEN_CONFIG.chainId,
                chainName: "Arbitrum One",
                address: PGS_TOKEN_CONFIG.address,
                decimals: PGS_TOKEN_CONFIG.decimals,
                isRealData: true
              };
              
              allTokens.push(pgsToken);
              console.log(`✅ Added PGS token: ${realPgsBalance.toFixed(2)} PGS ($${(realPgsBalance * pgsCurrentPrice).toFixed(2)})`);
            } else {
              // Even if no balance data, show PGS token with 0 balance
              console.log(`⚠️ No PGS balance data found, showing with 0 balance`);
              
              const pgsToken = {
                symbol: PGS_TOKEN_CONFIG.symbol,
                name: PGS_TOKEN_CONFIG.name,
                balance: "0.00",
                value: 0,
                price: 0, // PGS price set to $0
                change24h: pgsChange24h,
                logo: PGS_TOKEN_CONFIG.logo,
                chainId: PGS_TOKEN_CONFIG.chainId,
                chainName: "Arbitrum One",
                address: PGS_TOKEN_CONFIG.address,
                decimals: PGS_TOKEN_CONFIG.decimals,
                isRealData: true
              };
              
              allTokens.push(pgsToken);
              console.log(`✅ Added PGS token with 0 balance for visibility`);
            }
          } else {
            console.error(`❌ PGS API failed:`, pgsResponse.status, await pgsResponse.text());
          }
        } catch (pgsError) {
          console.error('❌ Failed to fetch PGS balance:', pgsError);
          
          // Still show PGS even if API fails
          const pgsToken = {
            symbol: PGS_TOKEN_CONFIG.symbol,
            name: PGS_TOKEN_CONFIG.name,
            balance: "0.00",
            value: 0,
            price: 2.70, // Default PGS price
            change24h: pgsChange24h,
            logo: PGS_TOKEN_CONFIG.logo,
            chainId: PGS_TOKEN_CONFIG.chainId,
            chainName: "Arbitrum One",
            address: PGS_TOKEN_CONFIG.address,
            decimals: PGS_TOKEN_CONFIG.decimals,
            isRealData: false
          };
          
          allTokens.push(pgsToken);
          console.log(`✅ Added PGS token as fallback due to API error`);
        }
        
        // Sort by balance value and set as portfolio
        const sortedTokens = allTokens.sort((a, b) => b.value - a.value);
        setPortfolio(sortedTokens);
        
        if (sortedTokens.length > 0) {
          setSelectedToken(sortedTokens[0]);
        }
        
        // Update localStorage with real PGS balance for NFT page
        const pgsToken = allTokens.find(token => token.symbol === 'PGS');
        if (pgsToken) {
          localStorage.setItem('pgsBalance', pgsToken.balance);
          console.log(`💾 Updated localStorage PGS balance: ${pgsToken.balance}`);
        } else {
          localStorage.setItem('pgsBalance', '0');
          console.log(`💾 No PGS tokens found, set localStorage balance to 0`);
        }
        
        console.log(`✅ Portfolio loaded: ${allTokens.length} tokens across ${result.data.summary.networksWithBalance} networks`);
        
      } else {
        throw new Error(result.error || 'Failed to fetch portfolio');
      }
    } catch (error) {
      console.error('❌ Failed to load multi-chain portfolio:', error);
      setPortfolioError(error.message);
      
      // Set empty portfolio on error - user should connect wallet for real data
      setPortfolio([]);
      setSelectedToken(null);
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
          // Set empty portfolio - user needs to connect wallet for real data
          setPortfolio([]);
          setSelectedToken(null);
        }
      } else {
        // No wallet connected, show empty portfolio
        setPortfolio([]);
        setSelectedToken(null);
      }
      
      // Store PGS balance in localStorage for nft.js to access - will be updated when portfolio loads
      localStorage.setItem('pgsBalance', '0');
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
                  {formatUSDValue(totalValue)}
                </div>
              </div>
              <div>
                {portfolio.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No Portfolio Data</h3>
                    <p className="text-gray-400 text-sm">
                      Connect your wallet to view your real token holdings and balances across multiple chains.
                    </p>
                  </div>
                ) : (
                  portfolio.map((token) => (
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
                        {formatUSDValue(token.value)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatTokenBalance(token.balance, token.symbol)} {token.symbol}
                      </div>
                    </div>
                  </button>
                  ))
                )}
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
                          ● Live price from 1inch API
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">Real-Time Price (1inch API)</div>
                      <div className="text-xl font-bold text-white">
                        {priceLoading ? (
                          <div className="animate-pulse bg-gray-700 h-6 w-20 rounded"></div>
                        ) : (
                          `$${realTimePrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || selectedToken.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Balance {selectedToken.isRealData ? '(Real Wallet)' : '(No Balance)'}</div>
                      <div className="text-xl font-bold text-white">
                        {formatTokenBalance(selectedToken.balance, selectedToken.symbol)} {selectedToken.symbol}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Value (Real-Time)</div>
                      <div className="text-xl font-bold text-white">
                        {priceLoading ? (
                          <div className="animate-pulse bg-gray-700 h-6 w-24 rounded"></div>
                        ) : (
                          formatUSDValue(getRealTimeValue(selectedToken))
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
                          ? 'Using fallback prices (1inch/CoinGecko)' 
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