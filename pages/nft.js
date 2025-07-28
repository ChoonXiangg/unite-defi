import { useState, useEffect } from 'react';

export default function NFT() {
  const [activeWallet, setActiveWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('mint');
  const [contracts, setContracts] = useState([]);
  const [userNFTs, setUserNFTs] = useState([]);


  // Mint NFT form
  const [mintForm, setMintForm] = useState({
    contractAddress: '0x176E38D94AD24022fDb813E8F3f3fe10Fde17249',
    recipient: '',
    name: '',
    description: '',
    image: '',
    attributes: []
  });

  // Batch mint form
  const [batchMintForm, setBatchMintForm] = useState({
    contractAddress: '0x176E38D94AD24022fDb813E8F3f3fe10Fde17249',
    nftData: [{ recipient: '', name: '', description: '', image: '', attributes: [] }]
  });


  useEffect(() => {
    // Check if wallet is unlocked (you can get this from localStorage or context)
    const savedWallet = localStorage.getItem('activeWallet');
    if (savedWallet) {
      setActiveWallet(JSON.parse(savedWallet));
      loadUserContracts();
      loadUserNFTs();
    }
  }, []);

  const loadUserContracts = async () => {
    const savedWallet = localStorage.getItem('activeWallet');
    if (!savedWallet) return;

    const wallet = JSON.parse(savedWallet);
    
    try {
      const response = await fetch('/api/nft/user-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: wallet.walletId,
          password: wallet.password
        })
      });

      const data = await response.json();
      if (data.success) {
        setContracts(data.contracts);
      }
    } catch (error) {
      console.error('Failed to load contracts:', error);
    }
  };

  const loadUserNFTs = async () => {
    const savedWallet = localStorage.getItem('activeWallet');
    if (!savedWallet) return;

    const wallet = JSON.parse(savedWallet);
    
    try {
      const response = await fetch('/api/nft/user-nfts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: wallet.walletId,
          password: wallet.password
        })
      });

      const data = await response.json();
      if (data.success) {
        setUserNFTs(data.nfts);
      }
    } catch (error) {
      console.error('Failed to load NFTs:', error);
    }
  };



  const mintNFT = async () => {
    if (!activeWallet || !mintForm.contractAddress || !mintForm.recipient || !mintForm.name) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: activeWallet.walletId,
          password: activeWallet.password,
          ...mintForm
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`NFT minted successfully!\nToken ID: ${data.nft.tokenId}\nTransaction: ${data.nft.transactionHash}`);
        setMintForm({
          contractAddress: '0x176E38D94AD24022fDb813E8F3f3fe10Fde17249',
          recipient: '',
          name: '',
          description: '',
          image: '',
          attributes: []
        });
        loadUserNFTs();
      } else {
        alert('Minting failed: ' + data.error);
      }
    } catch (error) {
      alert('Error minting NFT: ' + error.message);
    }
    setLoading(false);
  };

  const addBatchMintEntry = () => {
    setBatchMintForm(prev => ({
      ...prev,
      nftData: [...prev.nftData, { recipient: '', name: '', description: '', image: '', attributes: [] }]
    }));
  };

  const removeBatchMintEntry = (index) => {
    setBatchMintForm(prev => ({
      ...prev,
      nftData: prev.nftData.filter((_, i) => i !== index)
    }));
  };

  const updateBatchMintEntry = (index, field, value) => {
    setBatchMintForm(prev => ({
      ...prev,
      nftData: prev.nftData.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const batchMintNFTs = async () => {
    if (!activeWallet || !batchMintForm.contractAddress || batchMintForm.nftData.length === 0) {
      alert('Please fill in contract address and at least one NFT');
      return;
    }

    // Validate all entries have required fields
    const invalidEntries = batchMintForm.nftData.filter(nft => !nft.recipient || !nft.name);
    if (invalidEntries.length > 0) {
      alert('All NFTs must have recipient and name filled in');
      return;
    }

    setLoading(true);
    try {
      const recipients = batchMintForm.nftData.map(nft => nft.recipient);
      const nftData = batchMintForm.nftData.map(({ recipient, ...rest }) => rest);

      const response = await fetch('/api/nft/batch-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: activeWallet.walletId,
          password: activeWallet.password,
          contractAddress: batchMintForm.contractAddress,
          recipients,
          nftData
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Batch mint successful!\n${data.batch.batchSize} NFTs minted\nTotal gas used: ${data.batch.totalGasUsed}`);
        setBatchMintForm({
          contractAddress: '0x176E38D94AD24022fDb813E8F3f3fe10Fde17249',
          nftData: [{ recipient: '', name: '', description: '', image: '', attributes: [] }]
        });
        loadUserNFTs();
      } else {
        alert('Batch minting failed: ' + data.error);
      }
    } catch (error) {
      alert('Error batch minting NFTs: ' + error.message);
    }
    setLoading(false);
  };

  if (!activeWallet) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1>NFT Creator</h1>
        <p>Please unlock a wallet first to access NFT features.</p>
        <a href="/wallet" style={{ color: 'blue', textDecoration: 'underline' }}>
          Go to Wallet Page
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>NFT Creator - Arbitrum Sepolia</h1>
      <p><strong>Active Wallet:</strong> {activeWallet.addresses?.evm}</p>

      {/* Tabs */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('mint')}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: activeTab === 'mint' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'mint' ? 'white' : 'black',
            border: '1px solid #ddd'
          }}
        >
          Mint NFT
        </button>
        <button 
          onClick={() => setActiveTab('batch')}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: activeTab === 'batch' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'batch' ? 'white' : 'black',
            border: '1px solid #ddd'
          }}
        >
          Batch Mint
        </button>
        <button 
          onClick={() => setActiveTab('manage')}
          style={{ 
            padding: '10px 20px',
            backgroundColor: activeTab === 'manage' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'manage' ? 'white' : 'black',
            border: '1px solid #ddd'
          }}
        >
          Manage NFTs
        </button>
      </div>

      {/* Contract Info */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>📋 Deployed Contract</h3>
        <p><strong>Contract:</strong> Unite DeFi NFT (UNITE)</p>
        <p><strong>Address:</strong> 0x176E38D94AD24022fDb813E8F3f3fe10Fde17249</p>
        <p><strong>Network:</strong> Arbitrum Sepolia</p>
        <p><strong>Verify:</strong> <a href="https://sepolia.arbiscan.io/address/0x176E38D94AD24022fDb813E8F3f3fe10Fde17249" target="_blank" rel="noopener noreferrer">View on Arbiscan</a></p>
      </div>

      {/* Mint NFT Tab */}
      {activeTab === 'mint' && (
        <div>
          <h2>Mint Single NFT</h2>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label>Contract Address *</label><br />
              <select
                value={mintForm.contractAddress}
                onChange={(e) => setMintForm(prev => ({ ...prev, contractAddress: e.target.value }))}
                style={{ width: '300px', padding: '5px' }}
              >
                <option value="">Select a contract</option>
                {contracts.map(contract => (
                  <option key={contract.contractAddress} value={contract.contractAddress}>
                    {contract.name} ({contract.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>Recipient Address *</label><br />
              <input
                type="text"
                value={mintForm.recipient}
                onChange={(e) => setMintForm(prev => ({ ...prev, recipient: e.target.value }))}
                style={{ width: '300px', padding: '5px' }}
                placeholder="0x..."
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>NFT Name *</label><br />
              <input
                type="text"
                value={mintForm.name}
                onChange={(e) => setMintForm(prev => ({ ...prev, name: e.target.value }))}
                style={{ width: '300px', padding: '5px' }}
                placeholder="My Awesome NFT"
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>Description</label><br />
              <textarea
                value={mintForm.description}
                onChange={(e) => setMintForm(prev => ({ ...prev, description: e.target.value }))}
                style={{ width: '300px', padding: '5px', height: '60px' }}
                placeholder="NFT description..."
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>Image URL</label><br />
              <input
                type="text"
                value={mintForm.image}
                onChange={(e) => setMintForm(prev => ({ ...prev, image: e.target.value }))}
                style={{ width: '300px', padding: '5px' }}
                placeholder="https://example.com/image.png"
              />
            </div>
            <button 
              onClick={mintNFT}
              disabled={loading || !mintForm.contractAddress || !mintForm.recipient || !mintForm.name}
              style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white' }}
            >
              {loading ? 'Minting...' : 'Mint NFT'}
            </button>
          </div>
        </div>
      )}

      {/* Batch Mint Tab */}
      {activeTab === 'batch' && (
        <div>
          <h2>Batch Mint NFTs</h2>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label>Contract Address *</label><br />
              <select
                value={batchMintForm.contractAddress}
                onChange={(e) => setBatchMintForm(prev => ({ ...prev, contractAddress: e.target.value }))}
                style={{ width: '300px', padding: '5px' }}
              >
                <option value="">Select a contract</option>
                {contracts.map(contract => (
                  <option key={contract.contractAddress} value={contract.contractAddress}>
                    {contract.name} ({contract.symbol})
                  </option>
                ))}
              </select>
            </div>
            
            <h3>NFTs to Mint ({batchMintForm.nftData.length})</h3>
            {batchMintForm.nftData.map((nft, index) => (
              <div key={index} style={{ 
                border: '1px solid #ddd', 
                padding: '10px', 
                marginBottom: '10px',
                backgroundColor: '#f9f9f9'
              }}>
                <h4>NFT #{index + 1}</h4>
                <div style={{ marginBottom: '5px' }}>
                  <input
                    type="text"
                    value={nft.recipient}
                    onChange={(e) => updateBatchMintEntry(index, 'recipient', e.target.value)}
                    style={{ width: '250px', padding: '3px', marginRight: '10px' }}
                    placeholder="Recipient address"
                  />
                  <input
                    type="text"
                    value={nft.name}
                    onChange={(e) => updateBatchMintEntry(index, 'name', e.target.value)}
                    style={{ width: '150px', padding: '3px' }}
                    placeholder="NFT name"
                  />
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <textarea
                    value={nft.description}
                    onChange={(e) => updateBatchMintEntry(index, 'description', e.target.value)}
                    style={{ width: '300px', padding: '3px', height: '40px' }}
                    placeholder="Description"
                  />
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <input
                    type="text"
                    value={nft.image}
                    onChange={(e) => updateBatchMintEntry(index, 'image', e.target.value)}
                    style={{ width: '300px', padding: '3px' }}
                    placeholder="Image URL"
                  />
                </div>
                {batchMintForm.nftData.length > 1 && (
                  <button 
                    onClick={() => removeBatchMintEntry(index)}
                    style={{ backgroundColor: '#dc3545', color: 'white', padding: '3px 8px' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            
            <div style={{ marginBottom: '10px' }}>
              <button 
                onClick={addBatchMintEntry}
                style={{ marginRight: '10px', padding: '8px 16px' }}
              >
                Add Another NFT
              </button>
              <button 
                onClick={batchMintNFTs}
                disabled={loading || !batchMintForm.contractAddress || batchMintForm.nftData.length === 0}
                style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white' }}
              >
                {loading ? 'Batch Minting...' : `Batch Mint ${batchMintForm.nftData.length} NFTs`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage NFTs Tab */}
      {activeTab === 'manage' && (
        <div>
          <h2>Your NFT Collections</h2>
          <div style={{ marginBottom: '30px' }}>
            <h3>Deployed Contracts ({contracts.length})</h3>
            {contracts.length === 0 ? (
              <p>No contracts deployed yet</p>
            ) : (
              contracts.map(contract => (
                <div key={contract.contractAddress} style={{ 
                  border: '1px solid #ddd', 
                  padding: '15px', 
                  marginBottom: '10px',
                  backgroundColor: '#f9f9f9'
                }}>
                  <h4>{contract.name} ({contract.symbol})</h4>
                  <p><strong>Address:</strong> {contract.contractAddress}</p>
                  <p><strong>Description:</strong> {contract.description}</p>
                  <p><strong>Total Supply:</strong> {contract.totalSupply}</p>
                  <p><strong>Deployed:</strong> {new Date(contract.deployedAt).toLocaleString()}</p>
                  {contract.royaltyFeeBps > 0 && (
                    <p><strong>Royalty:</strong> {(contract.royaltyFeeBps / 100).toFixed(2)}%</p>
                  )}
                </div>
              ))
            )}
          </div>

          <div>
            <h3>Your NFTs ({userNFTs.length})</h3>
            {userNFTs.length === 0 ? (
              <p>No NFTs found</p>
            ) : (
              userNFTs.map(nft => (
                <div key={`${nft.contractAddress}-${nft.tokenId}`} style={{ 
                  border: '1px solid #ddd', 
                  padding: '15px', 
                  marginBottom: '10px',
                  backgroundColor: '#f9f9f9'
                }}>
                  <h4>{nft.metadata?.metadata?.name || `Token #${nft.tokenId}`}</h4>
                  <p><strong>Token ID:</strong> {nft.tokenId}</p>
                  <p><strong>Contract:</strong> {nft.contractAddress}</p>
                  <p><strong>Description:</strong> {nft.metadata?.metadata?.description}</p>
                  {nft.metadata?.metadata?.image && (
                    <p><strong>Image:</strong> <a href={nft.metadata.metadata.image} target="_blank" rel="noopener noreferrer">View</a></p>
                  )}
                  <p><strong>Minted:</strong> {new Date(nft.mintedAt).toLocaleString()}</p>
                  <p><strong>Transaction:</strong> {nft.transactionHash}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '5px' }}>
            <p>Processing transaction...</p>
          </div>
        </div>
      )}
    </div>
  );
}