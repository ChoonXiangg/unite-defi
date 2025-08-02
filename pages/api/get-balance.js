// API endpoint to get user's PGS token balance using 1inch Balance API with enhanced features
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userAddress } = req.query;
    
    if (!userAddress) {
      return res.status(400).json({ error: 'userAddress parameter required' });
    }

    const contractAddress = '0x4a109A21EeD37d5D1AA0e8e2DE9e50005850eC6c';
    const apiKey = process.env.ONEINCH_API_KEY;
    
    console.log('🌐 Getting PGS balance via enhanced 1inch APIs...');
    console.log('   User:', userAddress);
    console.log('   Contract:', contractAddress);
    console.log('   Chain: Arbitrum One (42161)');
    console.log('   API Key:', apiKey ? 'Present ✅' : 'Missing ❌');
    
    // Enhanced 1inch API approach with multiple services
    try {
      const headers = {
        'Accept': 'application/json'
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // 🆕 Get current gas price for transaction cost estimation
      let gasInfo = null;
      try {
        const gasApiUrl = `https://api.1inch.dev/gas-price/v1.5/42161`;
        const gasResponse = await fetch(gasApiUrl, { headers });
        if (gasResponse.ok) {
          const gasData = await gasResponse.json();
          // Handle both simple and complex gas price formats
          gasInfo = {
            standard: typeof gasData.standard === 'object' ? 
              (gasData.standard.maxFeePerGas || gasData.standard.gasPrice || gasData.standard) : 
              gasData.standard,
            fast: typeof gasData.fast === 'object' ? 
              (gasData.fast.maxFeePerGas || gasData.fast.gasPrice || gasData.fast) : 
              gasData.fast,
            instant: typeof gasData.instant === 'object' ? 
              (gasData.instant.maxFeePerGas || gasData.instant.gasPrice || gasData.instant) : 
              gasData.instant
          };
          console.log('✅ Gas price data retrieved:', gasInfo);
        }
      } catch (gasError) {
        console.warn('⚠️ Gas Price API failed:', gasError.message);
      }

      // Enhanced Balance API call
      const balanceApiUrl = `https://api.1inch.dev/balance/v1.2/42161/balances/${userAddress}`;
      const response = await fetch(balanceApiUrl, { headers });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ 1inch Balance API found ${Object.keys(data).length} tokens`);
        
        // Check if our PGS token is in the response
        let pgsBalanceWei = data[contractAddress.toLowerCase()] || 
                           data[contractAddress] || 
                           data[contractAddress.toUpperCase()];
        
        if (pgsBalanceWei !== undefined && pgsBalanceWei !== '0') {
          // 🆕 Get token metadata using 1inch Token API
          let tokenMetadata = null;
          try {
            const tokenApiUrl = `https://api.1inch.dev/token/v1.2/42161/custom?addresses=${contractAddress}`;
            const tokenResponse = await fetch(tokenApiUrl, { headers });
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              tokenMetadata = tokenData[contractAddress.toLowerCase()];
              console.log('✅ Token metadata retrieved:', tokenMetadata);
            }
          } catch (tokenError) {
            console.warn('⚠️ Token API failed:', tokenError.message);
          }

          const { ethers } = require('ethers');
          const pgsBalance = ethers.formatEther(pgsBalanceWei);
          console.log(`🎉 PGS balance found via 1inch API: ${pgsBalance} PGS`);
          
          return res.status(200).json({
            success: true,
            source: '1inch_enhanced_api',
            balance: pgsBalance,
            userAddress,
            contractAddress,
            metadata: tokenMetadata,
            gasInfo: gasInfo,
            timestamp: new Date().toISOString()
          });
        } else {
          // PGS token not indexed by 1inch yet - enhanced contract check
          console.log('📊 1inch API working but PGS not indexed yet, checking contract...');
          
          const { ethers } = require('ethers');
          const provider = new ethers.JsonRpcProvider(
            process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
          );
          
          const contractABI = [
            "function balanceOf(address) view returns (uint256)",
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)"
          ];
          const contract = new ethers.Contract(contractAddress, contractABI, provider);
          
          // Get enhanced token info
          const [pgsBalanceWei, tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
            contract.balanceOf(userAddress),
            contract.name().catch(() => 'PGS Token'),
            contract.symbol().catch(() => 'PGS'), 
            contract.decimals().catch(() => 18)
          ]);
          
          const pgsBalance = ethers.formatEther(pgsBalanceWei);
          console.log(`✅ Enhanced PGS balance from contract: ${pgsBalance} PGS`);
          
          return res.status(200).json({
            success: true,
            source: '1inch_api_with_enhanced_contract_fallback',
            balance: pgsBalance,
            userAddress,
            contractAddress,
            metadata: {
              name: tokenName,
              symbol: tokenSymbol,
              decimals: Number(tokenDecimals)
            },
            gasInfo: gasInfo,
            note: '1inch API working but PGS not indexed yet - used enhanced contract call',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        const errorText = await response.text();
        console.error('❌ 1inch API error:', response.status, errorText);
        throw new Error(`1inch API failed: ${response.status}`);
      }
    } catch (apiError) {
      console.warn('⚠️ Enhanced 1inch API failed, using enhanced contract fallback:', apiError.message);
      
      // Enhanced fallback to direct contract call
      const { ethers } = require('ethers');
      const provider = new ethers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
      );
      
      const contractABI = [
        "function name() view returns (string)", 
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint256)"
      ];
      const contract = new ethers.Contract(contractAddress, contractABI, provider);
      
      // Get enhanced contract data
      const [balanceWei, tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
        contract.balanceOf(userAddress),
        contract.name().catch(() => 'PGS Token'),
        contract.symbol().catch(() => 'PGS'),
        contract.decimals().catch(() => 18)
      ]);
      
      const balance = ethers.formatEther(balanceWei);
      console.log('🔄 Enhanced contract fallback balance:', balance);
      
      return res.status(200).json({
        success: true,
        source: 'enhanced_contract_fallback',
        balance,
        userAddress,
        contractAddress,
        metadata: {
          name: tokenName,
          symbol: tokenSymbol,
          decimals: Number(tokenDecimals)
        },
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('💥 Balance API error:', error);
    return res.status(500).json({ 
      error: 'Failed to get balance', 
      message: error.message 
    });
  }
}