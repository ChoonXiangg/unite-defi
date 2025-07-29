const EVMProvider = require('../../../../lib/blockchain/EVMProvider');
const NFTService = require('../../../../lib/services/NFTService');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    // Initialize services
    const evmProvider = new EVMProvider();
    const nftService = new NFTService(evmProvider);

    // Get contract information
    const contractInfo = nftService.getContractInfo(address);
    
    // Get NFTs in the contract
    const nfts = nftService.getContractNFTs(address);

    res.status(200).json({
      success: true,
      contract: contractInfo,
      nfts,
      totalNFTs: nfts.length
    });
  } catch (error) {
    console.error('Get contract info error:', error);
    if (error.message === 'Contract not found') {
      res.status(404).json({ error: 'Contract not found' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to get contract information' });
    }
  }
}