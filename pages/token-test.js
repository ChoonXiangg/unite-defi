import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { tokenService } from '../services/tokenService'

// Standalone Token Generation Test Page
// This is completely isolated from the main app
// Access via: /token-test

export default function TokenTest() {
  // State for the test interface
  const [swapAmount, setSwapAmount] = useState('')
  const [tokenBalance, setTokenBalance] = useState('0')
  const [previewReward, setPreviewReward] = useState('0')
  const [isLoading, setIsLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [error, setError] = useState('')
  const [walletConnected, setWalletConnected] = useState(false)
  const [userAddress, setUserAddress] = useState('')
  
  // Transfer states
  const [transferAddress, setTransferAddress] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferMessage, setTransferMessage] = useState('')

  // Real contract service instance
  const [contractService, setContractService] = useState(null)

  useEffect(() => {
    // Initialize real contract and check wallet connection
    initializeRealContract()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load real transaction history from blockchain
  const loadRealTransactionHistory = async () => {
    if (!contractService || !userAddress) return
    
    try {
      console.log('🔍 Loading real transaction history from blockchain...')
      const realTransactions = await contractService.getTransactionHistory(userAddress, 10)
      
      // Convert blockchain transactions to display format
      const displayTransactions = realTransactions.map(tx => {
        switch (tx.type) {
          case 'mint':
            return {
              id: tx.id,
              type: 'mint',
              tokensEarned: tx.tokensEarned,
              usdAmount: (parseFloat(tx.tokensEarned) * 100).toString(), // Reverse calculate USD
              txHash: tx.txHash,
              timestamp: tx.timestamp
            }
          case 'spend':
            return {
              id: tx.id,
              type: 'spend',
              amountSpent: tx.amountSpent,
              itemPurchased: tx.itemPurchased,
              txHash: tx.txHash,
              timestamp: tx.timestamp
            }
          case 'transfer_out':
          case 'user_transfer':
            return {
              id: tx.id,
              type: 'transfer',
              amountTransferred: tx.amountTransferred,
              recipient: tx.recipient,
              message: tx.message || '',
              txHash: tx.txHash,
              timestamp: tx.timestamp
            }
          case 'receive':
          case 'transfer_in':
            return {
              id: tx.id,
              type: 'receive',
              amountReceived: tx.amountReceived || tx.amountTransferred,
              sender: tx.sender,
              message: tx.message || '',
              txHash: tx.txHash,
              timestamp: tx.timestamp
            }
          default:
            return null
        }
      }).filter(Boolean)
      
      setTransactions(displayTransactions)
      console.log(`✅ Loaded ${displayTransactions.length} real transactions from blockchain`)
    } catch (error) {
      console.error('Failed to load transaction history:', error)
    }
  }

  const initializeRealContract = async () => {
    // Check if wallet is available
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          setUserAddress(accounts[0])
          setWalletConnected(true)
          
          // Initialize real contract service
          await setupContractService()
        }
      } catch (error) {
        console.log('Wallet not connected')
      }
    }
  }

  const setupContractService = async () => {
    try {
      // Make sure we're connected to Arbitrum Sepolia first
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x66eee' }] // 421614 in hex - Arbitrum Sepolia Testnet
      })
      
      // Create provider for Arbitrum Sepolia Testnet
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send("eth_requestAccounts", [])
      
      // Initialize the token service with the provider
      const initialized = await tokenService.initialize(provider, userAddress)
      
      if (initialized) {
        setContractService(tokenService)
        await loadTokenBalance()
        await loadRealTransactionHistory()
        console.log('✅ Real contract service initialized')
      } else {
        throw new Error('Failed to initialize contract service')
      }
    } catch (error) {
      console.error('Contract setup failed:', error)
      setError('Failed to connect to contract. Make sure MetaMask is connected to Arbitrum Sepolia Testnet')
    }
  }

  const addArbitrumSepoliaNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x66eee', // 421614 in hex
          chainName: 'Arbitrum Sepolia',
          rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
          nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
          },
          blockExplorerUrls: ['https://sepolia.arbiscan.io/']
        }]
      })
      console.log('✅ Arbitrum Sepolia network added to MetaMask')
    } catch (error) {
      console.error('Failed to add network:', error)
      setError('Failed to add Arbitrum Sepolia to MetaMask')
    }
  }

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        // First try to add/switch to Arbitrum Sepolia network
        await addArbitrumSepoliaNetwork()
        
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        setUserAddress(accounts[0])
        setWalletConnected(true)
        await setupContractService()
        setError('')
      } catch (error) {
        setError('Failed to connect wallet. Make sure you have MetaMask installed and try adding the Hardhat network manually.')
      }
    } else {
      setError('Please install MetaMask or another wallet')
    }
  }

  const loadTokenBalance = async () => {
    if (!contractService || !userAddress) return
    
    try {
      console.log('🔍 Loading real balance from blockchain...')
      const balanceWei = await contractService.getTokenBalance(userAddress)
      const formattedBalance = ethers.formatEther(balanceWei)
      setTokenBalance(formattedBalance)
      console.log(`✅ Real blockchain balance: ${formattedBalance} SYBAU`)
    } catch (error) {
      console.error('Failed to load balance:', error)
      setTokenBalance('0')
    }
  }

  const updateRewardPreview = async () => {
    if (!swapAmount || !contractService) {
      setPreviewReward('0')
      return
    }
    
    try {
      const rewardWei = await contractService.previewReward(swapAmount)
      const formattedReward = ethers.formatEther(rewardWei)
      setPreviewReward(formattedReward)
    } catch (error) {
      setPreviewReward('0')
    }
  }

  useEffect(() => {
    updateRewardPreview()
  }, [swapAmount, contractService]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSimulateSwap = async () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) {
      setError('Please enter a valid swap amount')
      return
    }

    if (!contractService) {
      setError('Contract not initialized')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Execute the real contract transaction
      const result = await contractService.generateTokensForSwap(swapAmount)
      
      if (result.success) {
        // Clear form and reload real data from blockchain
        setSwapAmount('')
        await loadTokenBalance()
        await loadRealTransactionHistory() // Load fresh data from blockchain
      } else {
        setError(result.error || 'Transaction failed')
      }
      
    } catch (error) {
      setError(error.message || 'Transaction failed')
    }

    setIsLoading(false)
  }

  const handleSpendTokens = async (amount, itemName) => {
    if (!contractService) {
      setError('Contract not initialized')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await contractService.spendTokens(amount, itemName)
      
      if (result.success) {
        // Reload real data from blockchain
        await loadTokenBalance()
        await loadRealTransactionHistory() // Load fresh data from blockchain
      } else {
        setError(result.error || 'Spending failed')
      }
      
    } catch (error) {
      setError(error.message || 'Spending failed')
    }

    setIsLoading(false)
  }

  const handleTransferTokens = async () => {
    if (!transferAddress || !transferAmount) {
      setError('Please enter recipient address and amount')
      return
    }

    if (!contractService) {
      setError('Contract not initialized')
      return
    }

    if (parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > parseFloat(tokenBalance)) {
      setError('Invalid transfer amount')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await contractService.transferToUser(transferAddress, transferAmount, transferMessage)
      
      if (result.success) {
        // Reload real data from blockchain
        await loadTokenBalance()
        await loadRealTransactionHistory() // Load fresh data from blockchain
        
        // Clear form
        setTransferAddress('')
        setTransferAmount('')
        setTransferMessage('')
      } else {
        setError(result.error || 'Transfer failed')
      }
      
    } catch (error) {
      setError(error.message || 'Transfer failed')
    }

    setIsLoading(false)
  }

  const refreshBlockchainData = () => {
    // Refresh all data from blockchain
    setError('')
    loadTokenBalance() // Refresh balance from blockchain
    loadRealTransactionHistory() // Refresh transaction history from blockchain
  }

  if (!walletConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <h1 className="text-3xl font-bold text-center mb-4">🧪 Token Test Lab</h1>
          <p className="text-gray-600 text-center mb-8">
            Isolated testing environment for SYBAU token generation
          </p>
          
          <button
            onClick={connectWallet}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-4 rounded-lg transition-colors mb-4"
          >
            Connect Wallet to Test
          </button>

          <button
            onClick={addArbitrumSepoliaNetwork}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            📡 Add Arbitrum Sepolia to MetaMask
          </button>
          
          <div className="mt-6 text-sm text-gray-500">
            <p><strong>Setup Instructions:</strong></p>
            <p>1. Click &quot;Add Arbitrum Sepolia&quot; button above</p>
            <p>2. Get free testnet ETH from: <a href="https://faucets.chain.link/arbitrum-sepolia" target="_blank" className="text-blue-600 underline">Chainlink Arbitrum Sepolia Faucet</a></p>
            <p>3. Connect wallet to start testing real Arbitrum blockchain transactions</p>
            <p className="text-xs mt-2">
              <strong>Need more ETH?</strong> Try <a href="https://bridge.arbitrum.io/" target="_blank" className="text-blue-600 underline">Arbitrum Bridge</a> (bridge from Ethereum Sepolia)
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🧪 SYBAU Token Test Lab</h1>
          <p className="text-gray-600">Isolated Token Generation Testing Environment</p>
          <div className="mt-4 flex items-center justify-center space-x-4">
            <span className="text-sm text-gray-500">
              Testing with: {userAddress?.slice(0, 8)}...{userAddress?.slice(-6)}
            </span>
            <button
              onClick={refreshBlockchainData}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-2 xl:grid-cols-4">
          {/* Token Generation */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4">💱 Token Generator</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Test the token reward calculation<br/>
              <span className="font-semibold text-purple-600">Rate: $100 USD = 1.0 SYBAU</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Swap Amount (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="150.75"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {previewReward !== '0' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    Will generate: <span className="font-bold">{previewReward} SYBAU</span>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Calculation: ${swapAmount} ÷ 100 = {previewReward} tokens
                  </p>
                </div>
              )}

              <button
                onClick={handleSimulateSwap}
                disabled={isLoading || !swapAmount}
                className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Generating...' : '🚀 Generate Tokens'}
              </button>
            </div>
          </div>

          {/* Token Balance & Store */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4">💰 Your Wallet</h2>
            
            {/* Enhanced Balance Display */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6 border border-purple-200">
              <div className="text-center">
                <p className="text-sm text-purple-600 mb-1">SYBAU Balance</p>
                <p className="text-3xl font-bold text-purple-700 mb-1">{tokenBalance}</p>
                <p className="text-xs text-purple-500">
                  ≈ ${(parseFloat(tokenBalance) * 100).toFixed(2)} USD
                </p>
                <div className="mt-2 px-2 py-1 bg-purple-100 rounded-full text-xs text-purple-600">
                  {userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}
                </div>
              </div>
            </div>

            <h3 className="font-semibold mb-3 text-sm">🛍️ Test Store</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleSpendTokens('0.25', 'Basic Theme')}
                disabled={isLoading || parseFloat(tokenBalance) < 0.25}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white font-medium py-2 px-3 rounded-lg transition-colors text-xs"
              >
                🎨 Basic Theme - 0.25 SYBAU
              </button>
              
              <button
                onClick={() => handleSpendTokens('0.5', 'Premium Features')}
                disabled={isLoading || parseFloat(tokenBalance) < 0.5}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white font-medium py-2 px-3 rounded-lg transition-colors text-xs"
              >
                ⚡ Premium Features - 0.5 SYBAU
              </button>
              
              <button
                onClick={() => handleSpendTokens('1.0', 'Advanced Tools')}
                disabled={isLoading || parseFloat(tokenBalance) < 1.0}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white font-medium py-2 px-3 rounded-lg transition-colors text-xs"
              >
                🔧 Advanced Tools - 1.0 SYBAU
              </button>
              
              <button
                onClick={() => handleSpendTokens('2.5', 'VIP Membership')}
                disabled={isLoading || parseFloat(tokenBalance) < 2.5}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white font-medium py-2 px-3 rounded-lg transition-colors text-xs"
              >
                👑 VIP Membership - 2.5 SYBAU
              </button>
            </div>
          </div>

          {/* User-to-User Transfer */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4">🔄 Transfer Tokens</h2>
            <p className="text-gray-600 mb-4 text-sm">
              Send SYBAU tokens to other users
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  placeholder="0x1234...abcd"
                  value={transferAddress}
                  onChange={(e) => setTransferAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Amount (SYBAU)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="1.5"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: {tokenBalance} SYBAU
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Message (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Payment for services"
                  value={transferMessage}
                  onChange={(e) => setTransferMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <button
                onClick={handleTransferTokens}
                disabled={isLoading || !transferAddress || !transferAmount || parseFloat(transferAmount) <= 0}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {isLoading ? 'Transferring...' : '🚀 Send Tokens'}
              </button>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4">📋 Test History</h2>
            
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                No transactions yet.<br/>
                Start by generating some tokens!
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="border border-gray-200 rounded-lg p-3">
                    {tx.type === 'mint' ? (
                      <div className="text-sm">
                        <p className="font-semibold text-green-600">
                          ✅ Received {tx.tokensEarned} SYBAU
                        </p>
                        <p className="text-gray-600">Token mint (reward)</p>
                      </div>
                    ) : tx.type === 'spend' ? (
                      <div className="text-sm">
                        <p className="font-semibold text-orange-600">
                          💸 Spent {tx.amountSpent} SYBAU
                        </p>
                        <p className="text-gray-600">On {tx.itemPurchased}</p>
                      </div>
                    ) : tx.type === 'transfer' ? (
                      <div className="text-sm">
                        <p className="font-semibold text-blue-600">
                          🔄 Sent {tx.amountTransferred} SYBAU
                        </p>
                        <p className="text-gray-600">To {tx.recipient.slice(0, 8)}...{tx.recipient.slice(-6)}</p>
                        {tx.message && (
                          <p className="text-gray-500 text-xs italic">&quot;{tx.message}&quot;</p>
                        )}
                      </div>
                    ) : tx.type === 'receive' ? (
                      <div className="text-sm">
                        <p className="font-semibold text-purple-600">
                          📥 Received {tx.amountReceived} SYBAU
                        </p>
                        <p className="text-gray-600">From {tx.sender.slice(0, 8)}...{tx.sender.slice(-6)}</p>
                        {tx.message && (
                          <p className="text-gray-500 text-xs italic">&quot;{tx.message}&quot;</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm">
                        <p className="font-semibold text-gray-600">
                          🔄 Transaction
                        </p>
                        <p className="text-gray-600">Unknown type: {tx.type}</p>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{tx.timestamp}</p>
                    <p className="text-xs font-mono text-gray-400">
                      <a 
                        href={`https://sepolia.arbiscan.io/tx/${tx.txHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-blue-600"
                      >
                        {tx.txHash.slice(0, 16)}...
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="max-w-6xl mx-auto mt-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">❌ {error}</p>
            </div>
          </div>
        )}

        {/* Test Instructions */}
        <div className="max-w-6xl mx-auto mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-800 mb-3">🔧 Testing Instructions</h3>
            <div className="grid md:grid-cols-2 gap-6 text-blue-700 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Token Generation Test:</h4>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Enter any USD amount (e.g., 150.75)</li>
                  <li>See the preview calculation</li>
                  <li>Click &quot;Generate Tokens&quot;</li>
                  <li>Watch your balance increase</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Token Spending Test:</h4>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Generate some tokens first</li>
                  <li>Try buying different items</li>
                  <li>Watch your balance decrease</li>
                  <li>Check transaction history</li>
                </ol>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-100 rounded">
              <p className="text-blue-800 text-sm">
                <strong>Note:</strong> This connects to Arbitrum Sepolia Testnet blockchain. 
                All transactions are real and visible on Arbiscan.
              </p>
              <p className="text-blue-800 text-xs mt-2">
                <strong>Block Explorer:</strong> <a href="https://sepolia.arbiscan.io/" target="_blank" className="underline">sepolia.arbiscan.io</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}