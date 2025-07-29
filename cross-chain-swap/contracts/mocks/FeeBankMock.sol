// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IFeeBank } from "limit-order-settlement/contracts/interfaces/IFeeBank.sol";

contract FeeBankMock is IFeeBank {
    mapping(address => uint256) public override availableCredit;
    function deposit(uint256 amount) external override returns (uint256) { availableCredit[msg.sender] += amount; return availableCredit[msg.sender]; }
    function depositFor(address account, uint256 amount) external override returns (uint256) { availableCredit[account] += amount; return availableCredit[account]; }
    function depositWithPermit(uint256, bytes calldata) external pure override returns (uint256) { return 0; }
    function depositForWithPermit(address, uint256, bytes calldata) external pure override returns (uint256) { return 0; }
    function withdraw(uint256) external pure override returns (uint256) { return 0; }
    function withdrawTo(address, uint256) external pure override returns (uint256) { return 0; }
} 