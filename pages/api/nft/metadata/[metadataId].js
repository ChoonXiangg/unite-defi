const EVMProvider = require('../../../../lib/blockchain/EVMProvider');
const NFTService = require('../../../../lib/services/NFTService');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { metadataId } = req.query;

    if (!metadataId) {
      return res.status(400).json({ error: 'Metadata ID is required' });
    }

    // Initialize services
    const evmProvider = new EVMProvider();
    const nftService = new NFTService(evmProvider);

    // Get metadata
    const metadata = nftService.getNFTMetadata(metadataId);

    // Set proper content type for NFT metadata
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    res.status(200).json(metadata);
  } catch (error) {
    console.error('Get metadata error:', error);
    if (error.message === 'Metadata not found') {
      res.status(404).json({ error: 'Metadata not found' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to get metadata' });
    }
  }
}