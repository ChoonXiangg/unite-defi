const PortfolioService = require('../../../lib/services/PortfolioService');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const portfolioService = new PortfolioService();
    const networks = portfolioService.getSupportedNetworks();

    res.status(200).json({
      success: true,
      networks
    });
  } catch (error) {
    console.error('Supported networks error:', error);
    res.status(500).json({ error: 'Failed to fetch supported networks' });
  }
}