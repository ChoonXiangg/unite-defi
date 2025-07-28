// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// This is our reward token contract for the Unite DeFi app
// It's an ERC-20 token that can only be minted by authorized addresses
// Users earn these tokens when they perform swaps in our app

contract UniteRewardToken {
    // Token basic information
    string public name = "SYBAU Token";
    string public symbol = "SYBAU";
    uint8 public decimals = 18;
    uint256 private _totalSupply;
    
    // Balances mapping: address -> amount of tokens they own
    mapping(address => uint256) private _balances;
    
    // Allowances mapping: owner -> spender -> amount allowed to spend
    mapping(address => mapping(address => uint256)) private _allowances;
    
    // Access control
    address public owner;           // Contract owner (can change minter)
    address public minter;          // Address that can mint new tokens (our backend)
    
    // Events - these are logged on the blockchain when things happen
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount, string reason);
    event TokensSpent(address indexed user, uint256 amount, string item);
    event UserTransfer(address indexed from, address indexed to, uint256 amount, string message);
    
    // Modifiers - these are like security checks
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    modifier onlyMinter() {
        require(msg.sender == minter || msg.sender == owner, "Not authorized to mint");
        _;
    }
    
    // Constructor - runs once when contract is deployed
    constructor() {
        owner = msg.sender;    // Person who deploys becomes owner
        minter = msg.sender;   // Initially, owner can also mint
    }
    
    // Standard ERC-20 functions
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    
    // This is the main function for generating/minting new tokens
    // Only the minter (our app backend) can call this
    // usdAmount should be in wei format (18 decimals) for precision
    // Example: $100.50 = 100.5 * 10^18 = 100500000000000000000
    function mintRewardForSwap(address to, uint256 usdAmount) external onlyMinter {
        require(to != address(0), "Cannot mint to zero address");
        require(usdAmount > 0, "USD amount must be positive");
        
        // Calculate reward tokens: usdAmount / 100
        // Since both USD and tokens use 18 decimals, this gives exact fractional tokens
        // Example: $50.75 swap = 50.75 * 10^18 / 100 = 0.5075 * 10^18 = 0.5075 tokens
        uint256 rewardTokens = usdAmount / 100;
        
        // Only mint if reward is meaningful (at least 0.001 token = $0.10 swap)
        require(rewardTokens >= 1e15, "Swap amount too small for reward");
        
        // Create new tokens and add to user's balance
        _totalSupply += rewardTokens;
        _balances[to] += rewardTokens;
        
        emit Transfer(address(0), to, rewardTokens);
        emit Mint(to, rewardTokens, "Swap Reward");
    }
    
    // Helper function for frontend: accepts USD as regular decimal number
    // Example: mintRewardForSwapSimple(userAddress, 100.5) for $100.50
    function mintRewardForSwapSimple(address to, uint256 usdCents) external onlyMinter {
        require(to != address(0), "Cannot mint to zero address");
        require(usdCents > 0, "USD amount must be positive");
        
        // Convert cents to wei format: $100.50 = 10050 cents = 10050 * 10^16 wei
        uint256 usdWei = usdCents * 1e16;
        
        // Calculate reward tokens: usdAmount / 100
        uint256 rewardTokens = usdWei / 100;
        
        // Only mint if reward is meaningful (at least 0.001 token = $0.10 swap)
        require(rewardTokens >= 1e15, "Swap amount too small for reward");
        
        // Create new tokens and add to user's balance
        _totalSupply += rewardTokens;
        _balances[to] += rewardTokens;
        
        emit Transfer(address(0), to, rewardTokens);
        emit Mint(to, rewardTokens, "Swap Reward");
    }
    
    // View function to calculate reward without minting (for previews)
    // Input: USD amount in cents (e.g., 10050 for $100.50)
    // Output: Token amount in wei format
    function calculateReward(uint256 usdCents) external pure returns (uint256) {
        uint256 usdWei = usdCents * 1e16;
        return usdWei / 100;
    }
    
    // View function to get human-readable token balance
    // Returns balance in readable format (e.g., 1.5 tokens = 1500000000000000000)
    function getReadableBalance(address account) external view returns (uint256) {
        return _balances[account];
    }
    
    // Function for users to spend tokens in our app
    // Tokens are transferred to the contract owner instead of being burned
    function spendTokens(uint256 amount, string memory itemName) external {
        require(_balances[msg.sender] >= amount, "Insufficient token balance");
        
        // Transfer tokens from user to owner
        _balances[msg.sender] -= amount;
        _balances[owner] += amount;
        
        emit Transfer(msg.sender, owner, amount);
        emit TokensSpent(msg.sender, amount, itemName);
    }
    
    // Function for users to transfer tokens to other users with a message
    function transferToUser(address to, uint256 amount, string memory message) external {
        require(to != address(0), "Cannot transfer to zero address");
        require(to != msg.sender, "Cannot transfer to yourself");
        require(_balances[msg.sender] >= amount, "Insufficient token balance");
        require(amount > 0, "Transfer amount must be positive");
        
        // Transfer tokens from sender to recipient
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        emit UserTransfer(msg.sender, to, amount, message);
    }
    
    // Admin function to change who can mint tokens
    function setMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "Cannot set zero address as minter");
        minter = newMinter;
    }
    
    // Internal transfer function
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(_balances[from] >= amount, "Insufficient balance");
        
        _balances[from] -= amount;
        _balances[to] += amount;
        
        emit Transfer(from, to, amount);
    }
}