// API endpoint to get user's transaction history using 1inch History API
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
    
    console.log('📜 Getting transaction history via 1inch API...');
    console.log('   User:', userAddress);
    console.log('   Contract:', contractAddress);
    console.log('   API Key:', apiKey ? 'Present ✅' : 'Missing ❌');
    
    // Try 1inch History API first
    try {
      const apiUrl = `https://api.1inch.dev/history/v2.0/history/${userAddress}/events?chainId=421614&limit=50`;
      
      const headers = {
        'Accept': 'application/json'
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(apiUrl, { headers });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 1inch History API response:', data);
        
        // Filter for PGS token transactions
        const pgsTransactions = [];
        
        if (data.items) {
          for (const item of data.items) {
            // Look for transactions involving our PGS contract
            if (item.details && item.details.some) {
              const pgsDetails = item.details.filter(detail => 
                detail.address && detail.address.toLowerCase() === contractAddress.toLowerCase()
              );
              
              if (pgsDetails.length > 0) {
                pgsTransactions.push({
                  id: item.txHash + '_' + item.logIndex,
                  txHash: item.txHash,
                  timestamp: new Date(item.timeMs).toLocaleString(),
                  blockNumber: item.blockNumber,
                  type: item.action || 'unknown',
                  details: pgsDetails
                });
              }
            }
          }
        }
        
        return res.status(200).json({
          success: true,
          source: '1inch_history_api',
          transactions: pgsTransactions,
          userAddress,
          contractAddress
        });
      } else {
        const errorText = await response.text();
        console.error('❌ 1inch History API error:', response.status, errorText);
        throw new Error(`1inch History API failed: ${response.status}`);
      }
    } catch (apiError) {
      console.warn('⚠️ 1inch History API failed, using contract events fallback:', apiError.message);
      
      // Fallback to contract event scanning
      const { ethers } = require('ethers');
      
      const provider = new ethers.JsonRpcProvider(
        process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'
      );
      
      const contractABI = [
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event Mint(address indexed to, uint256 amount, string reason)",
        "event TokensSpent(address indexed user, uint256 amount, string item)",
        "event UserTransfer(address indexed from, address indexed to, uint256 amount, string message)"
      ];
      
      const contract = new ethers.Contract(contractAddress, contractABI, provider);
      
      // Get recent events
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);
      
      const [transferEvents, mintEvents, spentEvents, userTransferEvents] = await Promise.all([
        contract.queryFilter(contract.filters.Transfer(), fromBlock, currentBlock).catch(() => []),
        contract.queryFilter(contract.filters.Mint(), fromBlock, currentBlock).catch(() => []),
        contract.queryFilter(contract.filters.TokensSpent(), fromBlock, currentBlock).catch(() => []),
        contract.queryFilter(contract.filters.UserTransfer(), fromBlock, currentBlock).catch(() => [])
      ]);
      
      const transactions = [];
      
      // Process mint events
      for (const event of mintEvents) {
        if (event.args.to.toLowerCase() === userAddress.toLowerCase()) {
          const block = await event.getBlock();
          transactions.push({
            id: `mint_${event.transactionHash}_${event.logIndex}`,
            type: 'mint',
            tokensEarned: ethers.formatEther(event.args.amount),
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber
          });
        }
      }
      
      // Process spending events
      for (const event of spentEvents) {
        if (event.args.user.toLowerCase() === userAddress.toLowerCase()) {
          const block = await event.getBlock();
          transactions.push({
            id: `spend_${event.transactionHash}_${event.logIndex}`,
            type: 'spend',
            amountSpent: ethers.formatEther(event.args.amount),
            itemPurchased: event.args.item,
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber
          });
        }
      }
      
      // Process user transfers
      for (const event of userTransferEvents) {
        if (event.args.from.toLowerCase() === userAddress.toLowerCase() || 
            event.args.to.toLowerCase() === userAddress.toLowerCase()) {
          const block = await event.getBlock();
          const isOutgoing = event.args.from.toLowerCase() === userAddress.toLowerCase();
          
          transactions.push({
            id: `user_transfer_${event.transactionHash}_${event.logIndex}`,
            type: isOutgoing ? 'transfer_out' : 'transfer_in',
            amountTransferred: ethers.formatEther(event.args.amount),
            [isOutgoing ? 'recipient' : 'sender']: isOutgoing ? event.args.to : event.args.from,
            message: event.args.message,
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber
          });
        }
      }
      
      // Sort by block number (newest first)
      transactions.sort((a, b) => b.blockNumber - a.blockNumber);
      
      console.log('🔄 Contract events fallback found', transactions.length, 'transactions');
      
      return res.status(200).json({
        success: true,
        source: 'contract_events_fallback',
        transactions: transactions.slice(0, 10), // Limit to 10 most recent
        userAddress,
        contractAddress
      });
    }
    
  } catch (error) {
    console.error('💥 History API error:', error);
    return res.status(500).json({ 
      error: 'Failed to get transaction history', 
      message: error.message 
    });
  }
}