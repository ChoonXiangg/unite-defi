// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// This is our reward token contract for the Unite DeFi app
// It's an ERC-20 token that can only be minted by authorized addresses
// Users earn these tokens when they perform swaps in our app

contract UniteRewardToken {
    // Token basic information
    string public name = "PGS Token";
    string public symbol = "PGS";
    uint8 public decimals = 18;
    uint256 private _totalSupply;
    
    // Balances mapping: address -> amount of tokens they own
    mapping(address => uint256) private _balances;
    
    // Allowances mapping: owner -> spender -> amount allowed to spend
    mapping(address => mapping(address => uint256)) private _allowances;
    
    // Access control
    address public owner;           // Contract owner (can change minter)
    address public minter;          // Address that can mint new tokens (our backend)
    bool public paused = false;     // Emergency pause mechanism
    
    // Dynamic pricing variables
    uint256 public totalUsdSwapped;        // Total USD swapped across all users (in wei format)
    uint256 public currentPriceMultiplier; // Current price multiplier (starts at 1, doubles every 100k USD)
    uint256 public constant HALVENING_THRESHOLD = 100000 * 1e18; // 100k USD in wei format
    uint256 public halveningCount;         // Number of halvenings that have occurred
    
    // Events - these are logged on the blockchain when things happen
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount, string reason);
    event TokensSpent(address indexed user, uint256 amount, string item);
    event UserTransfer(address indexed from, address indexed to, uint256 amount, string message);
    event Halvening(uint256 indexed halveningNumber, uint256 newPriceMultiplier, uint256 totalUsdSwapped);
    event SwapProcessed(address indexed user, uint256 usdAmount, uint256 tokensEarned, uint256 currentMultiplier);
    
    // Modifiers - these are like security checks
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    modifier onlyMinter() {
        require(msg.sender == minter || msg.sender == owner, "Not authorized to mint");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    // Constructor - runs once when contract is deployed
    constructor() {
        owner = msg.sender;           // Person who deploys becomes owner
        minter = msg.sender;          // Initially, owner can also mint
        currentPriceMultiplier = 100; // Start at 100 (means $100 per 1 PGS)
        totalUsdSwapped = 0;          // No swaps initially
        halveningCount = 0;           // No halvenings yet
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
    
    // This is the main function for generating/minting new tokens with dynamic pricing
    // Only the minter (our app backend) can call this
    // usdAmount should be in wei format (18 decimals) for precision
    // Example: $100.50 = 100.5 * 10^18 = 100500000000000000000
    function mintRewardForSwap(address to, uint256 usdAmount) external onlyMinter whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(usdAmount > 0, "USD amount must be positive");
        
        // Process swap in phases if it crosses halvening thresholds
        uint256 remainingUsdAmount = usdAmount;
        uint256 totalRewardTokens = 0;
        uint256 currentTotalSwapped = totalUsdSwapped;
        
        while (remainingUsdAmount > 0) {
            // Calculate how much USD we can process before next halvening
            uint256 nextHalveningAt = (halveningCount + 1) * HALVENING_THRESHOLD;
            uint256 usdUntilHalvening = nextHalveningAt - currentTotalSwapped;
            
            // Determine how much USD to process in this phase
            uint256 usdThisPhase = remainingUsdAmount;
            if (usdThisPhase > usdUntilHalvening) {
                usdThisPhase = usdUntilHalvening;
            }
            
            // Calculate tokens for this phase using current multiplier
            require(currentPriceMultiplier > 0, "Invalid price multiplier");
            uint256 tokensThisPhase = usdThisPhase / currentPriceMultiplier;
            totalRewardTokens += tokensThisPhase;
            
            // Update tracking variables
            currentTotalSwapped += usdThisPhase;
            remainingUsdAmount -= usdThisPhase;
            
            // Check if we need to trigger halvening
            if (currentTotalSwapped >= nextHalveningAt) {
                halveningCount++;
                require(currentPriceMultiplier <= type(uint256).max / 2, "Price multiplier overflow");
                currentPriceMultiplier *= 2;
                emit Halvening(halveningCount, currentPriceMultiplier, currentTotalSwapped);
            }
        }
        
        // Only mint if reward is meaningful (at least 0.001 token = minimum threshold)
        require(totalRewardTokens >= 1e15, "Swap amount too small for reward");
        
        // Update total USD swapped
        totalUsdSwapped = currentTotalSwapped;
        
        // Create new tokens and add to user's balance
        _totalSupply += totalRewardTokens;
        _balances[to] += totalRewardTokens;
        
        emit Transfer(address(0), to, totalRewardTokens);
        emit Mint(to, totalRewardTokens, "Dynamic Swap Reward");
        emit SwapProcessed(to, usdAmount, totalRewardTokens, currentPriceMultiplier);
    }
    
    // Helper function for frontend: accepts USD as regular decimal number with dynamic pricing
    // Example: mintRewardForSwapSimple(userAddress, 10050) for $100.50
    function mintRewardForSwapSimple(address to, uint256 usdCents) external onlyMinter whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(usdCents > 0, "USD amount must be positive");
        
        // Convert cents to wei format: $100.50 = 10050 cents = 10050 * 10^16 wei
        uint256 usdWei = usdCents * 1e16;
        
        // Process swap in phases if it crosses halvening thresholds (same logic as main function)
        uint256 remainingUsdAmount = usdWei;
        uint256 totalRewardTokens = 0;
        uint256 currentTotalSwapped = totalUsdSwapped;
        
        while (remainingUsdAmount > 0) {
            // Calculate how much USD we can process before next halvening
            uint256 nextHalveningAt = (halveningCount + 1) * HALVENING_THRESHOLD;
            uint256 usdUntilHalvening = nextHalveningAt - currentTotalSwapped;
            
            // Determine how much USD to process in this phase
            uint256 usdThisPhase = remainingUsdAmount;
            if (usdThisPhase > usdUntilHalvening) {
                usdThisPhase = usdUntilHalvening;
            }
            
            // Calculate tokens for this phase using current multiplier
            require(currentPriceMultiplier > 0, "Invalid price multiplier");
            uint256 tokensThisPhase = usdThisPhase / currentPriceMultiplier;
            totalRewardTokens += tokensThisPhase;
            
            // Update tracking variables
            currentTotalSwapped += usdThisPhase;
            remainingUsdAmount -= usdThisPhase;
            
            // Check if we need to trigger halvening
            if (currentTotalSwapped >= nextHalveningAt) {
                halveningCount++;
                require(currentPriceMultiplier <= type(uint256).max / 2, "Price multiplier overflow");
                currentPriceMultiplier *= 2;
                emit Halvening(halveningCount, currentPriceMultiplier, currentTotalSwapped);
            }
        }
        
        // Only mint if reward is meaningful (at least 0.001 token = minimum threshold)
        require(totalRewardTokens >= 1e15, "Swap amount too small for reward");
        
        // Update total USD swapped
        totalUsdSwapped = currentTotalSwapped;
        
        // Create new tokens and add to user's balance
        _totalSupply += totalRewardTokens;
        _balances[to] += totalRewardTokens;
        
        emit Transfer(address(0), to, totalRewardTokens);
        emit Mint(to, totalRewardTokens, "Dynamic Swap Reward (Simple)");
        emit SwapProcessed(to, usdWei, totalRewardTokens, currentPriceMultiplier);
    }
    
    // View function to calculate reward without minting (for previews) using current dynamic pricing
    // Input: USD amount in cents (e.g., 10050 for $100.50)
    // Output: Token amount in wei format
    function calculateReward(uint256 usdCents) external view returns (uint256) {
        uint256 usdWei = usdCents * 1e16;
        return usdWei / currentPriceMultiplier;
    }
    
    // View function to get current pricing information
    function getPricingInfo() external view returns (
        uint256 currentMultiplier,
        uint256 totalSwapped,
        uint256 nextHalveningAt,
        uint256 halvenings,
        uint256 tokensPerDollar
    ) {
        return (
            currentPriceMultiplier,
            totalUsdSwapped,
            (halveningCount + 1) * HALVENING_THRESHOLD,
            halveningCount,
            1e18 / currentPriceMultiplier // How many tokens per $1
        );
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
    
    
    // Emergency function to manually trigger halvening (only owner)
    function manualHalvening() external onlyOwner {
        halveningCount++;
        require(currentPriceMultiplier <= type(uint256).max / 2, "Price multiplier overflow");
        currentPriceMultiplier *= 2;
        
        emit Halvening(halveningCount, currentPriceMultiplier, totalUsdSwapped);
    }
    
    // Emergency pause/unpause functions
    function pause() external onlyOwner {
        paused = true;
    }
    
    function unpause() external onlyOwner {
        paused = false;
    }
    
    // Function to simulate total supply after certain USD amount is swapped
    function simulateTotalSupply(uint256 targetUsdSwapped) external view returns (uint256 estimatedSupply) {
        uint256 currentSupply = _totalSupply;
        uint256 currentSwapped = totalUsdSwapped;
        uint256 currentMultiplier = currentPriceMultiplier;
        uint256 currentHalvenings = halveningCount;
        
        // Simulate swapping until we reach target
        while (currentSwapped < targetUsdSwapped) {
            // Check if we need halvening
            uint256 expectedHalvenings = currentSwapped / HALVENING_THRESHOLD;
            if (currentHalvenings < expectedHalvenings) {
                currentHalvenings++;
                currentMultiplier *= 2;
            }
            
            // Calculate how much we can swap before next halvening
            uint256 nextHalveningAt = (currentHalvenings + 1) * HALVENING_THRESHOLD;
            uint256 swapUntilHalvening = nextHalveningAt - currentSwapped;
            uint256 actualSwapAmount = swapUntilHalvening;
            
            if (currentSwapped + swapUntilHalvening > targetUsdSwapped) {
                actualSwapAmount = targetUsdSwapped - currentSwapped;
            }
            
            // Add tokens that would be minted
            currentSupply += actualSwapAmount / currentMultiplier;
            currentSwapped += actualSwapAmount;
        }
        
        return currentSupply;
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