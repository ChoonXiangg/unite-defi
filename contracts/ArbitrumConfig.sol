// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArbitrumConfig
 * @dev Configuration contract with real Arbitrum addresses
 */
library ArbitrumConfig {
    // Aave V3 Arbitrum Addresses
    address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address public constant AAVE_POOL_ADDRESSES_PROVIDER = 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb;
    
    // 1inch Limit Order Protocol Arbitrum
    address public constant INCH_LIMIT_ORDER_PROTOCOL = 0x111111125421cA6dc452d289314280a0f8842A65;
    
    // Token Addresses on Arbitrum
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1; // Arbitrum WETH
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // Native USDC
    address public constant USDT = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9; // Arbitrum USDT
    address public constant WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f; // Arbitrum WBTC
    address public constant ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;   // Arbitrum token
    
    /**
     * @dev Check if an asset is supported for flash loans
     * @param asset Asset address to check
     * @return bool True if asset is supported
     */
    function isSupportedAsset(address asset) internal pure returns (bool) {
        return asset == WETH || 
               asset == USDC || 
               asset == USDT || 
               asset == WBTC ||
               asset == ARB;
    }
    
    /**
     * @dev Get native ETH address (0x0)
     * @return address Zero address representing native ETH
     */
    function getNativeETH() internal pure returns (address) {
        return address(0);
    }
    
    /**
     * @dev Check if asset is native ETH
     * @param asset Asset address to check
     * @return bool True if asset is native ETH
     */
    function isNativeETH(address asset) internal pure returns (bool) {
        return asset == address(0);
    }
    
    /**
     * @dev Get WETH address for wrapping/unwrapping ETH
     * @return address WETH contract address
     */
    function getWETH() internal pure returns (address) {
        return WETH;
    }
    
    /**
     * @dev Get 1inch Limit Order Protocol address
     * @return address 1inch LOP contract address
     */
    function get1inchLOP() internal pure returns (address) {
        return INCH_LIMIT_ORDER_PROTOCOL;
    }
    
    /**
     * @dev Get all supported ERC20 tokens
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens() internal pure returns (address[] memory tokens) {
        tokens = new address[](5);
        tokens[0] = WETH;
        tokens[1] = USDC;
        tokens[2] = USDT;
        tokens[3] = WBTC;
        tokens[4] = ARB;
    }
    
    /**
     * @dev Get network information
     * @return chainId Chain ID
     * @return nativeSymbol Native token symbol
     */
    function getNetworkInfo() internal pure returns (uint256 chainId, string memory nativeSymbol) {
        chainId = 42161; // Arbitrum One
        nativeSymbol = "ETH";
    }
    
    /**
     * @dev Get testnet network information
     * @return chainId Chain ID
     * @return nativeSymbol Native token symbol
     */
    function getTestnetInfo() internal pure returns (uint256 chainId, string memory nativeSymbol) {
        chainId = 421614; // Arbitrum Sepolia
        nativeSymbol = "ETH";
    }
}