import { ethers } from 'ethers'

// This service handles all token-related operations
// It's the bridge between our UI and the smart contract

export class TokenService {
  constructor() {
    this.contract = null
    this.signer = null
    this.contractAddress = null
    this.ownerContract = null // Contract instance with owner's signer
    
    // Contract ABI - this defines which functions we can call
    this.contractABI = [
      // Read functions
      "function name() view returns (string)",
      "function symbol() view returns (string)", 
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      
      // Token generation functions
      "function mintRewardForSwapSimple(address to, uint256 usdCents)",
      "function calculateReward(uint256 usdCents) view returns (uint256)",
      
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
      "event UserTransfer(address indexed from, address indexed to, uint256 amount, string message)"
    ]
  }

  // Initialize the service with wallet connection
  async initialize(provider, userAddress) {
    try {
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
      // Try to load from Arbitrum Sepolia deployment info first
      let response = await fetch('/deployment-info/sybau-deployment-arbitrumSepolia.json')
      
      if (!response.ok) {
        // Fallback to regular sepolia if arbitrum sepolia not found
        response = await fetch('/deployment-info/sybau-deployment-sepolia.json')
      }
      
      if (response.ok) {
        const deploymentInfo = await response.json()
        console.log('✅ Loaded contract address from deployment info:', deploymentInfo.contractAddress)
        console.log('📡 Network:', deploymentInfo.network, 'Chain ID:', deploymentInfo.chainId)
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
    console.log('Connecting to deployed SYBAU contract...')
    
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
      
      // Support both Arbitrum Sepolia and Ethereum Sepolia
      const supportedChainIds = [421614n, 11155111n] // Arbitrum Sepolia, Ethereum Sepolia
      if (!supportedChainIds.includes(network.chainId)) {
        throw new Error(`Unsupported network! Expected Arbitrum Sepolia (421614) or Ethereum Sepolia (11155111), got ${network.chainId}`)
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
      
      // Generate a simulated swap transaction ID (in production, this would be real)
      const swapTransactionId = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
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
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Preview how many tokens user would get (without actually minting)
  async previewReward(usdAmount) {
    if (!this.contract) {
      throw new Error('Contract not initialized')
    }

    const usdCents = this.usdToCents(usdAmount)
    const rewardWei = await this.contract.calculateReward(usdCents)
    return rewardWei
  }

  // Get user's current token balance
  async getTokenBalance(address = null) {
    if (!this.contract) {
      throw new Error('Contract not initialized')
    }

    const targetAddress = address || await this.signer.getAddress()
    const balanceWei = await this.contract.balanceOf(targetAddress)
    return balanceWei
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

    try {
      console.log('🔍 Loading real transaction history from blockchain...')
      
      // Get all Transfer events for this user (both incoming and outgoing)
      const transferFilter = this.contract.filters.Transfer()
      const mintFilter = this.contract.filters.Mint()
      const spentFilter = this.contract.filters.TokensSpent()
      const userTransferFilter = this.contract.filters.UserTransfer()

      // Get events from recent blocks (last 10000 blocks)
      const currentBlock = await this.contract.provider.getBlockNumber()
      const fromBlock = Math.max(0, currentBlock - 10000)

      console.log(`📊 Scanning blocks ${fromBlock} to ${currentBlock}...`)

      // Fetch all relevant events
      const [transferEvents, mintEvents, spentEvents, userTransferEvents] = await Promise.all([
        this.contract.queryFilter(transferFilter, fromBlock, currentBlock),
        this.contract.queryFilter(mintFilter, fromBlock, currentBlock), 
        this.contract.queryFilter(spentFilter, fromBlock, currentBlock),
        this.contract.queryFilter(userTransferFilter, fromBlock, currentBlock)
      ])

      console.log(`📝 Found ${transferEvents.length} transfers, ${mintEvents.length} mints, ${spentEvents.length} spends, ${userTransferEvents.length} user transfers`)

      const transactions = []

      // Process Transfer events (mints and regular transfers)
      for (const event of transferEvents) {
        const { from, to, value } = event.args
        const block = await event.getBlock()
        
        // Mint events (from address(0))
        if (from === ethers.ZeroAddress && to.toLowerCase() === userAddress.toLowerCase()) {
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
      console.error('Error loading transaction history:', error)
      return []
    }
  }
}

// Export a singleton instance
export const tokenService = new TokenService()