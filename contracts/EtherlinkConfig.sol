// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EtherlinkConfig
 * @dev Configuration contract for Etherlink mainnet and testnet
 */
library EtherlinkConfig {
    // Note: Etherlink doesn't have Aave V3 deployed yet, so we'll need to deploy our own or use alternatives
    // For now, these are placeholder addresses - we'll update when infrastructure is available
    
    // Flash Loan Providers (TBD - may need to deploy our own)
    address public constant FLASH_LOAN_PROVIDER = address(0); // TBD
    
    // Native Token (XTZ on Etherlink)
    address public constant NATIVE_TOKEN = address(0); // Native XTZ
    
    // Wrapped XTZ (similar to WETH)
    address public constant WXTZ = address(0); // TBD - needs to be deployed
    
    // Common ERC20 tokens on Etherlink (TBD based on ecosystem)
    address public constant USDT = address(0); // TBD
    address public constant USDC = address(0); // TBD
    address public constant DAI = address(0);  // TBD
    
    /**
     * @dev Check if an asset is supported for flash loans
     * @param asset Asset address to check
     * @return bool True if asset is supported
     */
    function isSupportedAsset(address asset) internal pure returns (bool) {
        return asset == WXTZ || 
               asset == USDC || 
               asset == USDT || 
               asset == DAI;
    }
    
    /**
     * @dev Get native token address (0x0 for XTZ)
     * @return address Zero address representing native XTZ
     */
    function getNativeToken() internal pure returns (address) {
        return address(0);
    }
    
    /**
     * @dev Check if asset is native XTZ
     * @param asset Asset address to check
     * @return bool True if asset is native XTZ
     */
    function isNativeToken(address asset) internal pure returns (bool) {
        return asset == address(0);
    }
    
    /**
     * @dev Get WXTZ address for wrapping/unwrapping XTZ
     * @return address WXTZ contract address
     */
    function getWXTZ() internal pure returns (address) {
        return WXTZ;
    }
    
    /**
     * @dev Get all supported ERC20 tokens
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens() internal pure returns (address[] memory tokens) {
        tokens = new address[](4);
        tokens[0] = WXTZ;
        tokens[1] = USDC;
        tokens[2] = USDT;
        tokens[3] = DAI;
    }
    
    /**
     * @dev Get network information
     * @return chainId Chain ID
     * @return nativeSymbol Native token symbol
     */
    function getNetworkInfo() internal pure returns (uint256 chainId, string memory nativeSymbol) {
        chainId = 42793; // Etherlink Mainnet
        nativeSymbol = "XTZ";
    }
    
    /**
     * @dev Get testnet network information
     * @return chainId Chain ID
     * @return nativeSymbol Native token symbol
     */
    function getTestnetInfo() internal pure returns (uint256 chainId, string memory nativeSymbol) {
        chainId = 128123; // Etherlink Testnet
        nativeSymbol = "XTZ";
    }
}