// Static token logos from CoinGecko - fetched once and cached
const TOKEN_LOGOS = {
  'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'USDC': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
  'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  'BTC': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  'AVAX': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  'XTZ': 'https://assets.coingecko.com/coins/images/976/small/Tezos-logo.png',
  'kUSD': 'https://assets.coingecko.com/coins/images/14441/small/kolibri-logo.png',
  'DAI': 'https://assets.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png',
  'WETH': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  'WBTC': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  'UNI': 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png',
  'LINK': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  'AAVE': 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',
  'COMP': 'https://assets.coingecko.com/coins/images/10775/small/COMP.png',
  'MKR': 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png',
  'CRV': 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
  'YFI': 'https://assets.coingecko.com/coins/images/11849/small/yfi-192x192.png',
  'SUSHI': 'https://assets.coingecko.com/coins/images/12271/small/512x512_Logo_no_chop.png'
};

// Chain logos
const CHAIN_LOGOS = {
  'Ethereum': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'Arbitrum': 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  'Base': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', // Base uses ETH logo
  'Polygon': 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  'BSC': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'Avalanche': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  'Tezos': 'https://assets.coingecko.com/coins/images/976/small/Tezos-logo.png'
};

/**
 * Get token logo URL without API calls
 * @param {string} symbol - Token symbol (e.g., 'ETH', 'USDC')
 * @returns {string} Logo URL
 */
export function getTokenLogo(symbol) {
  const upperSymbol = symbol.toUpperCase();
  return TOKEN_LOGOS[upperSymbol] || `https://via.placeholder.com/32x32/666666/ffffff?text=${symbol}`;
}

/**
 * Get chain logo URL without API calls
 * @param {string} chainName - Chain name (e.g., 'Ethereum', 'Polygon')
 * @returns {string} Logo URL
 */
export function getChainLogo(chainName) {
  return CHAIN_LOGOS[chainName] || "https://via.placeholder.com/20x20/666666/ffffff?text=?";
}

/**
 * Add a new token logo to cache (for future use)
 * @param {string} symbol - Token symbol
 * @param {string} logoUrl - Logo URL
 */
export function addTokenLogo(symbol, logoUrl) {
  TOKEN_LOGOS[symbol.toUpperCase()] = logoUrl;
}

/**
 * Get all available token symbols
 * @returns {string[]} Array of token symbols
 */
export function getAvailableTokens() {
  return Object.keys(TOKEN_LOGOS);
}

export default {
  getTokenLogo,
  getChainLogo,
  addTokenLogo,
  getAvailableTokens
};