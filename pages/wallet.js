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

  useEffect(() => {
    loadWallets();
  }, []);

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
        alert('Failed to import wallet: ' + data.error);
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
        setActiveWallet({ ...data, password: walletPassword });
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
    const network = prompt('Enter network (ethereum/bsc/polygon/mainnet/ghostnet):');
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
        <h2>Import Wallet</h2>
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
          Import Wallet
        </button>
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
          <button onClick={sendTransaction} disabled={loading}>
            Send Transaction
          </button>
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

      {loading && <p>Loading...</p>}
    </div>
  );
}