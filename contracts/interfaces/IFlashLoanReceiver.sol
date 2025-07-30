// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IFlashLoanReceiver
 * @dev Interface for flash loan receivers (Aave V3 compatible)
 */
interface IFlashLoanReceiver {
    /**
     * @dev Executes an operation after receiving the flash-borrowed assets
     * @param assets The addresses of the flash-borrowed assets
     * @param amounts The amounts of the flash-borrowed assets
     * @param premiums The fees of the flash-borrowed assets
     * @param initiator The address of the flashloan initiator
     * @param params The encoded parameters passed to the flashloan
     * @return True if the execution of the operation succeeds, false otherwise
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/**
 * @title IPool
 * @dev Simplified Aave V3 Pool interface for flash loans
 */
interface IPool {
    /**
     * @dev Initiates a flash loan
     * @param receiverAddress The address of the contract receiving the funds
     * @param assets The addresses of the assets being flash-borrowed
     * @param amounts The amounts amounts being flash-borrowed
     * @param interestRateModes Types of interest rate (0 = none, 1 = stable, 2 = variable)
     * @param onBehalfOf The address that will receive the debt (not used for flash loans)
     * @param params Variadic packed params to pass to the receiver
     * @param referralCode The code used to register the integrator
     */
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata interestRateModes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

