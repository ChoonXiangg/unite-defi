import { ethers } from 'ethers'

// This service handles all token-related operations
// It's the bridge between our UI and the smart contract

export class TokenService {
  constructor() {
    this.contract = null
    this.signer = null
    this.provider = null
    this.contractAddress = null
    this.ownerContract = null
    this.oneInchApiKey = process.env.ONEINCH_API_KEY || null
    
    // Debug: Log API key status (without exposing the actual key)
    console.log('🔧 TokenService initialized')
    console.log('   1inch API Key:', this.oneInchApiKey ? 'Present ✅' : 'Not found ❌')
    
    // Contract ABI - this defines which functions we can call
    this.contractABI = [
      // Read functions
      "function name() view returns (string)",
      "function symbol() view returns (string)", 
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      
      // Token generation functions with dynamic pricing
      "function mintRewardForSwapSimple(address to, uint256 usdCents)",
      "function calculateReward(uint256 usdCents) view returns (uint256)",
      
      // Dynamic pricing functions
      "function getPricingInfo() view returns (uint256, uint256, uint256, uint256, uint256)",
      "function simulateTotalSupply(uint256 targetUsdSwapped) view returns (uint256)",
      "function totalUsdSwapped() view returns (uint256)",
      "function currentPriceMultiplier() view returns (uint256)",
      "function halveningCount() view returns (uint256)",
      "function manualHalvening()",
      
      // Spending and transfer functions
      "function spendTokens(uint256 amount, string memory itemName)",
      "function transferToUser(address to, uint256 amount, string memory message)",
      
      // Admin functions
      "function owner() view returns (address)",
      "function minter() view returns (address)",
      "function setMinter(address newMinter)",
      
      // Events
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Mint(address indexed to, uint256 amount, string reason)",
      "event TokensSpent(address indexed user, uint256 amount, string item)",
      "event UserTransfer(address indexed from, address indexed to, uint256 amount, string message)",
      "event Halvening(uint256 indexed halveningNumber, uint256 newPriceMultiplier, uint256 totalUsdSwapped)",
      "event SwapProcessed(address indexed user, uint256 usdAmount, uint256 tokensEarned, uint256 currentMultiplier)"
    ]
  }

  // Initialize the service with wallet connection
  async initialize(provider, userAddress) {
    try {
      // Store provider reference
      this.provider = provider
      // Get signer properly for ethers v6
      this.signer = await provider.getSigner()
      this.userAddress = userAddress
      
      // Connect to deployed contract
      await this.deployContract()
      
      return true
    } catch (error) {
      console.error('Failed to initialize token service:', error)
      return false
    }
  }

  // Load contract address from deployment info file
  async loadContractAddress() {
    try {
      // Try to load from Arbitrum One (mainnet) deployment info first
      let response = await fetch('/deployment-info/pgs-deployment-arbitrumOne.json')
      
      if (!response.ok) {
        // Fallback to Arbitrum Sepolia if mainnet not found
        response = await fetch('/deployment-info/pgs-deployment-arbitrumSepolia.json')
      }
      
      if (!response.ok) {
        // Final fallback to regular sepolia
        response = await fetch('/deployment-info/pgs-deployment-sepolia.json')
      }
      
      if (response.ok) {
        const deploymentInfo = await response.json()
        console.log('✅ Loaded contract address from deployment info:', deploymentInfo.contractAddress)
        console.log('📡 Network:', deploymentInfo.network, 'Chain ID:', deploymentInfo.chainId)
        console.log('📡 Full deployment info:', deploymentInfo)
        return deploymentInfo.contractAddress
      } else {
        throw new Error('Deployment info file not found')
      }
    } catch (error) {
      console.error('❌ Failed to load contract address from deployment info:', error)
      throw new Error('Cannot load contract address. Please deploy the contract first.')
    }
  }

  // Connect to the deployed contract
  async deployContract() {
    console.log('Connecting to deployed PGS contract...')
    
    // Load contract address from deployment info file
    this.contractAddress = await this.loadContractAddress()
    
    // Create contract instance
    if (this.signer) {
      this.contract = new ethers.Contract(
        this.contractAddress, 
        this.contractABI, 
        this.signer
      )
    }
    
    console.log('Contract connected at:', this.contractAddress)
    
    // Test the contract connection with better error handling
    try {
      const contractName = await this.contract.name()
      console.log('Contract name verified:', contractName)
      
      // Also verify we're on the right network
      const network = await this.signer.provider.getNetwork()
      console.log('Connected to network:', network.name, 'Chain ID:', network.chainId)
      
      // Support Arbitrum One mainnet and testnets
      const supportedChainIds = [42161n, 421614n, 11155111n] // Arbitrum One, Arbitrum Sepolia, Ethereum Sepolia
      if (!supportedChainIds.includes(network.chainId)) {
        throw new Error(`Unsupported network! Expected Arbitrum One (42161), Arbitrum Sepolia (421614) or Ethereum Sepolia (11155111), got ${network.chainId}`)
      }
      
    } catch (error) {
      console.error('Contract connection test failed:', error)
      throw new Error(`Failed to connect to contract: ${error.message}`)
    }
  }

  // Main function: Generate tokens for a swap (Production-like backend API call)
  // Input: usdAmount as string (e.g., "150.75")
  // Returns: transaction result
  async generateTokensForSwap(usdAmount) {
    try {
      console.log(`🎯 Frontend: Requesting tokens for $${usdAmount} swap`)
      
      // Get the current user's address
      const userAddress = await this.signer.getAddress()
      console.log(`   User address: ${userAddress}`)
      
      // Generate unique swap transaction ID
      const swapTransactionId = `swap_${Date.now()}_${userAddress.slice(-6)}`
      
      // Call backend API (production-like)
      const response = await fetch('/api/reward-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: userAddress,
          swapAmountUSD: parseFloat(usdAmount),
          swapTransactionId: swapTransactionId
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Backend request failed')
      }
      
      if (result.success) {
        console.log('✅ Backend successfully minted tokens')
        console.log(`   Transaction: ${result.data.transactionHash}`)
        console.log(`   Tokens earned: ${result.data.rewardTokens}`)
        console.log(`   Block number: ${result.data.blockNumber}`)
        
        return {
          success: true,
          txHash: result.data.transactionHash,
          usdAmount: usdAmount,
          tokensEarned: result.data.rewardTokens.toString(),
          receipt: { blockNumber: result.data.blockNumber }
        }
      } else {
        throw new Error(result.message || 'Token generation failed')
      }
      
    } catch (error) {
      console.error('❌ Frontend: Error requesting tokens from backend:', error)
      console.error('   Error details:', error.message)
      console.error('   Stack:', error.stack)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Preview how many tokens user would get (without actually minting) using dynamic pricing
  async previewReward(usdAmount) {
    if (!this.contract) {
      throw new Error('Contract not initialized')
    }

    const usdCents = this.usdToCents(usdAmount)
    const rewardWei = await this.contract.calculateReward(usdCents)
    return rewardWei
  }

  // Get current dynamic pricing information
  async getPricingInfo() {
    if (!this.contract) {
      throw new Error('Contract not initialized')
    }

    try {
      const [currentMultiplier, totalSwapped, nextHalveningAt, halvenings, tokensPerDollar] = 
        await this.contract.getPricingInfo()
      
      return {
        currentPriceMultiplier: currentMultiplier.toString(),
        totalUsdSwapped: this.formatTokenAmount(totalSwapped), // Convert from wei to readable USD
        nextHalveningAt: this.formatTokenAmount(nextHalveningAt),
        halveningCount: halvenings.toString(),
        tokensPerDollar: this.formatTokenAmount(tokensPerDollar),
        currentRate: `1 PGS = $${Number(currentMultiplier).toFixed(2)}`,
        progress: {
          current: this.formatTokenAmount(totalSwapped),
          target: this.formatTokenAmount(nextHalveningAt),
          percentage: (Number(this.formatTokenAmount(totalSwapped)) / Number(this.formatTokenAmount(nextHalveningAt)) * 100).toFixed(2)
        }
      }
    } catch (error) {
      console.error('Error getting pricing info:', error)
      throw error
    }
  }

  // Simulate what total supply would be after certain USD amount is swapped
  async simulateTotalSupply(targetUsdAmount) {
    if (!this.contract) {
      throw new Error('Contract not initialized')
    }

    try {
      const targetUsdWei = ethers.parseEther(targetUsdAmount.toString())
      const estimatedSupply = await this.contract.simulateTotalSupply(targetUsdWei)
      return this.formatTokenAmount(estimatedSupply)
    } catch (error) {
      console.error('Error simulating total supply:', error)
      throw error
    }
  }

  // Get user's current token balance using 1inch Balance API with fallback
  async getTokenBalance(address = null) {
    const targetAddress = address || await this.signer.getAddress()
    console.log('🔍 Getting balance for address:', targetAddress)
    console.log('🔍 Contract address:', this.contractAddress)
    
    // Try 1inch Balance API first (faster and more reliable)
    try {
      const oneInchBalance = await this.getBalanceVia1inch(targetAddress)
      if (oneInchBalance !== null) {
        console.log('✅ Balance loaded via 1inch API:', oneInchBalance)
        return ethers.parseEther(oneInchBalance)
      }
    } catch (error) {
      console.warn('⚠️ 1inch API failed, falling back to direct contract call:', error.message)
    }
    
    // Fallback to direct contract call
    if (!this.contract) {
      throw new Error('Contract not initialized and 1inch API unavailable')
    }
    
    console.log('🔄 Using direct contract call fallback')
    const balanceWei = await this.contract.balanceOf(targetAddress)
    console.log('🔍 Raw balance from contract (wei):', balanceWei.toString())
    console.log('🔍 Formatted balance (ether):', this.formatTokenAmount(balanceWei))
    
    return balanceWei
  }

  // Enhanced 1inch API integration with multiple services
  async getBalanceVia1inch(userAddress) {
    if (!this.contractAddress) {
      throw new Error('Contract address not set')
    }
    
    console.log('🌐 Fetching balance via enhanced 1inch APIs...')
    console.log('   User address:', userAddress)
    console.log('   Contract address:', this.contractAddress)
    console.log('   Chain ID: 42161 (Arbitrum One)')
    console.log('   API Key status:', this.oneInchApiKey ? 'Available ✅' : 'Missing ❌')
    
    const headers = {
      'Accept': 'application/json'
    }
    
    if (this.oneInchApiKey) {
      headers['Authorization'] = `Bearer ${this.oneInchApiKey}`
      console.log('🔑 Using API key for authenticated request')
    } else {
      console.log('🔓 Using public API (rate limited)')
    }

    // 🆕 Get additional context data in parallel
    const [balanceData, gasData, tokenMetadata] = await Promise.allSettled([
      // Balance API
      fetch(`https://api.1inch.dev/balance/v1.2/42161/balances/${userAddress}`, { headers })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`Balance API error: ${r.status}`))),
      
      // 🆕 Gas Price API for transaction cost estimation
      fetch(`https://api.1inch.dev/gas-price/v1.5/42161`, { headers })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`Gas API error: ${r.status}`))),
      
      // 🆕 Token metadata API
      fetch(`https://api.1inch.dev/token/v1.2/42161/custom?addresses=${this.contractAddress}`, { headers })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`Token API error: ${r.status}`)))
    ])

    // Process balance data
    if (balanceData.status === 'fulfilled') {
      const data = balanceData.value
      console.log(`✅ 1inch Balance API found ${Object.keys(data).length} tokens`)
      
      // Extract PGS token balance
      const tokenBalance = data[this.contractAddress.toLowerCase()] || data[this.contractAddress]
      
      if (tokenBalance !== undefined && tokenBalance !== '0') {
        const formattedBalance = ethers.formatEther(tokenBalance)
        console.log('✅ PGS balance from enhanced 1inch API:', formattedBalance)

        // 🆕 Log additional context data
        if (gasData.status === 'fulfilled') {
          console.log('💰 Current gas prices:', gasData.value)
        }
        if (tokenMetadata.status === 'fulfilled') {
          const metadata = tokenMetadata.value[this.contractAddress.toLowerCase()]
          console.log('📋 Token metadata:', metadata)
        }
        
        return formattedBalance
      }
    }

    // If balance not found or API failed
    console.log('⚠️ PGS token not found in 1inch response or API failed, balance is 0')
    return '0'
  }

  // 🆕 New method: Get comprehensive token information using multiple 1inch APIs
  async getEnhancedTokenInfo(userAddress) {
    if (!this.contractAddress) {
      throw new Error('Contract address not set')
    }

    const headers = {
      'Accept': 'application/json'
    }
    
    if (this.oneInchApiKey) {
      headers['Authorization'] = `Bearer ${this.oneInchApiKey}`
    }

    try {
      console.log('🔍 Getting enhanced token info via 1inch APIs...')

      const [balanceResult, tokenResult, gasResult, historyResult] = await Promise.allSettled([
        // Balance
        fetch(`https://api.1inch.dev/balance/v1.2/42161/balances/${userAddress}`, { headers })
          .then(r => r.ok ? r.json() : null),
        
        // Token metadata
        fetch(`https://api.1inch.dev/token/v1.2/42161/custom?addresses=${this.contractAddress}`, { headers })
          .then(r => r.ok ? r.json() : null),
        
        // Gas prices
        fetch(`https://api.1inch.dev/gas-price/v1.5/42161`, { headers })
          .then(r => r.ok ? r.json() : null),
        
        // Recent history
        fetch(`https://api.1inch.dev/history/v2.0/history/${userAddress}/events?chainId=42161&limit=10&tokens=${this.contractAddress}`, { headers })
          .then(r => r.ok ? r.json() : null)
      ])

      const result = {
        balance: '0',
        metadata: null,
        gasInfo: null,
        recentTransactions: [],
        sources: []
      }

      // Process balance
      if (balanceResult.status === 'fulfilled' && balanceResult.value) {
        const tokenBalance = balanceResult.value[this.contractAddress.toLowerCase()]
        if (tokenBalance) {
          result.balance = ethers.formatEther(tokenBalance)
          result.sources.push('balance_api')
        }
      }

      // Process token metadata
      if (tokenResult.status === 'fulfilled' && tokenResult.value) {
        result.metadata = tokenResult.value[this.contractAddress.toLowerCase()]
        if (result.metadata) result.sources.push('token_api')
      }

      // Process gas info
      if (gasResult.status === 'fulfilled' && gasResult.value) {
        result.gasInfo = gasResult.value
        result.sources.push('gas_api')
      }

      // Process recent transactions
      if (historyResult.status === 'fulfilled' && historyResult.value?.items) {
        result.recentTransactions = historyResult.value.items.slice(0, 5)
        if (result.recentTransactions.length > 0) result.sources.push('history_api')
      }

      console.log(`✅ Enhanced token info retrieved via ${result.sources.length} APIs:`, result.sources)
      return result

    } catch (error) {
      console.error('❌ Enhanced token info failed:', error)
      throw error
    }
  }

  // Utility: Convert USD string to cents
  // "150.75" → 15075
  // "100" → 10000
  usdToCents(usdString) {
    const usdFloat = parseFloat(usdString)
    if (isNaN(usdFloat) || usdFloat < 0) {
      throw new Error('Invalid USD amount')
    }
    
    // Round to 2 decimal places and convert to cents
    const cents = Math.round(usdFloat * 100)
    return cents
  }

  // Utility: Format token amount from wei to readable string
  // 1500000000000000000 → "1.5"
  formatTokenAmount(tokenWei) {
    return ethers.formatEther(tokenWei)
  }

  // Utility: Convert readable token amount to wei
  // "1.5" → 1500000000000000000
  parseTokenAmount(tokenString) {
    return ethers.parseEther(tokenString)
  }

  // Spend tokens in the app
  async spendTokens(amount, itemName) {
    if (!this.contract) {
      throw new Error('Contract not initialized')
    }

    try {
      const amountWei = this.parseTokenAmount(amount)
      const tx = await this.contract.spendTokens(amountWei, itemName)
      const receipt = await tx.wait()
      
      return {
        success: true,
        txHash: tx.hash,
        amountSpent: amount,
        itemPurchased: itemName,
        receipt: receipt
      }
    } catch (error) {
      console.error('Error spending tokens:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Transfer tokens to another user
  async transferToUser(toAddress, amount, message = '') {
    if (!this.contract) {
      throw new Error('Contract not initialized')
    }

    try {
      // Validate address format
      if (!ethers.isAddress(toAddress)) {
        throw new Error('Invalid recipient address')
      }

      const amountWei = this.parseTokenAmount(amount)
      const tx = await this.contract.transferToUser(toAddress, amountWei, message)
      const receipt = await tx.wait()
      
      return {
        success: true,
        txHash: tx.hash,
        amountTransferred: amount,
        recipient: toAddress,
        message: message,
        receipt: receipt
      }
    } catch (error) {
      console.error('Error transferring tokens:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Load real transaction history from blockchain
  async getTransactionHistory(userAddress, limit = 10) {
    if (!this.contract) {
      throw new Error('Contract not initialized')
    }

    if (!this.provider) {
      throw new Error('Provider not initialized')
    }

    try {
      console.log('🔍 Loading real transaction history from blockchain...')
      console.log('   User address:', userAddress)
      console.log('   Contract address:', this.contractAddress)
      
      // Get all Transfer events for this user (both incoming and outgoing)
      const transferFilter = this.contract.filters.Transfer()
      const mintFilter = this.contract.filters.Mint()
      const spentFilter = this.contract.filters.TokensSpent()
      const userTransferFilter = this.contract.filters.UserTransfer()

      // Get events from recent blocks (last 50000 blocks or from contract deployment)
      const currentBlock = await this.provider.getBlockNumber()
      const fromBlock = Math.max(0, currentBlock - 50000)
      
      console.log(`📊 Current block: ${currentBlock}, scanning from block: ${fromBlock}`)
      console.log(`📊 Contract address: ${this.contractAddress}`)

      // Fetch all relevant events
      console.log('📡 Fetching blockchain events...')
      const [transferEvents, mintEvents, spentEvents, userTransferEvents] = await Promise.all([
        this.contract.queryFilter(transferFilter, fromBlock, currentBlock).catch(e => { console.error('Transfer events error:', e); return []; }),
        this.contract.queryFilter(mintFilter, fromBlock, currentBlock).catch(e => { console.error('Mint events error:', e); return []; }),
        this.contract.queryFilter(spentFilter, fromBlock, currentBlock).catch(e => { console.error('Spent events error:', e); return []; }),
        this.contract.queryFilter(userTransferFilter, fromBlock, currentBlock).catch(e => { console.error('UserTransfer events error:', e); return []; })
      ])

      console.log(`📝 Found ${transferEvents.length} transfers, ${mintEvents.length} mints, ${spentEvents.length} spends, ${userTransferEvents.length} user transfers`)
      console.log(`📝 User address filter: ${userAddress.toLowerCase()}`)

      const transactions = []

      // Process Transfer events (mints and regular transfers)
      for (const event of transferEvents) {
        const { from, to, value } = event.args
        const block = await event.getBlock()
        
        // Mint events (from address(0))
        if (from === ethers.ZeroAddress && to.toLowerCase() === userAddress.toLowerCase()) {
          console.log(`🎯 Found mint event: ${this.formatTokenAmount(value)} tokens to ${to}`)
          transactions.push({
            id: `mint_${event.transactionHash}_${event.logIndex}`,
            type: 'mint',
            tokensEarned: this.formatTokenAmount(value),
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber
          })
        }
        // Regular transfers TO user
        else if (to.toLowerCase() === userAddress.toLowerCase() && from !== ethers.ZeroAddress) {
          transactions.push({
            id: `receive_${event.transactionHash}_${event.logIndex}`,
            type: 'receive',
            amountReceived: this.formatTokenAmount(value),
            sender: from,
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber
          })
        }
        // Regular transfers FROM user
        else if (from.toLowerCase() === userAddress.toLowerCase() && to !== ethers.ZeroAddress) {
          transactions.push({
            id: `send_${event.transactionHash}_${event.logIndex}`,
            type: 'send',
            amountSent: this.formatTokenAmount(value),
            recipient: to,
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber
          })
        }
      }

      // Process TokensSpent events
      for (const event of spentEvents) {
        const { user, amount, item } = event.args
        if (user.toLowerCase() === userAddress.toLowerCase()) {
          const block = await event.getBlock()
          transactions.push({
            id: `spend_${event.transactionHash}_${event.logIndex}`,
            type: 'spend',
            amountSpent: this.formatTokenAmount(amount),
            itemPurchased: item,
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber
          })
        }
      }

      // Process UserTransfer events for messages
      for (const event of userTransferEvents) {
        const { from, to, amount, message } = event.args
        if (from.toLowerCase() === userAddress.toLowerCase() || to.toLowerCase() === userAddress.toLowerCase()) {
          const block = await event.getBlock()
          const isOutgoing = from.toLowerCase() === userAddress.toLowerCase()
          
          transactions.push({
            id: `user_transfer_${event.transactionHash}_${event.logIndex}`,
            type: isOutgoing ? 'transfer_out' : 'transfer_in',
            amountTransferred: this.formatTokenAmount(amount),
            [isOutgoing ? 'recipient' : 'sender']: isOutgoing ? to : from,
            message: message,
            txHash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toLocaleString(),
            blockNumber: event.blockNumber
          })
        }
      }

      // Sort by block number (newest first) and limit results
      const sortedTransactions = transactions
        .sort((a, b) => b.blockNumber - a.blockNumber)
        .slice(0, limit)

      console.log(`✅ Loaded ${sortedTransactions.length} real transactions from blockchain`)
      return sortedTransactions

    } catch (error) {
      console.error('❌ Error loading transaction history:', error)
      console.error('   Error details:', error.message)
      console.error('   Stack:', error.stack)
      return []
    }
  }
}

// Export a singleton instance
export const tokenService = new TokenService()