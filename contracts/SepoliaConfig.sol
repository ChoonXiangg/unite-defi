// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SepoliaConfig
 * @dev Configuration contract with real Sepolia testnet addresses
 */
library SepoliaConfig {
    // Aave V3 Sepolia Addresses
    address public constant AAVE_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
    address public constant AAVE_POOL_ADDRESSES_PROVIDER = 0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A;
    
    // Token Addresses on Sepolia
    address public constant WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9; // Sepolia WETH
    address public constant USDC = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8; // Sepolia USDC (Aave)
    address public constant USDT = 0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0; // Sepolia USDT (Aave)
    address public constant DAI = 0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357; // Sepolia DAI (Aave)
    
    // 1inch Protocol Addresses (we'll add these in next feature)
    // address public constant INCH_LIMIT_ORDER_PROTOCOL = 0x...; // To be added
    // address public constant INCH_AGGREGATION_ROUTER = 0x...; // To be added
    
    /**
     * @dev Check if an asset is supported for flash loans
     * @param asset Asset address to check
     * @return bool True if asset is supported
     */
    function isSupportedAsset(address asset) internal pure returns (bool) {
        return asset == WETH || 
               asset == USDC || 
               asset == USDT || 
               asset == DAI;
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
     * @dev Get all supported ERC20 tokens
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens() internal pure returns (address[] memory tokens) {
        tokens = new address[](4);
        tokens[0] = WETH;
        tokens[1] = USDC;
        tokens[2] = USDT;
        tokens[3] = DAI;
    }
}