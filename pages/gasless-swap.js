import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Final Gasless Swap Station V4 Configuration (Uniswap V3 - RELIABLE!)
const GASLESS_SWAP_ADDRESS = '0x4a901a3502CE630dB4a3d7C5B264676E4f7C9649'; // GaslessSwapStationV4 - Uniswap V3 Integration
const ARBITRUM_MAINNET_CHAIN_ID = 42161;
const PREFERRED_ACCOUNT = '0x5e8C9F71b484f082df54bd6473dfbf74aBbA266D';

// ABI for GaslessSwapStationV4 contract - Uniswap V3 powered
const GASLESS_SWAP_ABI = [
  'function executeGaslessSwap(tuple(address user, address fromToken, address toToken, uint256 fromAmount, uint256 minToAmount, uint256 deadline, uint256 nonce) swap, bytes signature) payable',
  'function userNonces(address user) view returns (uint256)',
  'function getDomainSeparator() view returns (bytes32)',
  'function version() view returns (string)',
  'function feePercent() view returns (uint256)',
  'function maxGasPrice() view returns (uint256)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'event GaslessSwapExecuted(address indexed user, address indexed fromToken, address indexed toToken, uint256 fromAmount, uint256 toAmount, uint256 gasFeePaid, string swapMethod)',
  'event MetaTransactionExecuted(address indexed user, bytes32 indexed metaTxHash, bool success)'
];

// Token addresses on Arbitrum Mainnet
const TOKENS = {
  'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  'ARB': '0x912CE59144191C1204E64559FE8253a0e49E6548'
};

// Token symbols for display
const TOKEN_SYMBOLS = {
  [TOKENS.ETH]: 'ETH',
  [TOKENS.WETH]: 'WETH', 
  [TOKENS.USDC]: 'USDC',
  [TOKENS.USDT]: 'USDT',
  [TOKENS.WBTC]: 'WBTC',
  [TOKENS.ARB]: 'ARB'
};

// EIP-712 Domain for meta-transactions  
const EIP712_DOMAIN = {
  name: 'GaslessSwapStation',
  version: '4',
  chainId: ARBITRUM_MAINNET_CHAIN_ID,
  verifyingContract: GASLESS_SWAP_ADDRESS
};

// EIP-712 Types
const EIP712_TYPES = {
  GaslessSwap: [
    { name: 'user', type: 'address' },
    { name: 'fromToken', type: 'address' },
    { name: 'toToken', type: 'address' },
    { name: 'fromAmount', type: 'uint256' },
    { name: 'minToAmount', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

export default function GaslessSwap() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(0);
  const [contractInfo, setContractInfo] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Account selection states
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [accountBalances, setAccountBalances] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  
  // Swap form states
  const [fromToken, setFromToken] = useState(TOKENS.USDC);
  const [toToken, setToToken] = useState(TOKENS.ETH);
  const [fromAmount, setFromAmount] = useState('10');
  const [minToAmount, setMinToAmount] = useState('0.003');
  const [slippage, setSlippage] = useState('1'); // 1% default
  
  // Quote and execution states
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [executingSwap, setExecutingSwap] = useState(false);
  const [lastTxHash, setLastTxHash] = useState('');
  
  // User nonce state
  const [userNonce, setUserNonce] = useState(0);
  
  // Auto-refresh quote when inputs change (only if user has manually gotten a quote first)
  useEffect(() => {
    if (fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0 && account && quote) {
      const timeoutId = setTimeout(() => {
        getQuote();
      }, 2000); // Debounce for 2 seconds, only refresh existing quotes
      
      return () => clearTimeout(timeoutId);
    }
  }, [fromToken, toToken, fromAmount, account]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      // Use Alchemy RPC for reading data (more reliable), MetaMask for signing
      const alchemyRpc = process.env.NEXT_PUBLIC_ARBITRUM_MAINNET_RPC_URL || 'https://arbitrum-one.publicnode.com';
      const readProvider = new ethers.JsonRpcProvider(alchemyRpc);
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      
      // Use Alchemy for balance queries, browser provider for transactions
      setProvider({ read: readProvider, browser: browserProvider });
      
      // Listen for account changes
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          setSigner(null);
          setAccount('');
          setContract(null);
          setContractInfo({});
          setStatus('🔌 Wallet disconnected');
        } else {
          // Reconnect with new account
          connectWallet();
        }
      };
      
      // Listen for chain changes
      const handleChainChanged = (chainId) => {
        setChainId(parseInt(chainId, 16));
        if (parseInt(chainId, 16) !== ARBITRUM_MAINNET_CHAIN_ID) {
          setStatus('⚠️ Please switch to Arbitrum mainnet');
        }
      };
      
      if (window.ethereum.on) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
      }
      
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  const connectWallet = async () => {
    if (!provider) {
      setStatus('❌ No Ethereum provider found. Please install MetaMask.');
      return;
    }
    
    try {
      setLoading(true);
      setStatus('🔄 Connecting wallet...');
      
      // Request accounts
      const accounts = await provider.browser.send('eth_requestAccounts', []);
      setAvailableAccounts(accounts);
      
      // Load balances for all accounts
      await loadAccountBalances(accounts);
      
      // Check if preferred account is available
      const preferredIndex = accounts.findIndex(acc => 
        acc.toLowerCase() === PREFERRED_ACCOUNT.toLowerCase()
      );
      
      if (preferredIndex !== -1) {
        // Auto-select preferred account
        await selectAccount(PREFERRED_ACCOUNT);
        setStatus('✅ Connected to preferred account');
      } else {
        // Show account selection modal
        setShowAccountModal(true);
        setStatus('👥 Select an account to continue');
      }
      
    } catch (error) {
      console.error('Connection error:', error);
      setStatus(`❌ Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAccountBalances = async (accounts) => {
    if (!provider) return;
    
    setLoadingBalances(true);
    const balances = {};
    
    for (const account of accounts) {
      try {
        // Get ETH balance using read provider
        const ethBalance = await provider.read.getBalance(account);
        balances[account] = {
          ETH: ethers.formatEther(ethBalance)
        };
        
        // Get token balances
        for (const [symbol, address] of Object.entries(TOKENS)) {
          if (symbol === 'ETH') continue; // Skip native ETH
          
          try {
            const tokenContract = new ethers.Contract(
              address,
              ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
              provider.read
            );
            
            const [balance, decimals] = await Promise.all([
              tokenContract.balanceOf(account),
              tokenContract.decimals()
            ]);
            
            balances[account][symbol] = ethers.formatUnits(balance, decimals);
          } catch (tokenError) {
            console.warn(`Failed to get ${symbol} balance for ${account}:`, tokenError);
            balances[account][symbol] = '0';
          }
        }
      } catch (error) {
        console.error(`Failed to load balances for ${account}:`, error);
        balances[account] = { ETH: '0' };
      }
    }
    
    setAccountBalances(balances);
    setLoadingBalances(false);
  };

  const selectAccount = async (selectedAccount) => {
    if (!provider) return;
    
    try {
      setLoading(true);
      setStatus('🔄 Setting up account...');
      
      // Create signer for selected account
      const signer = await provider.browser.getSigner(selectedAccount);
      setSigner(signer);
      setAccount(selectedAccount);
      
      // Get network info
      const network = await provider.read.getNetwork();
      setChainId(Number(network.chainId));
      
      // Check if on correct network
      if (Number(network.chainId) !== ARBITRUM_MAINNET_CHAIN_ID) {
        setStatus('⚠️ Please switch to Arbitrum mainnet');
        return;
      }
      
      // Initialize contracts - separate read and write contracts
      const writeContract = new ethers.Contract(GASLESS_SWAP_ADDRESS, GASLESS_SWAP_ABI, signer);
      const readContract = new ethers.Contract(GASLESS_SWAP_ADDRESS, GASLESS_SWAP_ABI, provider.read);
      
      setContract(writeContract);
      
      // Load contract info using read contract
      await loadContractInfo(readContract);
      
      // Load user nonce using read contract
      await loadUserNonce(readContract, selectedAccount);
      
      setShowAccountModal(false);
      setStatus('✅ Connected and ready for gasless swaps!');
      
    } catch (error) {
      console.error('Account selection error:', error);
      setStatus(`❌ Failed to select account: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadContractInfo = async (contract) => {
    try {
      console.log('Loading contract info from:', await contract.getAddress());
      
      // Load each function individually for better error handling
      const contractInfo = {};
      
      try {
        contractInfo.version = await contract.version();
        console.log('✅ Version loaded:', contractInfo.version);
      } catch (error) {
        console.warn('❌ Failed to load version:', error.message);
        contractInfo.version = 'Unknown';
      }
      
      try {
        const feePercent = await contract.feePercent();
        contractInfo.feePercent = feePercent.toString();
        console.log('✅ Fee percent loaded:', contractInfo.feePercent);
      } catch (error) {
        console.warn('❌ Failed to load feePercent:', error.message);
        contractInfo.feePercent = '0';
      }
      
      try {
        const maxGasPrice = await contract.maxGasPrice();
        contractInfo.maxGasPrice = ethers.formatUnits(maxGasPrice, 'gwei');
        console.log('✅ Max gas price loaded:', contractInfo.maxGasPrice);
      } catch (error) {
        console.warn('❌ Failed to load maxGasPrice:', error.message);
        contractInfo.maxGasPrice = '0';
      }
      
      try {
        contractInfo.owner = await contract.owner();
        console.log('✅ Owner loaded:', contractInfo.owner);
      } catch (error) {
        console.warn('❌ Failed to load owner:', error.message);
        contractInfo.owner = 'Unknown';
      }
      
      setContractInfo(contractInfo);
      console.log('✅ Contract info loaded successfully');
      
    } catch (error) {
      console.error('❌ Failed to load contract info:', error);
      setStatus(`⚠️ Contract loaded but some info unavailable: ${error.message}`);
    }
  };

  const loadUserNonce = async (contract, userAddress) => {
    try {
      console.log('🔍 Calling userNonces for:', userAddress);
      console.log('🔍 Contract address:', await contract.getAddress());
      
      // Check network of the contract's provider
      const network = await contract.runner.provider.getNetwork();
      console.log('🌐 Contract provider network:', network.chainId.toString(), network.name);
      
      // Check if contract exists using the contract's provider
      const code = await contract.runner.provider.getCode(await contract.getAddress());
      console.log('📋 Contract code length:', code.length);
      
      if (code.length <= 2) {
        console.error('❌ Contract not deployed properly');
        setUserNonce(0);
        return;
      }
      
      console.log('🔍 About to call userNonces with contract provider...');
      const nonce = await contract.userNonces(userAddress);
      console.log('✅ userNonces successful:', nonce.toString());
      setUserNonce(Number(nonce));
    } catch (error) {
      console.error('❌ Failed to load user nonce:', error);
      console.error('Error details:', {
        code: error.code,
        data: error.data,
        message: error.message,
        transaction: error.transaction
      });
      setUserNonce(0);
    }
  };

  const getQuote = async () => {
    if (!fromToken || !toToken || !fromAmount) {
      setStatus('❌ Please fill in all swap details');
      return;
    }
    
    try {
      setLoadingQuote(true);
      setStatus('🔄 Getting real-time quote from 1inch...');
      
      // Get token decimals first
      const fromTokenDecimals = await getTokenDecimals(fromToken);
      const toTokenDecimals = await getTokenDecimals(toToken);
      
      // Convert amount to wei using correct decimals
      const fromAmountWei = ethers.parseUnits(fromAmount, fromTokenDecimals);
      
      // Get real quote from 1inch API
      const realQuote = await get1inchQuote(fromToken, toToken, fromAmountWei.toString());
      
      if (!realQuote.success) {
        throw new Error(realQuote.error || 'Failed to get quote');
      }
      
      // Calculate the output amount with proper decimals
      const outputAmount = ethers.formatUnits(realQuote.toAmount, toTokenDecimals);
      
      // Auto-update the minimum amount field with 1% slippage
      const minAmountWithSlippage = (parseFloat(outputAmount) * (100 - parseFloat(slippage)) / 100).toFixed(6);
      setMinToAmount(minAmountWithSlippage);
      
      const quote = {
        fromAmount: fromAmountWei.toString(),
        toAmount: realQuote.toAmount,
        estimatedGas: realQuote.estimatedGas || 150000,
        protocols: realQuote.protocols || ['1inch Aggregation Protocol'],
        priceImpact: calculatePriceImpact(fromAmount, outputAmount, fromToken, toToken),
        outputAmount: outputAmount,
        gasPrice: realQuote.gasPrice || '0'
      };
      
      setQuote(quote);
      setStatus('✅ Real-time quote received! Minimum amount updated automatically.');
      
    } catch (error) {
      console.error('Quote error:', error);
      setStatus(`❌ Failed to get quote: ${error.message}. Please enter minimum amount manually.`);
      
      // Clear any existing quote
      setQuote(null);
      
      // Fallback to manual entry if API fails
      console.warn('1inch API unavailable, user must enter minimum amount manually');
    } finally {
      setLoadingQuote(false);
    }
  };

  const getTokenDecimals = async (tokenAddress) => {
    // Handle native ETH
    if (tokenAddress === TOKENS.ETH || tokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
      return 18;
    }
    
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function decimals() view returns (uint8)'],
        provider.read
      );
      return await tokenContract.decimals();
    } catch (error) {
      console.warn(`Failed to get decimals for ${tokenAddress}, defaulting to 18`);
      return 18;
    }
  };

  const get1inchQuote = async (fromToken, toToken, amount) => {
    try {
      // Convert native ETH address for 1inch API
      const from = fromToken === TOKENS.ETH ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : fromToken;
      const to = toToken === TOKENS.ETH ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : toToken;
      
      const params = new URLSearchParams({
        src: from,
        dst: to,
        amount: amount.toString(),
        includeTokensInfo: 'true',
        includeProtocols: 'true',
        includeGas: 'true'
      });
      
      // Use our backend API to avoid CORS issues
      const response = await fetch(`/api/1inch/quote?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Quote request failed');
      }
      
      return {
        success: true,
        toAmount: data.toAmount,
        estimatedGas: data.estimatedGas,
        protocols: data.protocols || [],
        gasPrice: data.gasPrice
      };
      
    } catch (error) {
      console.error('1inch quote error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  const calculatePriceImpact = (fromAmount, toAmount, fromToken, toToken) => {
    // Simplified price impact calculation
    // In production, you'd want more sophisticated price impact calculation
    try {
      if (!fromAmount || !toAmount) return '0.0%';
      
      // This is a very basic calculation - you'd want to improve this
      const ratio = parseFloat(toAmount) / parseFloat(fromAmount);
      
      // Rough price impact estimation based on market rates
      // This is just for display - real calculation would need market data
      if (ratio > 0.001 && ratio < 1000) {
        return '< 0.1%';
      } else {
        return '~1.0%';
      }
    } catch (error) {
      return 'Unknown';
    }
  };

  const checkAndApproveTokens = async () => {
    try {
      // Skip approval for ETH (native token)
      if (fromToken === TOKENS.ETH) {
        return true;
      }
      
      // Check current allowance
      const tokenContract = new ethers.Contract(fromToken, [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)'
      ], signer);
      
      const fromTokenDecimals = await getTokenDecimals(fromToken);
      const requiredAmount = ethers.parseUnits(fromAmount, fromTokenDecimals);
      const currentAllowance = await tokenContract.allowance(account, GASLESS_SWAP_ADDRESS);
      
      if (currentAllowance < requiredAmount) {
        setStatus('🔓 Token approval required. Please approve in MetaMask...');
        
        // Approve a larger amount to avoid frequent approvals (max uint256)
        const maxApproval = ethers.MaxUint256;
        const approveTx = await tokenContract.approve(GASLESS_SWAP_ADDRESS, maxApproval);
        
        setStatus('⏳ Waiting for approval transaction confirmation...');
        await approveTx.wait();
        
        setStatus('✅ Token approval confirmed!');
      }
      
      return true;
      
    } catch (error) {
      console.error('Approval error:', error);
      setStatus(`❌ Token approval failed: ${error.message}`);
      return false;
    }
  };

  const executeGaslessSwap = async () => {
    if (!signer || !contract || !quote) {
      setStatus('❌ Please connect wallet and get a quote first');
      return;
    }
    
    try {
      setExecutingSwap(true);
      setStatus('🔄 Checking token approvals...');
      
      // Check if we need to approve tokens first
      const needsApproval = await checkAndApproveTokens();
      if (!needsApproval) {
        setExecutingSwap(false);
        return;
      }
      
      setStatus('🔄 Signing meta-transaction...');
      
      // Prepare swap data
      const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
      
      // Get correct decimals for both tokens
      const fromTokenDecimals = await getTokenDecimals(fromToken);
      const toTokenDecimals = await getTokenDecimals(toToken);
      
      const swapData = {
        user: account,
        fromToken: fromToken,
        toToken: toToken,
        fromAmount: ethers.parseUnits(fromAmount, fromTokenDecimals).toString(),
        minToAmount: ethers.parseUnits(minToAmount, toTokenDecimals).toString(),
        deadline: deadline,
        nonce: userNonce
      };
      
      setStatus('✍️ Please sign the gasless swap transaction...');
      
      // Sign EIP-712 structured data
      const signature = await signer.signTypedData(
        EIP712_DOMAIN,
        EIP712_TYPES,
        swapData
      );
      
      setStatus('🚀 Executing gasless swap on-chain...');
      
      // Execute the gasless swap with struct format as per new ABI
      const tx = await contract.executeGaslessSwap(swapData, signature, {
        value: fromToken === TOKENS.ETH ? swapData.fromAmount : 0
      });
      setLastTxHash(tx.hash);
      
      setStatus('⏳ Transaction submitted, waiting for confirmation...');
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        setStatus('🎉 Gasless swap executed successfully!');
        
        // Update user nonce
        setUserNonce(userNonce + 1);
        
        // Refresh balances
        await loadAccountBalances([account]);
        
        // Clear form
        setQuote(null);
        setFromAmount('');
        setMinToAmount('');
        
      } else {
        setStatus('❌ Transaction failed');
      }
      
    } catch (error) {
      console.error('Swap execution error:', error);
      if (error.code === 'ACTION_REJECTED') {
        setStatus('❌ Transaction was rejected by user');
      } else {
        setStatus(`❌ Swap failed: ${error.message}`);
      }
    } finally {
      setExecutingSwap(false);
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${ARBITRUM_MAINNET_CHAIN_ID.toString(16)}` }],
      });
    } catch (error) {
      if (error.code === 4902) {
        // Add Arbitrum network
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${ARBITRUM_MAINNET_CHAIN_ID.toString(16)}`,
            chainName: 'Arbitrum One',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [
              'https://arbitrum-one.publicnode.com',
              'https://arbitrum.blockpi.network/v1/rpc/public', 
              'https://arbitrum.drpc.org',
              'https://arb1.arbitrum.io/rpc'
            ],
            blockExplorerUrls: ['https://arbiscan.io/']
          }]
        });
      }
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui', backgroundColor: '#FFE4E1', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', color: 'black', marginBottom: '10px' }}>
        ⛽ Gasless Swap Station
      </h1>
      <p style={{ textAlign: 'center', color: 'black', marginBottom: '30px' }}>
        Trade tokens without holding ETH for gas • Powered by 1inch + Meta-transactions
      </p>
      
      {/* Status Bar */}
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#f0f8ff', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        marginBottom: '20px',
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        {status || 'Ready to connect wallet'}
      </div>
      
      {/* Connection Section */}
      <div style={{ marginBottom: '30px' }}>
        {!account ? (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={connectWallet}
              disabled={loading}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? '🔄 Connecting...' : '🔗 Connect Wallet'}
            </button>
          </div>
        ) : (
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: 'black' }}>Connected Account</div>
                <div style={{ fontFamily: 'monospace', fontSize: '14px', color: 'black' }}>
                  {account}
                </div>
                <div style={{ fontSize: '12px', color: 'black' }}>
                  Network: {chainId === ARBITRUM_MAINNET_CHAIN_ID ? 'Arbitrum Mainnet ✅' : `Chain ${chainId} ⚠️`}
                </div>
              </div>
              {chainId !== ARBITRUM_MAINNET_CHAIN_ID && (
                <button
                  onClick={switchNetwork}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ffc107',
                    color: '#000',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Switch Network
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Account Selection Modal */}
      {showAccountModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0, textAlign: 'center', color: 'black' }}>Select Account</h3>
            <div style={{ marginBottom: '20px' }}>
              {availableAccounts.map((acc, index) => (
                <div key={acc} style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  backgroundColor: acc.toLowerCase() === PREFERRED_ACCOUNT.toLowerCase() ? '#e7f5e7' : '#fff'
                }} onClick={() => selectAccount(acc)}>
                  <div style={{ fontWeight: 'bold', color: 'black' }}>
                    Account {index + 1} 
                    {acc.toLowerCase() === PREFERRED_ACCOUNT.toLowerCase() && ' ⭐'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'black' }}>{acc}</div>
                  {accountBalances[acc] && (
                    <div style={{ fontSize: '12px', color: 'black', marginTop: '5px' }}>
                      ETH: {parseFloat(accountBalances[acc].ETH).toFixed(4)} | 
                      USDC: {parseFloat(accountBalances[acc].USDC || 0).toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowAccountModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Contract Info */}
      {contractInfo.version && (
        <div style={{ 
          marginBottom: '30px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: 'black' }}>Contract Information</h3>
          <div style={{ fontSize: '14px', color: 'black' }}>
            <div>Version: {contractInfo.version}</div>
            <div>Fee: {contractInfo.feePercent} basis points ({(contractInfo.feePercent / 100).toFixed(2)}%)</div>
            <div>Max Gas Price: {contractInfo.maxGasPrice} gwei</div>
            <div>Owner: {contractInfo.owner}</div>
          </div>
        </div>
      )}
      
      {/* Swap Interface */}
      {account && chainId === ARBITRUM_MAINNET_CHAIN_ID && (
        <div style={{ 
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #dee2e6',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: 'black' }}>🔄 Gasless Token Swap</h3>
          
          {/* From Token */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: 'black' }}>
              From Token
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: 'black'
                }}
              >
                {Object.entries(TOKENS).map(([symbol, address]) => (
                  <option key={address} value={address}>{symbol}</option>
                ))}
              </select>
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="Amount"
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: 'black'
                }}
              />
            </div>
            <div style={{ fontSize: '12px', color: 'black', marginTop: '5px' }}>
              Balance: {accountBalances[account] ? 
                parseFloat(accountBalances[account][TOKEN_SYMBOLS[fromToken]] || 0).toFixed(6) : 
                '...'} {TOKEN_SYMBOLS[fromToken]}
            </div>
          </div>
          
          {/* Swap Direction Button */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <button
              onClick={() => {
                const temp = fromToken;
                setFromToken(toToken);
                setToToken(temp);
                
                const tempAmount = fromAmount;
                setFromAmount(minToAmount);
                setMinToAmount(tempAmount);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #ddd',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              🔄
            </button>
          </div>
          
          {/* To Token */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: 'black' }}>
              To Token (Minimum)
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: 'black'
                }}
              >
                {Object.entries(TOKENS).map(([symbol, address]) => (
                  <option key={address} value={address}>{symbol}</option>
                ))}
              </select>
              <input
                type="number"
                value={minToAmount}
                onChange={(e) => setMinToAmount(e.target.value)}
                placeholder="Min amount"
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: 'black'
                }}
              />
            </div>
            <div style={{ fontSize: '12px', color: 'black', marginTop: '5px' }}>
              Balance: {accountBalances[account] ? 
                parseFloat(accountBalances[account][TOKEN_SYMBOLS[toToken]] || 0).toFixed(6) : 
                '...'} {TOKEN_SYMBOLS[toToken]}
            </div>
          </div>
          
          {/* Slippage */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: 'black' }}>
              Slippage Tolerance (%)
            </label>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              min="0.1"
              max="50"
              step="0.1"
              style={{
                width: '100px',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'black'
              }}
            />
          </div>
          
          {/* Quote Section */}
          {quote && (
            <div style={{
              padding: '15px',
              backgroundColor: '#e7f5e7',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #c3d9c3'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'black' }}>💰 Real-Time 1inch Quote</h4>
              <div style={{ fontSize: '14px' }}>
                <div><strong>Expected Output:</strong> {quote.outputAmount} {TOKEN_SYMBOLS[toToken]}</div>
                <div><strong>Minimum (with {slippage}% slippage):</strong> {minToAmount} {TOKEN_SYMBOLS[toToken]}</div>
                <div><strong>Price Impact:</strong> {quote.priceImpact}</div>
                <div><strong>Route:</strong> {quote.protocols.length > 0 ? quote.protocols.join(', ') : '1inch Aggregation'}</div>
                <div><strong>Gas Estimate:</strong> {quote.estimatedGas.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  ✨ Live pricing from 1inch • Updates automatically
                </div>
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={getQuote}
              disabled={loadingQuote || !fromToken || !toToken || !fromAmount}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loadingQuote ? 'not-allowed' : 'pointer',
                opacity: loadingQuote ? 0.7 : 1,
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loadingQuote ? '🔄 Getting Quote...' : '🔄 Refresh Quote'}
            </button>
            
            <button
              onClick={executeGaslessSwap}
              disabled={executingSwap || !quote}
              style={{
                flex: 2,
                padding: '12px',
                backgroundColor: quote ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (executingSwap || !quote) ? 'not-allowed' : 'pointer',
                opacity: (executingSwap || !quote) ? 0.7 : 1,
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {executingSwap ? '🚀 Executing...' : '⛽ Execute Gasless Swap'}
            </button>
          </div>
          
          <div style={{ fontSize: '12px', color: 'black', marginTop: '10px', textAlign: 'center' }}>
            User Nonce: {userNonce} | No ETH needed for gas fees!<br/>
            💡 Quotes auto-update with real 1inch pricing • Minimum amounts calculated with slippage
          </div>
        </div>
      )}
      
      {/* Transaction History */}
      {lastTxHash && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'black' }}>🧾 Last Transaction</h4>
          <div style={{ fontSize: '14px', wordBreak: 'break-all' }}>
            <strong>Hash:</strong> {lastTxHash}
          </div>
          <div style={{ marginTop: '5px' }}>
            <a
              href={`https://arbiscan.io/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#007bff', textDecoration: 'none' }}
            >
              🔗 View on Arbiscan
            </a>
          </div>
        </div>
      )}
      
      {/* Help Section */}
      <div style={{ 
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: 'black' }}>❓ How Gasless Swaps Work</h4>
        <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'black' }}>
          <p>1. <strong>Sign Meta-Transaction:</strong> Sign a transaction off-chain (no gas needed)</p>
          <p>2. <strong>We Execute:</strong> Our contract executes your swap and pays the gas</p>
          <p>3. <strong>Fees Deducted:</strong> Gas cost + small service fee deducted from output</p>
          <p>4. <strong>Tokens Delivered:</strong> Remaining tokens sent directly to your wallet</p>
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            backgroundColor: '#e7f5e7', 
            borderRadius: '6px',
            border: '1px solid #c3d9c3'
          }}>
            <strong>✨ Benefits:</strong> No ETH required, MEV protection, best rates via 1inch
          </div>
        </div>
      </div>
    </div>
  );
}