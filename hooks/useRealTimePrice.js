import { useState, useEffect, useRef } from 'react';

const useRealTimePrice = (tokenSymbol) => {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const intervalRef = useRef(null);

  // Token address mapping for 1inch API
  const getTokenAddress = (symbol) => {
    const tokenAddresses = {
      'ETH': '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'BTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
      'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'USDT': '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'MATIC': '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
      'BNB': '0xb8c77482e45f1f44de1745f52c74426c631bdd52',
      'AVAX': '0x85f138bfee4ef8e540890cfb48f620571d67eda3'
    };
    
    return tokenAddresses[symbol?.toUpperCase()] || tokenAddresses['ETH'];
  };

  const fetchPrice = async () => {
    if (!tokenSymbol) return;
    
    try {
      const fromToken = getTokenAddress(tokenSymbol);
      const toToken = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC
      
      const response = await fetch(`/api/price/realtime-1inch?fromToken=${fromToken}&toToken=${toToken}&chainId=1`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle response from updated API
      if (data.success) {
        setPrice(data.price);
        setError(null);
        setUsingFallback(false);
      } else if (data.usingFallback) {
        setPrice(data.price);
        setError(data.fallbackMessage || 'Using fallback price');
        setUsingFallback(true);
      } else {
        throw new Error(data.error || 'Unknown API error');
      }
      
    } catch (err) {
      console.error('Error fetching price:', err);
      
      // Use fallback prices from our local mapping
      const fallbackPrices = {
        'ETH': 2450,
        'BTC': 45000,
        'USDC': 1,
        'USDT': 1,
        'MATIC': 0.8,
        'BNB': 320,
        'AVAX': 25
      };
      
      const fallbackPrice = fallbackPrices[tokenSymbol?.toUpperCase()] || 1;
      
      setPrice(fallbackPrice);
      setError('Network error - using fallback price');
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