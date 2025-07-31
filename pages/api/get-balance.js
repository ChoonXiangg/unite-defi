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

    const contractAddress = '0x72dA4AE27799eB38dcEAe359c8782681f5e623ED';
    const apiKey = process.env.ONEINCH_API_KEY;
    
    console.log('🌐 Getting PGS balance via 1inch API...');
    console.log('   User:', userAddress);
    console.log('   Contract:', contractAddress);
    console.log('   API Key:', apiKey ? 'Present ✅' : 'Missing ❌');
    
    // Try 1inch Balance API first
    try {
      const apiUrl = `https://api.1inch.dev/balance/v1.2/421614/balances/${userAddress}`;
      
      const headers = {
        'Accept': 'application/json'
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(apiUrl, { headers });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 1inch API response:', data);
        
        // Extract PGS token balance
        const pgsBalance = data[contractAddress.toLowerCase()] || data[contractAddress] || '0';
        
        return res.status(200).json({
          success: true,
          source: '1inch_api',
          balance: pgsBalance,
          userAddress,
          contractAddress
        });
      } else {
        const errorText = await response.text();
        console.error('❌ 1inch API error:', response.status, errorText);
        throw new Error(`1inch API failed: ${response.status}`);
      }
    } catch (apiError) {
      console.warn('⚠️ 1inch API failed, using contract fallback:', apiError.message);
      
      // Fallback to direct contract call
      const { ethers } = require('ethers');
      
      const provider = new ethers.JsonRpcProvider(
        process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'
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