import { useState, useEffect, useRef } from 'react';

const useRealTimePrice = (tokenSymbol) => {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const intervalRef = useRef(null);

  // Token symbol to CoinGecko ID mapping
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

  const fetchPrice = async () => {
    if (!tokenSymbol) return;
    
    try {
      // Try 1inch API first for real-time prices
      const response = await fetch(`/api/price/realtime-oneinch?tokenSymbol=${tokenSymbol}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle response from 1inch API
      if (data.success) {
        setPrice(data.price);
        setError(null);
        setUsingFallback(false);
      } else if (data.usingFallback) {
        setPrice(data.price);
        setError(data.fallbackMessage || 'Using fallback price from 1inch');
        setUsingFallback(true);
      } else {
        throw new Error(data.error || 'Unknown API error');
      }
      
    } catch (err) {
      console.error('Error fetching price from 1inch:', err);
      
      // Fallback to CoinGecko if 1inch fails
      try {
        const coinId = getCoinGeckoId(tokenSymbol);
        const response = await fetch(`/api/price/realtime-coingecko?coinId=${coinId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success || data.usingFallback) {
            setPrice(data.price);
            setError('1inch API failed - using CoinGecko fallback');
            setUsingFallback(true);
            return;
          }
        }
      } catch (coinGeckoErr) {
        console.error('CoinGecko fallback also failed:', coinGeckoErr);
      }
      
      // Use local fallback prices if both APIs fail
      const fallbackPrices = {
        'ETH': 2450,
        'BTC': 45000,
        'USDC': 1,
        'USDT': 1,
        'MATIC': 0.8,
        'BNB': 320,
        'AVAX': 25,
        'LINK': 12,
        'UNI': 6,
        'DAI': 1,
        '1INCH': 0.583,
        'XTZ': 1.2,
        'PGS': 2.70
      };
      
      const fallbackPrice = fallbackPrices[tokenSymbol?.toUpperCase()] || 100;
      
      setPrice(fallbackPrice);
      setError('Network error - using local fallback price');
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenSymbol) {
      setLoading(true);
      fetchPrice();
    }
  }, [tokenSymbol]);

  // Set up polling every 10 seconds
  useEffect(() => {
    if (!loading && tokenSymbol) {
      intervalRef.current = setInterval(() => {
        fetchPrice();
      }, 10000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [loading, tokenSymbol]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { 
    price, 
    loading, 
    error, 
    usingFallback,
    isLive: !usingFallback && !error 
  };
};

export default useRealTimePrice;