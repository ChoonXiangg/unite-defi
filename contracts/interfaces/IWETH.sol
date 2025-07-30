// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IFlashLoanReceiver.sol";

/**
 * @title IWETH
 * @dev Interface for WETH contract
 */
interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

/**
 * @title IWrappedTokenGateway
 * @dev Interface for Aave's WrappedTokenGateway for ETH operations
 */
interface IWrappedTokenGateway {
    /**
     * @dev Deposits ETH into the reserve, mints the same amount of aTokens and transfers them to onBehalfOf
     * @param onBehalfOf Address that will receive the aTokens
     * @param referralCode The code used to register the integrator
     */
    function depositETH(
        address onBehalfOf,
        uint16 referralCode
    ) external payable;

    /**
     * @dev Withdraws the WETH _reserves of msg.sender
     * @param amount Amount to withdraw
     * @param to Address to send the withdrawn amount
     */
    function withdrawETH(
        uint256 amount,
        address to
    ) external;

    /**
     * @dev Repays a loan on the WETH reserve, for the specified amount (or for the whole amount, if uint256(-1) is specified)
     * @param amount Amount to repay
     * @param onBehalfOf Address for whom msg.sender is repaying
     */
    function repayETH(
        uint256 amount,
        address onBehalfOf
    ) external payable;
}