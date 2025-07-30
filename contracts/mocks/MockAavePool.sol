// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IFlashLoanReceiver.sol";

/**
 * @title MockAavePool
 * @dev Mock implementation of Aave Pool for testing flash loans
 */
contract MockAavePool is IPool {
    uint256 public constant FLASH_LOAN_PREMIUM = 9; // 0.09% premium
    uint256 public constant PREMIUM_TOTAL = 10000;
    
    mapping(address => uint256) public tokenBalances;
    
    event FlashLoanExecuted(
        address indexed receiver,
        address indexed asset,
        uint256 amount,
        uint256 premium
    );
    
    constructor() {
        // Initialize with some ETH balance for flash loans
        tokenBalances[address(0)] = 1000 ether; // Mock ETH balance
    }
    
    /**
     * @dev Fund the pool with tokens for testing
     */
    function fundPool(address asset, uint256 amount) external payable {
        if (asset == address(0)) {
            tokenBalances[asset] += msg.value;
        } else {
            tokenBalances[asset] += amount;
            IERC20(asset).transferFrom(msg.sender, address(this), amount);
        }
    }
    
    /**
     * @dev Mock flash loan implementation
     */
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata interestRateModes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external override {
        require(assets.length == amounts.length, "Arrays length mismatch");
        require(assets.length == 1, "Mock only supports single asset flash loans");
        require(interestRateModes[0] == 0, "Mock only supports mode 0");
        
        // Store variables to avoid stack too deep
        _executeFlashLoan(receiverAddress, assets[0], amounts[0], params);
    }
    
    /**
     * @dev Internal function to avoid stack too deep error
     */
    function _executeFlashLoan(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params
    ) internal {
        require(tokenBalances[asset] >= amount, "Insufficient pool liquidity");
        
        // Calculate premium
        uint256 premium = (amount * FLASH_LOAN_PREMIUM) / PREMIUM_TOTAL;
        
        // Send funds to receiver
        if (asset == address(0)) {
            payable(receiverAddress).transfer(amount);
        } else {
            IERC20(asset).transfer(receiverAddress, amount);
        }
        
        // Prepare arrays for callback
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        uint256[] memory premiums = new uint256[](1);
        premiums[0] = premium;
        
        // Call receiver's executeOperation
        bool success = IFlashLoanReceiver(receiverAddress).executeOperation(
            assets,
            amounts,
            premiums,
            msg.sender,
            params
        );
        
        require(success, "Flash loan execution failed");
        
        // Check repayment
        uint256 totalDebt = amount + premium;
        if (asset == address(0)) {
            uint256 expectedBalance = tokenBalances[asset] - amount + totalDebt;
            require(address(this).balance >= expectedBalance, "Flash loan not repaid");
            tokenBalances[asset] = expectedBalance;
        } else {
            uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
            uint256 expectedBalance = tokenBalances[asset] - amount + totalDebt;
            require(balanceAfter >= expectedBalance, "Flash loan not repaid");
            tokenBalances[asset] = balanceAfter;
        }
        
        emit FlashLoanExecuted(receiverAddress, asset, amount, premium);
    }
    
    /**
     * @dev Get available liquidity for an asset
     */
    function getAvailableLiquidity(address asset) external view returns (uint256) {
        return tokenBalances[asset];
    }
    
    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {
        tokenBalances[address(0)] += msg.value;
    }
}