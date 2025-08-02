const WalletManager = require('../../../lib/wallet/WalletManager');
const EVMProvider = require('../../../lib/blockchain/EVMProvider');
const NFTService = require('../../../lib/services/NFTService');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, password, contractAddress } = req.body;

    if (!walletId || !password) {
      return res.status(400).json({ error: 'Wallet ID and password are required' });
    }

    // Load wallet
    const walletManager = new WalletManager();
    const wallet = await walletManager.loadWallet(walletId, password);

    // Initialize services
    const evmProvider = new EVMProvider();
    const nftService = new NFTService(evmProvider);

    // Get user's NFTs from internal database
    const nfts = nftService.getUserNFTs(wallet.evm.address, contractAddress);

    // 🆕 Enhanced response with 1inch NFT API integration
    let oneInchNFTs = [];
    
    try {
      const apiKey = process.env.ONEINCH_API_KEY;
      const headers = { 'Accept': 'application/json' };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // 🆕 Get NFTs from 1inch NFT API for Arbitrum One
      console.log('🖼️ Fetching NFTs via 1inch NFT API...');
      const nftApiUrl = `https://api.1inch.dev/nft/v1.0/byaddress?address=${wallet.evm.address}&chainId=42161`;
      const nftResponse = await fetch(nftApiUrl, { headers });
      
      if (nftResponse.ok) {
        const nftData = await nftResponse.json();
        console.log(`✅ 1inch NFT API found ${nftData.assets?.length || 0} NFTs`);
        
        if (nftData.assets && nftData.assets.length > 0) {
          oneInchNFTs = nftData.assets.map(nft => ({
            source: '1inch_nft_api',
            tokenId: nft.tokenId,
            contractAddress: nft.contractAddress,
            name: nft.name || `Token #${nft.tokenId}`,
            description: nft.description,
            imageUrl: nft.imageUrl,
            collectionName: nft.collectionName,
            network: 'Arbitrum One',
            marketplace: nft.marketplace || 'detected_by_1inch'
          }));
        }
      } else {
        console.warn('⚠️ 1inch NFT API failed:', nftResponse.status);
      }
    } catch (nftApiError) {
      console.warn('⚠️ 1inch NFT API error:', nftApiError.message);
    }

    // Return enhanced NFTs from both internal database and 1inch API
    res.status(200).json({
      success: true,
      nfts,
      totalNFTs: nfts.length,
      userAddress: wallet.evm.address,
      // 🆕 Enhanced NFT data from 1inch API
      enhanced: {
        oneInchNFTs: oneInchNFTs,
        oneInchCount: oneInchNFTs.length,
        totalNFTs: nfts.length + oneInchNFTs.length,
        sources: ['internal_database', ...(oneInchNFTs.length > 0 ? ['1inch_nft_api'] : [])]
      }
    });
  } catch (error) {
    console.error('Get user NFTs error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user NFTs' });
  }
}