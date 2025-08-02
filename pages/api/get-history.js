// API endpoint to get user's transaction history using enhanced 1inch APIs
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
    
    console.log('📜 Getting transaction history via enhanced 1inch APIs...');
    console.log('   User:', userAddress);
    console.log('   Contract:', contractAddress);
    console.log('   Chain: Arbitrum One (42161)');
    console.log('   API Key:', apiKey ? 'Present ✅' : 'Missing ❌');

    const headers = {
      'Accept': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    // 🆕 Enhanced approach: Try multiple 1inch APIs for comprehensive transaction data
    try {
      let pgsTransactions = [];
      let traceData = null;
      let gasData = null;

      // 🆕 1. Get gas price information for context
      try {
        const gasApiUrl = `https://api.1inch.dev/gas-price/v1.5/42161`;
        const gasResponse = await fetch(gasApiUrl, { headers });
        if (gasResponse.ok) {
          const rawGasData = await gasResponse.json();
          // Normalize gas data format
          gasData = {
            standard: typeof rawGasData.standard === 'object' ? 
              (rawGasData.standard.maxFeePerGas || rawGasData.standard.gasPrice || rawGasData.standard) : 
              rawGasData.standard,
            fast: typeof rawGasData.fast === 'object' ? 
              (rawGasData.fast.maxFeePerGas || rawGasData.fast.gasPrice || rawGasData.fast) : 
              rawGasData.fast,
            instant: typeof rawGasData.instant === 'object' ? 
              (rawGasData.instant.maxFeePerGas || rawGasData.instant.gasPrice || rawGasData.instant) : 
              rawGasData.instant
          };
          console.log('✅ Gas price data retrieved for context');
        }
      } catch (gasError) {
        console.warn('⚠️ Gas Price API failed:', gasError.message);
      }

      // 🆕 2. Try 1inch Traces API for enhanced transaction data
      try {
        const tracesApiUrl = `https://api.1inch.dev/traces/v1.0/chain/42161/address/${userAddress}/trace`;
        const tracesResponse = await fetch(tracesApiUrl, { headers });
        if (tracesResponse.ok) {
          const tracesData = await tracesResponse.json();
          console.log('✅ 1inch Traces API response:', tracesData.traces?.length || 0, 'traces');
          
          // Process traces for PGS token interactions
          if (tracesData.traces) {
            for (const trace of tracesData.traces) {
              // Look for PGS token interactions in traces
              if (trace.token && trace.token.toLowerCase() === contractAddress.toLowerCase()) {
                pgsTransactions.push({
                  id: `trace_${trace.txHash}_${trace.logIndex || 0}`,
                  type: trace.type || 'transfer',
                  txHash: trace.txHash,
                  timestamp: new Date(trace.timestamp * 1000).toLocaleString(),
                  blockNumber: trace.blockNumber,
                  amount: trace.amount,
                  source: '1inch_traces_api',
                  gasUsed: trace.gasUsed,
                  gasPrice: trace.gasPrice
                });
              }
            }
          }
          traceData = tracesData;
        }
      } catch (tracesError) {
        console.warn('⚠️ 1inch Traces API failed:', tracesError.message);
      }

      // 🆕 3. Enhanced History API call with additional parameters
      const historyApiUrl = `https://api.1inch.dev/history/v2.0/history/${userAddress}/events?chainId=42161&limit=100&tokens=${contractAddress}`;
      const response = await fetch(historyApiUrl, { headers });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Enhanced 1inch History API response:', `${data.items ? data.items.length : 0} items`);
        
        if (data.items) {
          for (const item of data.items) {
            // Enhanced processing of transaction data
            let isPgsTransaction = false;
            let transactionType = 'unknown';
            let amount = '0';
            let otherParty = null;
            let gasInfo = null;
            
            // 🆕 Extract gas information from transaction
            if (item.details && item.details.gasUsed && item.details.gasPrice) {
              gasInfo = {
                gasUsed: item.details.gasUsed,
                gasPrice: item.details.gasPrice,
                gasCost: (BigInt(item.details.gasUsed) * BigInt(item.details.gasPrice)).toString()
              };
            }
            
            // Enhanced tokenActions processing
            if (item.details && item.details.tokenActions && Array.isArray(item.details.tokenActions)) {
              for (const tokenAction of item.details.tokenActions) {
                if (tokenAction.address && tokenAction.address.toLowerCase() === contractAddress.toLowerCase()) {
                  isPgsTransaction = true;
                  
                  const { ethers } = require('ethers');
                  amount = ethers.formatEther(tokenAction.amount);
                  
                  // 🆕 Enhanced transaction type detection
                  if (tokenAction.fromAddress === '0x0000000000000000000000000000000000000000') {
                    transactionType = 'mint';
                  } else if (tokenAction.toAddress.toLowerCase() === userAddress.toLowerCase()) {
                    transactionType = 'receive';
                    otherParty = tokenAction.fromAddress;
                  } else if (tokenAction.fromAddress.toLowerCase() === userAddress.toLowerCase()) {
                    transactionType = 'transfer_out';
                    otherParty = tokenAction.toAddress;
                  }
                  
                  break;
                }
              }
            }
            
            if (isPgsTransaction) {
              const enhancedTransaction = {
                id: `1inch_enhanced_${item.details.txHash}_${item.eventOrderInTransaction || 0}`,
                type: transactionType,
                txHash: item.details.txHash,
                timestamp: new Date(item.timeMs).toLocaleString(),
                blockNumber: item.details.blockNumber,
                source: '1inch_enhanced_history_api',
                gasInfo: gasInfo,
                ...(transactionType === 'mint' && { tokensEarned: amount }),
                ...(transactionType === 'receive' && { amountReceived: amount, sender: otherParty }),
                ...(transactionType === 'transfer_out' && { amountTransferred: amount, recipient: otherParty })
              };
              
              pgsTransactions.push(enhancedTransaction);
            }
          }
        }
        
        // Remove duplicates from different API sources
        const uniqueTransactions = pgsTransactions.reduce((acc, current) => {
          const exists = acc.find(item => item.txHash === current.txHash);
          if (!exists) {
            acc.push(current);
          } else if (current.source === '1inch_enhanced_history_api') {
            // Prefer enhanced history API data over traces
            const index = acc.findIndex(item => item.txHash === current.txHash);
            acc[index] = current;
          }
          return acc;
        }, []);
        
        return res.status(200).json({
          success: true,
          source: 'enhanced_1inch_apis',
          transactions: uniqueTransactions,
          userAddress,
          contractAddress,
          metadata: {
            totalSources: ['history_api', 'traces_api', 'gas_api'].filter(Boolean).length,
            gasContext: gasData,
            traceCount: traceData?.traces?.length || 0,
            historyCount: data.items?.length || 0
          },
          timestamp: new Date().toISOString()
        });
      } else {
        const errorText = await response.text();
        console.error('❌ Enhanced 1inch History API error:', response.status, errorText);
        throw new Error(`Enhanced 1inch History API failed: ${response.status}`);
      }
    } catch (apiError) {
      console.warn('⚠️ Enhanced 1inch APIs failed, using enhanced contract events fallback:', apiError.message);
      
      // Fallback to contract event scanning
      const { ethers } = require('ethers');
      
      const provider = new ethers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
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