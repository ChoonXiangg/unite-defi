// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockWETH
 * @dev Mock WETH implementation for testing
 */
contract MockWETH is ERC20 {
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);
    
    constructor() ERC20("Wrapped Ether", "WETH") {}
    
    /**
     * @dev Deposit ETH and mint WETH
     */
    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }
    
    /**
     * @dev Burn WETH and withdraw ETH
     */
    function withdraw(uint256 amount) external {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, amount);
    }
    
    /**
     * @dev Mint WETH for testing purposes
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {
        deposit();
    }
}