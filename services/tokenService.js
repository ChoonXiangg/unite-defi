import { ethers } from 'ethers'

// This service handles all token-related operations
// It's the bridge between our UI and the smart contract

export class TokenService {
  constructor() {
    this.contract = null
    this.signer = null
    this.contractAddress = null
    
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
      
      // Spending functions
      "function spendTokens(uint256 amount, string memory itemName)",
      
      // Admin functions
      "function owner() view returns (address)",
      "function minter() view returns (address)",
      "function setMinter(address newMinter)",
      
      // Events
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Mint(address indexed to, uint256 amount, string reason)"
    ]
  }

  // Initialize the service with wallet connection
  async initialize(provider, userAddress) {
    try {
      this.signer = provider.getSigner()
      this.userAddress = userAddress
      
      // For now, we'll deploy a new contract for testing
      // In production, this would connect to an existing deployed contract
      await this.deployContract()
      
      return true
    } catch (error) {
      console.error('Failed to initialize token service:', error)
      return false
    }
  }

  // Deploy the contract (for testing purposes)
  async deployContract() {
    // Contract bytecode would go here - for now we'll simulate
    // In a real implementation, you'd have the compiled contract bytecode
    console.log('Deploying UniteRewardToken contract...')
    
    // Simulated contract address for demo
    this.contractAddress = '0x1234567890123456789012345678901234567890'
    
    // Create contract instance
    if (this.signer) {
      this.contract = new ethers.Contract(
        this.contractAddress, 
        this.contractABI, 
        this.signer
      )
    }
    
    console.log('Contract deployed at:', this.contractAddress)
  }

  // Main function: Generate tokens for a swap
  // Input: usdAmount as string (e.g., "150.75")
  // Returns: transaction result
  async generateTokensForSwap(usdAmount) {
    if (!this.contract) {
      throw new Error('Contract not initialized')
    }

    try {
      // Convert USD string to cents
      // "150.75" → 15075 cents
      const usdCents = this.usdToCents(usdAmount)
      
      console.log(`Generating tokens for $${usdAmount} (${usdCents} cents)`)
      
      // Preview the reward first
      const expectedTokens = await this.previewReward(usdAmount)
      console.log(`Expected reward: ${this.formatTokenAmount(expectedTokens)} URT`)
      
      // Execute the minting transaction
      const tx = await this.contract.mintRewardForSwapSimple(
        this.userAddress, 
        usdCents
      )
      
      console.log('Transaction sent:', tx.hash)
      
      // Wait for transaction confirmation
      const receipt = await tx.wait()
      console.log('Transaction confirmed:', receipt)
      
      return {
        success: true,
        txHash: tx.hash,
        usdAmount: usdAmount,
        tokensEarned: this.formatTokenAmount(expectedTokens),
        receipt: receipt
      }
      
    } catch (error) {
      console.error('Error generating tokens:', error)
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

    const targetAddress = address || this.userAddress
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
    return ethers.utils.formatEther(tokenWei)
  }

  // Utility: Convert readable token amount to wei
  // "1.5" → 1500000000000000000
  parseTokenAmount(tokenString) {
    return ethers.utils.parseEther(tokenString)
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
}

// Export a singleton instance
export const tokenService = new TokenService()