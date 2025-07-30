import { useState, useEffect } from 'react';

export default function Wallet() {
  const [wallets, setWallets] = useState([]);
  const [activeWallet, setActiveWallet] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [editingWallet, setEditingWallet] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);
  
  // New state for additional features
  const [showMnemonic, setShowMnemonic] = useState(null);
  const [showAddresses, setShowAddresses] = useState(null);
  const [showTokens, setShowTokens] = useState(null);
  const [walletTokens, setWalletTokens] = useState(null);
  const [loadingTokens, setLoadingTokens] = useState(false);
  
  // Private key import state
  const [privateKey, setPrivateKey] = useState('');
  const [keyType, setKeyType] = useState('evm');

  useEffect(() => {
    loadWallets();
  }, []);

  // Auto-refresh portfolio when active wallet changes
  useEffect(() => {
    if (activeWallet) {
      // Initial load
      loadPortfolio(activeWallet.walletId, activeWallet.password);
      
      // Set up auto-refresh every 30 seconds
      const interval = setInterval(() => {
        loadPortfolio(activeWallet.walletId, activeWallet.password);
      }, 30000);
      
      setRefreshInterval(interval);
      
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [activeWallet]);

  const loadWallets = async () => {
    try {
      const response = await fetch('/api/wallet/list');
      const data = await response.json();
      if (data.success) {
        setWallets(data.wallets);
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
    }
  };

  const createWallet = async () => {
    if (!password || password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    const username = prompt('Enter a username for this wallet (optional):') || '';

    setLoading(true);
    try {
      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();
      if (data.success) {
        // Update wallet with username if provided
        if (username) {
          await updateWalletMetadata(data.walletId, { username });
        }
        
        alert(`Wallet created! Save this mnemonic: ${data.mnemonic}`);
        setPassword('');
        loadWallets();
      } else {
        alert('Failed to create wallet: ' + data.error);
      }
    } catch (error) {
      alert('Error creating wallet: ' + error.message);
    }
    setLoading(false);
  };

  const importWallet = async () => {
    if (!password || !mnemonic) {
      alert('Password and mnemonic are required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/wallet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, mnemonic })
      });

      const data = await response.json();
      if (data.success) {
        alert('Wallet imported successfully!');
        setPassword('');
        setMnemonic('');
        loadWallets();
      } else {
        if (response.status === 409) {
          // Wallet already exists
          alert(`Cannot import wallet: ${data.error}\n\nExisting wallet created: ${new Date(data.existingWallet.createdAt).toLocaleString()}`);
        } else {
          alert('Failed to import wallet: ' + data.error);
        }
      }
    } catch (error) {
      alert('Error importing wallet: ' + error.message);
    }
    setLoading(false);
  };

  const importWalletFromPrivateKey = async () => {
    if (!password || !privateKey) {
      alert('Password and private key are required');
      return;
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    const username = prompt('Enter a username for this wallet (optional):') || '';

    setLoading(true);
    try {
      const response = await fetch('/api/wallet/import-private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          privateKey, 
          password, 
          keyType,
          metadata: { username }
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Wallet imported successfully from ${keyType.toUpperCase()} private key!\n\nEVM Address: ${data.addresses.evm}\nTezos Address: ${data.addresses.tezos}\n\nNote: ${data.note}`);
        setPassword('');
        setPrivateKey('');
        loadWallets();
      } else {
        if (response.status === 409) {
          // Wallet already exists
          alert(`Cannot import wallet: ${data.error}\n\nExisting wallet created: ${new Date(data.existingWallet.createdAt).toLocaleString()}`);
        } else {
          alert('Failed to import wallet: ' + data.error);
        }
      }
    } catch (error) {
      alert('Error importing wallet: ' + error.message);
    }
    setLoading(false);
  };

  const unlockWallet = async (walletId) => {
    const walletPassword = prompt('Enter wallet password:');
    if (!walletPassword) return;

    setLoading(true);
    try {
      const response = await fetch('/api/wallet/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, password: walletPassword })
      });

      const data = await response.json();
      if (data.success) {
        const walletData = { ...data, password: walletPassword };
        setActiveWallet(walletData);
        // Save to localStorage for NFT page access
        localStorage.setItem('activeWallet', JSON.stringify(walletData));
        loadPortfolio(walletId, walletPassword);
      } else {
        alert('Failed to unlock wallet: ' + data.error);
      }
    } catch (error) {
      alert('Error unlocking wallet: ' + error.message);
    }
    setLoading(false);
  };

  const loadPortfolio = async (walletId, walletPassword) => {
    try {
      const response = await fetch(`/api/portfolio/${walletId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: walletPassword })
      });

      const data = await response.json();
      if (data.success) {
        setPortfolio(data.portfolio);
      }
    } catch (error) {
      console.error('Failed to load portfolio:', error);
    }
  };

  const sendTransaction = async () => {
    if (!activeWallet) {
      alert('Please unlock a wallet first');
      return;
    }

    const blockchain = prompt('Enter blockchain (evm/tezos):');
    const network = prompt('Enter network (ethereum/sepolia/bsc/polygon/arbitrumSepolia/mainnet/ghostnet):');
    const to = prompt('Enter recipient address:');
    const amount = prompt('Enter amount:');

    if (!blockchain || !network || !to || !amount) return;

    setLoading(true);
    try {
      const response = await fetch('/api/transaction/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: activeWallet.walletId,
          password: activeWallet.password,
          blockchain,
          network,
          to,
          amount
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Transaction sent! Hash: ${data.transaction.hash}`);
        loadPortfolio(activeWallet.walletId, activeWallet.password);
      } else {
        alert('Transaction failed: ' + data.error);
      }
    } catch (error) {
      alert('Error sending transaction: ' + error.message);
    }
    setLoading(false);
  };

  const updateWalletMetadata = async (walletId, metadata) => {
    try {
      const response = await fetch('/api/wallet/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, metadata })
      });

      const data = await response.json();
      if (data.success) {
        loadWallets();
        return true;
      } else {
        alert('Failed to update wallet: ' + data.error);
        return false;
      }
    } catch (error) {
      alert('Error updating wallet: ' + error.message);
      return false;
    }
  };

  const deleteWallet = async (walletId) => {
    if (!confirm('Are you sure you want to delete this wallet? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/wallet/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId })
      });

      const data = await response.json();
      if (data.success) {
        alert('Wallet deleted successfully');
        loadWallets();
        if (activeWallet && activeWallet.walletId === walletId) {
          setActiveWallet(null);
          setPortfolio(null);
        }
      } else {
        alert('Failed to delete wallet: ' + data.error);
      }
    } catch (error) {
      alert('Error deleting wallet: ' + error.message);
    }
    setLoading(false);
  };

  const startEditWallet = (wallet) => {
    setEditingWallet(wallet);
    setEditUsername(wallet.metadata.username || '');
    setEditLabel(wallet.metadata.label || '');
  };

  const saveWalletEdit = async () => {
    if (!editingWallet) return;

    const success = await updateWalletMetadata(editingWallet.id, {
      username: editUsername,
      label: editLabel
    });

    if (success) {
      setEditingWallet(null);
      setEditUsername('');
      setEditLabel('');
    }
  };

  const cancelWalletEdit = () => {
    setEditingWallet(null);
    setEditUsername('');
    setEditLabel('');
  };

  const viewPrivateKey = async (walletId) => {
    const walletPassword = prompt('Enter wallet password to view private key:');
    if (!walletPassword) return;

    setLoading(true);
    try {
      const response = await fetch('/api/wallet/private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, password: walletPassword })
      });

      const data = await response.json();
      if (data.success) {
        setShowPrivateKey({
          walletId,
          evmPrivateKey: data.privateKeys.evm,
          tezosPrivateKey: data.privateKeys.tezos
        });
      } else {
        alert('Failed to retrieve private keys: ' + data.error);
      }
    } catch (error) {
      alert('Error viewing private key: ' + error.message);
    }
    setLoading(false);
  };

  const hidePrivateKey = () => {
    setShowPrivateKey(null);
  };

  // New functions for additional features
  const viewMnemonic = async (walletId) => {
    const walletPassword = prompt('Enter wallet password to view mnemonic phrase:');
    if (!walletPassword) return;

    setLoading(true);
    try {
      const response = await fetch('/api/wallet/mnemonic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, password: walletPassword })
      });

      const data = await response.json();
      if (data.success) {
        setShowMnemonic({
          walletId,
          mnemonic: data.mnemonic,
          warning: data.warning
        });
      } else {
        alert('Failed to retrieve mnemonic: ' + data.error);
      }
    } catch (error) {
      alert('Error viewing mnemonic: ' + error.message);
    }
    setLoading(false);
  };

  const hideMnemonic = () => {
    setShowMnemonic(null);
  };

  const viewAddresses = async (walletId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/wallet/addresses?walletId=${walletId}`);
      const data = await response.json();
      
      if (data.success) {
        setShowAddresses(data);
      } else {
        alert('Failed to retrieve addresses: ' + data.error);
      }
    } catch (error) {
      alert('Error viewing addresses: ' + error.message);
    }
    setLoading(false);
  };

  const hideAddresses = () => {
    setShowAddresses(null);
  };

  const viewTokens = async (walletId) => {
    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) {
      alert('Wallet not found');
      return;
    }

    setLoadingTokens(true);
    try {
      const response = await fetch(`/api/wallet/tokens?walletAddress=${wallet.metadata.evmAddress}`);
      const data = await response.json();
      
      if (data.success) {
        setWalletTokens(data);
        setShowTokens({
          walletId,
          walletAddress: wallet.metadata.evmAddress
        });
      } else {
        alert('Failed to retrieve tokens: ' + data.error);
      }
    } catch (error) {
      alert('Error viewing tokens: ' + error.message);
    }
    setLoadingTokens(false);
  };

  const hideTokens = () => {
    setShowTokens(null);
    setWalletTokens(null);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Unite DeFi Wallet</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <h2>Create New Wallet</h2>
        <input
          type="password"
          placeholder="Enter password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button onClick={createWallet} disabled={loading}>
          Create Wallet
        </button>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Import Wallet from Mnemonic</h2>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="text"
          placeholder="Enter mnemonic phrase"
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          style={{ marginRight: '10px', padding: '5px', width: '300px' }}
        />
        <button onClick={importWallet} disabled={loading}>
          Import from Mnemonic
        </button>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Import Wallet from Private Key</h2>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          />
          <select
            value={keyType}
            onChange={(e) => setKeyType(e.target.value)}
            style={{ marginRight: '10px', padding: '5px' }}
          >
            <option value="evm">EVM (Ethereum Compatible)</option>
            <option value="tezos">Tezos</option>
          </select>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="password"
            placeholder="Enter private key"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            style={{ marginRight: '10px', padding: '5px', width: '400px' }}
          />
          <button onClick={importWalletFromPrivateKey} disabled={loading}>
            Import from Private Key
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
          💡 <strong>Note:</strong> When importing from {keyType.toUpperCase()} private key, a separate {keyType === 'evm' ? 'Tezos' : 'EVM'} wallet will be generated automatically.
        </p>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Wallets</h2>
        {wallets.length === 0 ? (
          <p>No wallets found</p>
        ) : (
          wallets.map(wallet => (
            <div key={wallet.id} style={{ 
              margin: '10px 0', 
              padding: '15px', 
              border: '1px solid #ccc', 
              borderRadius: '5px',
              backgroundColor: activeWallet?.walletId === wallet.id ? '#f0f8ff' : 'white'
            }}>
              {editingWallet?.id === wallet.id ? (
                <div>
                  <input
                    type="text"
                    placeholder="Username"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    style={{ marginRight: '10px', padding: '5px' }}
                  />
                  <input
                    type="text"
                    placeholder="Label"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    style={{ marginRight: '10px', padding: '5px' }}
                  />
                  <button onClick={saveWalletEdit} style={{ marginRight: '5px' }}>Save</button>
                  <button onClick={cancelWalletEdit}>Cancel</button>
                </div>
              ) : (
                <div>
                  {wallet.metadata.username && (
                    <div><strong>Username:</strong> {wallet.metadata.username}</div>
                  )}
                  {wallet.metadata.label && (
                    <div><strong>Label:</strong> {wallet.metadata.label}</div>
                  )}
                  <div><strong>ID:</strong> {wallet.id}</div>
                  <div><strong>Created:</strong> {new Date(wallet.createdAt).toLocaleString()}</div>
                  {wallet.updatedAt !== wallet.createdAt && (
                    <div><strong>Updated:</strong> {new Date(wallet.updatedAt).toLocaleString()}</div>
                  )}
                  <div style={{ marginTop: '10px' }}>
                    <button 
                      onClick={() => unlockWallet(wallet.id)}
                      style={{ marginRight: '10px' }}
                    >
                      Unlock
                    </button>
                    <button 
                      onClick={() => startEditWallet(wallet)}
                      style={{ marginRight: '10px' }}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => viewPrivateKey(wallet.id)}
                      style={{ marginRight: '10px', backgroundColor: '#ffc107', color: 'black' }}
                    >
                      View Private Key
                    </button>
                    <button 
                      onClick={() => viewMnemonic(wallet.id)}
                      style={{ marginRight: '10px', backgroundColor: '#28a745', color: 'white' }}
                    >
                      View Mnemonic
                    </button>
                    <button 
                      onClick={() => viewAddresses(wallet.id)}
                      style={{ marginRight: '10px', backgroundColor: '#17a2b8', color: 'white' }}
                    >
                      View Addresses
                    </button>
                    <button 
                      onClick={() => viewTokens(wallet.id)}
                      style={{ marginRight: '10px', backgroundColor: '#6f42c1', color: 'white' }}
                    >
                      View ERC20 Tokens
                    </button>
                    <button 
                      onClick={() => deleteWallet(wallet.id)}
                      style={{ backgroundColor: '#ff4444', color: 'white' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {activeWallet && (
        <div style={{ marginBottom: '30px' }}>
          <h2>Active Wallet</h2>
          <p><strong>EVM Address:</strong> {activeWallet.addresses.evm}</p>
          <p><strong>Tezos Address:</strong> {activeWallet.addresses.tezos}</p>
          <div style={{ marginTop: '10px' }}>
            <button onClick={sendTransaction} disabled={loading} style={{ marginRight: '10px' }}>
              Send Transaction
            </button>
            <button 
              onClick={() => loadPortfolio(activeWallet.walletId, activeWallet.password)}
              disabled={loading}
              style={{ backgroundColor: '#28a745', color: 'white' }}
            >
              🔄 Refresh Balances
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            💡 Balances auto-refresh every 30 seconds
          </p>
        </div>
      )}

      {portfolio && (
        <div>
          <h2>Portfolio</h2>
          <h3>EVM Networks</h3>
          {Object.entries(portfolio.evm).map(([network, data]) => (
            <div key={network} style={{ margin: '10px 0', padding: '10px', border: '1px solid #eee' }}>
              <strong>{data.network}:</strong> {data.nativeToken.balance} {data.nativeToken.symbol}
              {data.error && <p style={{ color: 'red' }}>Error: {data.error}</p>}
            </div>
          ))}
          
          <h3>Tezos Networks</h3>
          {Object.entries(portfolio.tezos).map(([network, data]) => (
            <div key={network} style={{ margin: '10px 0', padding: '10px', border: '1px solid #eee' }}>
              <strong>{data.network}:</strong> {data.nativeToken.balance} {data.nativeToken.symbol}
              {data.error && <p style={{ color: 'red' }}>Error: {data.error}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Private Key Modal */}
      {showPrivateKey && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '30px', 
            borderRadius: '10px',
            maxWidth: '600px',
            width: '90%'
          }}>
            <h3>🔐 Private Keys</h3>
            <div style={{ marginBottom: '20px' }}>
              <p><strong>⚠️ WARNING:</strong> Never share your private keys with anyone!</p>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label><strong>EVM Private Key:</strong></label>
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #ddd', 
                padding: '10px', 
                borderRadius: '5px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}>
                {showPrivateKey.evmPrivateKey}
              </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label><strong>Tezos Private Key:</strong></label>
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #ddd', 
                padding: '10px', 
                borderRadius: '5px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}>
                {showPrivateKey.tezosPrivateKey}
              </div>
            </div>
            
            <button 
              onClick={hidePrivateKey}
              style={{ 
                backgroundColor: '#007bff', 
                color: 'white', 
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Mnemonic Modal */}
      {showMnemonic && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '30px', 
            borderRadius: '10px',
            maxWidth: '600px',
            width: '90%'
          }}>
            <h3>🔐 Mnemonic Phrase</h3>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: 'red', fontWeight: 'bold' }}>{showMnemonic.warning}</p>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label><strong>Recovery Phrase:</strong></label>
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #ddd', 
                padding: '15px', 
                borderRadius: '5px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: '1.6'
              }}>
                {showMnemonic.mnemonic}
              </div>
            </div>
            
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffecb5', borderRadius: '5px' }}>
              <p style={{ margin: 0, fontSize: '12px' }}>
                📝 <strong>Important:</strong> Write down this phrase and store it safely. You'll need it to recover your wallet.
              </p>
            </div>
            
            <button 
              onClick={hideMnemonic}
              style={{ 
                backgroundColor: '#007bff', 
                color: 'white', 
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Addresses Modal */}
      {showAddresses && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '30px', 
            borderRadius: '10px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3>📍 Wallet Addresses</h3>
            
            {/* EVM Address Section */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#007bff', marginBottom: '15px' }}>🔷 EVM Address (Ethereum Compatible)</h4>
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #ddd', 
                padding: '10px', 
                borderRadius: '5px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '12px',
                marginBottom: '10px'
              }}>
                {showAddresses.addresses.evm.address}
              </div>
              
              <h5>Supported Networks:</h5>
              <div style={{ display: 'grid', gap: '8px' }}>
                {showAddresses.addresses.evm.networks.map((network, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px',
                    backgroundColor: '#f0f8ff',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <span><strong>{network.name}</strong> ({network.symbol})</span>
                    <a href={network.explorer} target="_blank" rel="noopener noreferrer" 
                       style={{ color: '#007bff', textDecoration: 'none' }}>
                      View on Explorer ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Tezos Address Section */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#28a745', marginBottom: '15px' }}>🔶 Tezos Address</h4>
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #ddd', 
                padding: '10px', 
                borderRadius: '5px',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '12px',
                marginBottom: '10px'
              }}>
                {showAddresses.addresses.tezos.address}
              </div>
              
              <h5>Supported Networks:</h5>
              <div style={{ display: 'grid', gap: '8px' }}>
                {showAddresses.addresses.tezos.networks.map((network, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px',
                    backgroundColor: '#f0fff0',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <span><strong>{network.name}</strong> ({network.symbol})</span>
                    <a href={network.explorer} target="_blank" rel="noopener noreferrer" 
                       style={{ color: '#28a745', textDecoration: 'none' }}>
                      View on Explorer ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={hideAddresses}
              style={{ 
                backgroundColor: '#007bff', 
                color: 'white', 
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Tokens Modal */}
      {showTokens && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '30px', 
            borderRadius: '10px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3>🪙 ERC20 Tokens</h3>
            
            {loadingTokens ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p>🔄 Scanning networks for tokens...</p>
              </div>
            ) : walletTokens ? (
              <div>
                <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '5px' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    📊 <strong>Summary:</strong> Found {walletTokens.summary.totalTokensFound} tokens across {walletTokens.summary.totalNetworks} networks
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                    Wallet: {walletTokens.walletAddress}
                  </p>
                </div>
                
                {Object.entries(walletTokens.networks).map(([networkKey, networkData]) => (
                  <div key={networkKey} style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: '#6f42c1', marginBottom: '10px' }}>
                      🌐 {networkData.network} {networkData.chainId && `(Chain ID: ${networkData.chainId})`}
                    </h4>
                    
                    {networkData.error ? (
                      <div style={{ 
                        padding: '10px', 
                        backgroundColor: '#f8d7da', 
                        border: '1px solid #f5c6cb', 
                        borderRadius: '5px',
                        color: '#721c24'
                      }}>
                        ❌ Error: {networkData.error}
                      </div>
                    ) : networkData.tokens && networkData.tokens.length > 0 ? (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {networkData.tokens.map((token, index) => (
                          <div key={index} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px',
                            backgroundColor: token.type === 'native' ? '#fff3cd' : '#f0f8ff',
                            border: '1px solid ' + (token.type === 'native' ? '#ffecb5' : '#bee5eb'),
                            borderRadius: '5px',
                            fontSize: '14px'
                          }}>
                            <div>
                              <div style={{ fontWeight: 'bold' }}>
                                {token.type === 'native' ? '🔹' : '🪙'} {token.symbol}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {token.name}
                              </div>
                              {token.contractAddress && token.contractAddress !== 'native' && (
                                <div style={{ fontSize: '10px', color: '#999', fontFamily: 'monospace' }}>
                                  {token.contractAddress.slice(0, 10)}...{token.contractAddress.slice(-8)}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 'bold', color: '#28a745' }}>
                                {parseFloat(token.balance).toFixed(6)}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {token.type === 'native' ? 'Native' : 'ERC-20'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ 
                        padding: '15px', 
                        backgroundColor: '#f8f9fa', 
                        border: '1px solid #dee2e6', 
                        borderRadius: '5px',
                        textAlign: 'center',
                        color: '#6c757d'
                      }}>
                        No tokens found on this network
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p>No token data available</p>
              </div>
            )}
            
            <button 
              onClick={hideTokens}
              style={{ 
                backgroundColor: '#007bff', 
                color: 'white', 
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {loading && <p>Loading...</p>}
    </div>
  );
}