// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title I1inchLimitOrderProtocol
 * @dev Interface for 1inch Limit Order Protocol v4
 */
interface I1inchLimitOrderProtocol {
    struct Order {
        uint256 salt;
        address maker;
        address receiver;
        address makerAsset;
        address takerAsset;
        uint256 makingAmount;
        uint256 takingAmount;
        uint256 makerTraits;
    }

    /**
     * @dev Fills an order
     * @param order Order to fill
     * @param signature Maker's signature
     * @param interaction Interaction data
     * @param makingAmount Amount of maker asset to take
     * @param takingAmount Amount of taker asset to give
     * @param skipPermitAndThresholdAmount Skip permit and use this threshold
     * @return actualMakingAmount Actual making amount
     * @return actualTakingAmount Actual taking amount
     */
    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external returns (uint256 actualMakingAmount, uint256 actualTakingAmount);

    /**
     * @dev Gets making amount for a given taking amount
     * @param order Order data
     * @param takingAmount Taking amount
     * @return makingAmount Making amount
     */
    function getMakingAmount(
        Order calldata order,
        uint256 takingAmount
    ) external view returns (uint256 makingAmount);

    /**
     * @dev Gets taking amount for a given making amount
     * @param order Order data
     * @param makingAmount Making amount
     * @return takingAmount Taking amount
     */
    function getTakingAmount(
        Order calldata order,
        uint256 makingAmount
    ) external view returns (uint256 takingAmount);

    /**
     * @dev Checks if predicate is valid
     * @param order Order data
     * @return isValid True if predicate is valid
     */
    function checkPredicate(
        Order calldata order
    ) external view returns (bool isValid);

    /**
     * @dev Cancels order
     * @param makerTraits Maker traits
     * @param orderHash Order hash to cancel
     */
    function cancelOrder(
        uint256 makerTraits,
        bytes32 orderHash
    ) external;

    /**
     * @dev Gets order hash
     * @param order Order data
     * @return orderHash Hash of the order
     */
    function hashOrder(
        Order calldata order
    ) external view returns (bytes32 orderHash);

    /**
     * @dev Remaining amount of order
     * @param orderHash Order hash
     * @return remaining Remaining amount
     */
    function remaining(
        bytes32 orderHash
    ) external view returns (uint256 remaining);

    /**
     * @dev Check if order is valid
     * @param order Order data
     * @param signature Signature
     * @return isValid True if order is valid
     */
    function isValidSignature(
        Order calldata order,
        bytes calldata signature
    ) external view returns (bool isValid);
}