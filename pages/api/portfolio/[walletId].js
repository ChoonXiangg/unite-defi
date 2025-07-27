const WalletManager = require('../../../lib/wallet/WalletManager');
const PortfolioService = require('../../../lib/services/PortfolioService');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId } = req.query;
    const { password, tokenAddresses = [], nftContracts = [] } = req.body;

    if (!walletId || !password) {
      return res.status(400).json({ error: 'Wallet ID and password are required' });
    }

    const walletManager = new WalletManager();
    const wallet = await walletManager.loadWallet(walletId, password);

    const portfolioService = new PortfolioService();
    const portfolio = await portfolioService.getWalletPortfolio(wallet);

    // Get token balances if provided
    if (tokenAddresses.length > 0) {
      portfolio.customTokens = {
        evm: await portfolioService.getTokenBalances(wallet, tokenAddresses.evm || [], 'ethereum', 'evm'),
        tezos: await portfolioService.getTokenBalances(wallet, tokenAddresses.tezos || [], 'mainnet', 'tezos')
      };
    }

    // Get NFT portfolio if contracts provided
    if (nftContracts.length > 0) {
      portfolio.nfts = await portfolioService.getNFTPortfolio(wallet, nftContracts);
    }

    res.status(200).json({
      success: true,
      portfolio
    });
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch portfolio' });
  }
}