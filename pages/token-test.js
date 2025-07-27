import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

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

  // Mock contract instance (for demonstration)
  const [mockContract, setMockContract] = useState(null)

  useEffect(() => {
    // Initialize mock contract and check wallet connection
    initializeMockSystem()
  }, [])

  const initializeMockSystem = async () => {
    // Check if wallet is available
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          setUserAddress(accounts[0])
          setWalletConnected(true)
          
          // Initialize mock contract (simulates real contract behavior)
          initializeMockContract()
        }
      } catch (error) {
        console.log('Wallet not connected')
      }
    }
  }

  const initializeMockContract = () => {
    // Mock contract that simulates the real UniteRewardToken behavior
    const mockContract = {
      // Simulate token balance storage (in a real app, this would be on blockchain)
      tokenBalances: JSON.parse(localStorage.getItem('urt_balances') || '{}'),
      
      // Calculate reward tokens for USD amount
      calculateReward: (usdCents) => {
        // Convert cents to wei format, then divide by 100
        const usdWei = BigInt(usdCents) * BigInt('10000000000000000') // 10^16
        const rewardWei = usdWei / BigInt(100)
        return rewardWei.toString()
      },
      
      // Mint tokens for user
      mintRewardForSwapSimple: async (userAddress, usdCents) => {
        const rewardWei = mockContract.calculateReward(usdCents)
        const currentBalance = mockContract.tokenBalances[userAddress] || '0'
        const newBalance = (BigInt(currentBalance) + BigInt(rewardWei)).toString()
        
        mockContract.tokenBalances[userAddress] = newBalance
        localStorage.setItem('urt_balances', JSON.stringify(mockContract.tokenBalances))
        
        // Simulate transaction
        return {
          hash: `0x${Math.random().toString(16).substr(2, 64)}`,
          wait: async () => ({ status: 1 })
        }
      },
      
      // Get balance
      balanceOf: async (userAddress) => {
        return mockContract.tokenBalances[userAddress] || '0'
      },
      
      // Spend tokens
      spendTokens: async (userAddress, amountWei) => {
        const currentBalance = mockContract.tokenBalances[userAddress] || '0'
        if (BigInt(currentBalance) >= BigInt(amountWei)) {
          const newBalance = (BigInt(currentBalance) - BigInt(amountWei)).toString()
          mockContract.tokenBalances[userAddress] = newBalance
          localStorage.setItem('urt_balances', JSON.stringify(mockContract.tokenBalances))
          
          return {
            hash: `0x${Math.random().toString(16).substr(2, 64)}`,
            wait: async () => ({ status: 1 })
          }
        } else {
          throw new Error('Insufficient balance')
        }
      }
    }
    
    setMockContract(mockContract)
    loadTokenBalance(mockContract)
  }

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        setUserAddress(accounts[0])
        setWalletConnected(true)
        initializeMockContract()
        setError('')
      } catch (error) {
        setError('Failed to connect wallet')
      }
    } else {
      setError('Please install MetaMask or another wallet')
    }
  }

  const loadTokenBalance = async (contract = mockContract) => {
    if (!contract || !userAddress) return
    
    try {
      const balanceWei = await contract.balanceOf(userAddress)
      const formattedBalance = ethers.utils.formatEther(balanceWei)
      setTokenBalance(formattedBalance)
    } catch (error) {
      console.error('Failed to load balance:', error)
    }
  }

  const updateRewardPreview = () => {
    if (!swapAmount || !mockContract) {
      setPreviewReward('0')
      return
    }
    
    try {
      const usdCents = Math.round(parseFloat(swapAmount) * 100)
      const rewardWei = mockContract.calculateReward(usdCents)
      const formattedReward = ethers.utils.formatEther(rewardWei)
      setPreviewReward(formattedReward)
    } catch (error) {
      setPreviewReward('0')
    }
  }

  useEffect(() => {
    updateRewardPreview()
  }, [swapAmount, mockContract])

  const handleSimulateSwap = async () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) {
      setError('Please enter a valid swap amount')
      return
    }

    if (!mockContract) {
      setError('Contract not initialized')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const usdCents = Math.round(parseFloat(swapAmount) * 100)
      
      // Execute the mock minting transaction
      const tx = await mockContract.mintRewardForSwapSimple(userAddress, usdCents)
      const receipt = await tx.wait()
      
      // Add to transaction history
      const newTransaction = {
        id: Date.now(),
        type: 'mint',
        usdAmount: swapAmount,
        tokensEarned: previewReward,
        txHash: tx.hash,
        timestamp: new Date().toLocaleString()
      }
      
      setTransactions(prev => [newTransaction, ...prev.slice(0, 4)]) // Keep last 5
      setSwapAmount('')
      await loadTokenBalance()
      
    } catch (error) {
      setError(error.message || 'Transaction failed')
    }

    setIsLoading(false)
  }

  const handleSpendTokens = async (amount, itemName) => {
    if (!mockContract) {
      setError('Contract not initialized')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const amountWei = ethers.utils.parseEther(amount)
      const tx = await mockContract.spendTokens(userAddress, amountWei.toString())
      const receipt = await tx.wait()
      
      // Add to transaction history
      const newTransaction = {
        id: Date.now(),
        type: 'spend',
        amountSpent: amount,
        itemPurchased: itemName,
        txHash: tx.hash,
        timestamp: new Date().toLocaleString()
      }
      
      setTransactions(prev => [newTransaction, ...prev.slice(0, 4)])
      await loadTokenBalance()
      
    } catch (error) {
      setError(error.message || 'Spending failed')
    }

    setIsLoading(false)
  }

  const clearTestData = () => {
    localStorage.removeItem('urt_balances')
    setTokenBalance('0')
    setTransactions([])
    setError('')
    if (mockContract) {
      mockContract.tokenBalances = {}
    }
  }

  if (!walletConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <h1 className="text-3xl font-bold text-center mb-4">🧪 Token Test Lab</h1>
          <p className="text-gray-600 text-center mb-8">
            Isolated testing environment for URT token generation
          </p>
          
          <button
            onClick={connectWallet}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Connect Wallet to Test
          </button>
          
          <div className="mt-6 text-sm text-gray-500">
            <p>This is a mock testing environment.</p>
            <p>No real transactions will be made.</p>
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
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🧪 URT Token Test Lab</h1>
          <p className="text-gray-600">Isolated Token Generation Testing Environment</p>
          <div className="mt-4 flex items-center justify-center space-x-4">
            <span className="text-sm text-gray-500">
              Testing with: {userAddress?.slice(0, 8)}...{userAddress?.slice(-6)}
            </span>
            <button
              onClick={clearTestData}
              className="text-sm text-orange-500 hover:text-orange-700"
            >
              Reset Test Data
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-3">
          {/* Token Generation */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4">💱 Token Generator</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Test the token reward calculation<br/>
              <span className="font-semibold text-purple-600">Rate: $100 USD = 1.0 URT</span>
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
                    Will generate: <span className="font-bold">{previewReward} URT</span>
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
            <h2 className="text-xl font-bold mb-4">💰 Your Balance</h2>
            
            <div className="bg-purple-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-purple-600">Current URT Balance</p>
              <p className="text-3xl font-bold text-purple-700">{tokenBalance}</p>
              <p className="text-xs text-purple-500 mt-1">
                Equivalent to ${(parseFloat(tokenBalance) * 100).toFixed(2)} in swaps
              </p>
            </div>

            <h3 className="font-semibold mb-4">🛍️ Test Store</h3>
            <div className="space-y-3">
              <button
                onClick={() => handleSpendTokens('0.25', 'Basic Theme')}
                disabled={isLoading || parseFloat(tokenBalance) < 0.25}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                🎨 Basic Theme - 0.25 URT
              </button>
              
              <button
                onClick={() => handleSpendTokens('0.5', 'Premium Features')}
                disabled={isLoading || parseFloat(tokenBalance) < 0.5}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                ⚡ Premium Features - 0.5 URT
              </button>
              
              <button
                onClick={() => handleSpendTokens('1.0', 'Advanced Tools')}
                disabled={isLoading || parseFloat(tokenBalance) < 1.0}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                🔧 Advanced Tools - 1.0 URT
              </button>
              
              <button
                onClick={() => handleSpendTokens('2.5', 'VIP Membership')}
                disabled={isLoading || parseFloat(tokenBalance) < 2.5}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                👑 VIP Membership - 2.5 URT
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
                          ✅ Generated {tx.tokensEarned} URT
                        </p>
                        <p className="text-gray-600">From ${tx.usdAmount} swap</p>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <p className="font-semibold text-orange-600">
                          💸 Spent {tx.amountSpent} URT
                        </p>
                        <p className="text-gray-600">On {tx.itemPurchased}</p>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{tx.timestamp}</p>
                    <p className="text-xs font-mono text-gray-400">
                      {tx.txHash.slice(0, 16)}...
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
                  <li>Click "Generate Tokens"</li>
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
                <strong>Note:</strong> This is a mock environment using localStorage. 
                All transactions are simulated and no real blockchain interaction occurs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}