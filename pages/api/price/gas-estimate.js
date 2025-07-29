export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chainId = 1 } = req.query;

  try {
    // Get real-time gas prices from different sources
    let gasPrice = 20; // Default 20 gwei
    let ethPrice = 2450; // Default ETH price

    // Fetch real ETH price
    try {
      const ethPriceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      if (ethPriceResponse.ok) {
        const ethData = await ethPriceResponse.json();
        ethPrice = ethData.ethereum?.usd || 2450;
      }
    } catch (error) {
      console.error('Failed to fetch ETH price:', error);
    }

    // Get gas price based on chain
    if (chainId === 1) { // Ethereum
      try {
        // Try multiple gas price APIs
        const gasAPIs = [
          'https://api.etherscan.io/api?module=gastracker&action=gasoracle',
          'https://gas-api.metaswap.codefi.network/networks/1/suggestedGasFees'
        ];

        for (const apiUrl of gasAPIs) {
          try {
            const gasResponse = await fetch(apiUrl);
            if (gasResponse.ok) {
              const gasData = await gasResponse.json();
              
              if (gasData.result?.ProposeGasPrice) {
                // Etherscan format
                gasPrice = parseFloat(gasData.result.ProposeGasPrice);
                break;
              } else if (gasData.medium?.suggestedMaxFeePerGas) {
                // MetaMask format
                gasPrice = parseFloat(gasData.medium.suggestedMaxFeePerGas);
                break;
              }
            }
          } catch (err) {
            console.warn(`Gas API ${apiUrl} failed:`, err.message);
          }
        }
      } catch (error) {
        console.error('All gas price APIs failed:', error);
      }
    }

    // Calculate gas costs for common operations
    const gasEstimates = {
      simple_transfer: 21000,
      erc20_transfer: 65000,
      uniswap_swap: 150000,
      complex_defi: 300000
    };

    const results = {};
    for (const [operation, gasLimit] of Object.entries(gasEstimates)) {
      const gasCostEth = (gasLimit * gasPrice) / 1e9; // Convert to ETH
      const gasCostUsd = gasCostEth * ethPrice;
      
      results[operation] = {
        gasLimit,
        gasPrice: gasPrice,
        gasCostEth: gasCostEth.toFixed(6),
        gasCostUsd: gasCostUsd.toFixed(2)
      };
    }

    res.status(200).json({
      success: true,
      chainId: parseInt(chainId),
      gasPrice: gasPrice,
      ethPrice: ethPrice,
      estimates: results,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Gas estimate error:', error);
    
    // Fallback values
    res.status(200).json({
      success: true,
      chainId: parseInt(chainId),
      gasPrice: 20,
      ethPrice: 2450,
      estimates: {
        simple_transfer: {
          gasLimit: 21000,
          gasPrice: 20,
          gasCostEth: "0.000420",
          gasCostUsd: "1.03"
        },
        uniswap_swap: {
          gasLimit: 150000,
          gasPrice: 20,
          gasCostEth: "0.003000",
          gasCostUsd: "7.35"
        }
      },
      timestamp: Date.now(),
      fallback: true
    });
  }
}