// API endpoint to get user's PGS token balance using 1inch Balance API
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
    
    console.log('🌐 Getting PGS balance via 1inch API...');
    console.log('   User:', userAddress);
    console.log('   Contract:', contractAddress);
    console.log('   Chain: Arbitrum One (42161)');
    console.log('   API Key:', apiKey ? 'Present ✅' : 'Missing ❌');
    
    // Try 1inch Balance API first (hybrid approach)
    try {
      // First get all balances from 1inch
      const generalApiUrl = `https://api.1inch.dev/balance/v1.2/42161/balances/${userAddress}`;
      
      const headers = {
        'Accept': 'application/json'
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(generalApiUrl, { headers });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ 1inch API call successful - found ${Object.keys(data).length} tokens`);
        
        // Check if our PGS token is in the response
        let pgsBalanceWei = data[contractAddress.toLowerCase()] || 
                           data[contractAddress] || 
                           data[contractAddress.toUpperCase()];
        
        if (pgsBalanceWei !== undefined && pgsBalanceWei !== '0') {
          // PGS token found with balance > 0 in 1inch API
          const { ethers } = require('ethers');
          const pgsBalance = ethers.formatEther(pgsBalanceWei);
          console.log(`🎉 PGS balance found via 1inch API: ${pgsBalance} PGS`);
          
          return res.status(200).json({
            success: true,
            source: '1inch_api',
            balance: pgsBalance,
            userAddress,
            contractAddress
          });
        } else {
          // PGS token not indexed by 1inch yet - check contract directly
          console.log('📊 1inch API working but PGS not indexed yet, checking contract...');
          
          // Get PGS balance from contract
          const { ethers } = require('ethers');
          const provider = new ethers.JsonRpcProvider(
            process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
          );
          
          const contractABI = ["function balanceOf(address) view returns (uint256)"];
          const contract = new ethers.Contract(contractAddress, contractABI, provider);
          const pgsBalanceWei = await contract.balanceOf(userAddress);
          const pgsBalance = ethers.formatEther(pgsBalanceWei);
          
          console.log(`✅ PGS balance from contract: ${pgsBalance} PGS`);
          
          return res.status(200).json({
            success: true,
            source: '1inch_api_with_contract_fallback',
            balance: pgsBalance,
            userAddress,
            contractAddress,
            note: '1inch API working but PGS not indexed yet - used direct contract call'
          });
        }
      } else {
        const errorText = await response.text();
        console.error('❌ 1inch API error:', response.status, errorText);
        throw new Error(`1inch API failed: ${response.status}`);
      }
    } catch (apiError) {
      console.warn('⚠️ 1inch API failed completely, using contract fallback:', apiError.message);
      
      // Fallback to direct contract call
      const { ethers } = require('ethers');
      
      const provider = new ethers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
      );
      
      const contractABI = ["function name() view returns (string)", "function balanceOf(address) view returns (uint256)"];
      const contract = new ethers.Contract(contractAddress, contractABI, provider);
      
      const balanceWei = await contract.balanceOf(userAddress);
      const balance = ethers.formatEther(balanceWei);
      
      console.log('🔄 Contract fallback balance:', balance);
      
      return res.status(200).json({
        success: true,
        source: 'contract_fallback',
        balance,
        userAddress,
        contractAddress
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