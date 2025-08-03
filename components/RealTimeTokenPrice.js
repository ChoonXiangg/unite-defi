import { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const RealTimeTokenPrice = ({ 
  tokenName = 'ETH',
  coinGeckoId = 'ethereum'
}) => {
  const [currentPrice, setCurrentPrice] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  // Fetch real-time price from 1inch API first, then CoinGecko as fallback
  const fetchRealTimePrice = async () => {
    try {
      // Try 1inch API first for real-time prices
      const response = await fetch(`/api/price/realtime-oneinch?tokenSymbol=${tokenName}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentPrice(data.price);
        setLastUpdated(new Date(data.timestamp));
        setError(null);
      } else if (data.usingFallback) {
        setCurrentPrice(data.price);
        setLastUpdated(new Date(data.timestamp));
        setError(data.fallbackMessage || 'Using fallback price from 1inch');
      } else {
        throw new Error(data.error || 'Unknown API error');
      }
    } catch (err) {
      console.error('Error fetching real-time price from 1inch:', err);
      
      // Fallback to CoinGecko if 1inch fails
      try {
        const response = await fetch(`/api/price/realtime-coingecko?coinId=${coinGeckoId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success || data.usingFallback) {
            setCurrentPrice(data.price);
            setLastUpdated(new Date(data.timestamp));
            setError('1inch API failed - using CoinGecko fallback');
            return;
          }
        }
      } catch (coinGeckoErr) {
        console.error('CoinGecko fallback also failed:', coinGeckoErr);
      }
      
      // Use local fallback prices if both APIs fail
      setError('Network error - using fallback price');
      
      const fallbackPrices = {
        'ETH': 2450,
        'BTC': 45000,
        'USDC': 1,
        'USDT': 1,
        'MATIC': 0.8,
        'BNB': 320,
        'AVAX': 25,
        '1INCH': 0.583,
        'XTZ': 1.2,
        'PGS': 2.70
      };
      setCurrentPrice(fallbackPrices[tokenName.toUpperCase()] || 100);
      setLastUpdated(new Date());
    }
  };

  // Fetch historical chart data from 1inch API
  const fetchChartData = async () => {
    try {
      const response = await fetch(`/api/price/oneinch-historical?tokenSymbol=${tokenName}&days=1`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const prices = data.data;
        const labels = prices.map(item => item.time);
        const priceData = prices.map(item => item.price);

        setChartData({
          labels,
          datasets: [
            {
              label: `${tokenName} Price (USD)`,
              data: priceData,
              borderColor: '#10b981', // Green for 1inch data
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: '#10b981',
              pointHoverBorderColor: '#ffffff',
              pointHoverBorderWidth: 2
            }
          ]
        });
        
        console.log(`📈 1inch chart data loaded for ${tokenName}: ${prices.length} points, 24h change: ${data.change24h}%`);
      } else {
        throw new Error(data.error || 'Unknown 1inch historical API error');
      }
    } catch (err) {
      console.error('Error fetching 1inch chart data:', err);
      setError(prev => prev ? `${prev}; Chart unavailable` : 'Chart data unavailable');
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([fetchRealTimePrice(), fetchChartData()]);
      setLoading(false);
    };

    initializeData();
  }, [coinGeckoId]);

  // Set up real-time price polling (every 5 seconds)
  useEffect(() => {
    if (!loading) {
      intervalRef.current = setInterval(() => {
        fetchRealTimePrice();
      }, 5000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [loading, coinGeckoId]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#6b7280',
        borderWidth: 1,
        displayColors: false,
        callbacks: {
          label: function(context) {
            return `$${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.2)'
        },
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 8
        }
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.2)'
        },
        ticks: {
          color: '#9ca3af',
          callback: function(value) {
            return '$' + value.toFixed(0);
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    elements: {
      point: {
        radius: 0
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/90 rounded-2xl p-6 border border-gray-600/50 backdrop-blur-md shadow-xl">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4"></div>
          <div className="h-8 bg-gray-700 rounded mb-6"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/90 rounded-2xl p-6 border border-gray-600/50 backdrop-blur-md shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white font-supercell">{tokenName}</h3>
          <div className="text-3xl font-bold text-green-400 mt-1">
            ${currentPrice ? currentPrice.toFixed(2) : '--'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Last Updated</div>
          <div className="text-sm text-gray-300">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : '--'}
          </div>
          {error && (
            <div className="text-xs text-yellow-400 mt-1">⚠ {error}</div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 mb-4">
        {chartData ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            Chart data unavailable
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>24-hour price simulation (1inch API)</span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live prices via 1inch API (5s updates)</span>
        </div>
      </div>
    </div>
  );
};

export default RealTimeTokenPrice;