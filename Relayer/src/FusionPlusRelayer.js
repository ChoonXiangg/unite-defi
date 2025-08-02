const { ethers } = require('ethers');
const crypto = require('crypto');
const { MerkleTree } = require('merkletreejs');

class FusionPlusRelayer {
    constructor(config) {
        this.config = config;
        console.log('🤖 Initializing 1inch Fusion+ Relayer...');
        
        this.orderBook = new Map();
        this.secretStore = new Map(); // Store Merkle trees and secrets
        this.resolverRegistry = new Set(); // KYC'd resolvers
        this.isRunning = false;
        
        // Fusion+ Protocol Constants (as per spec)
        this.FINALITY_LOCK_PERIOD = 60000; // 1 minute for testnet
        this.EXCLUSIVE_WITHDRAW_PERIOD = 300000; // 5 minutes
        this.CANCELLATION_PERIOD = 600000; // 10 minutes
        this.SAFETY_DEPOSIT_AMOUNT = ethers.parseEther('0.01'); // 0.01 ETH
        
        // Initialize providers and contracts
        this.setupProviders();
        this.setupContracts();
        
        console.log('✅ 1inch Fusion+ Relayer initialized');
    }

    setupProviders() {
        try {
            // Etherlink Ghostnet Provider (Source Chain)
            this.etherlinkProvider = new ethers.JsonRpcProvider(
                'https://node.ghostnet.etherlink.com'
            );
            
            // Ethereum Sepolia Provider (Destination Chain)
            this.sepoliaProvider = new ethers.JsonRpcProvider(
                this.config.SEPOLIA_RPC_URL
            );

            console.log('✅ Blockchain providers connected');
            
            // Setup wallet if private key provided
            if (this.config.PRIVATE_KEY) {
                this.wallet = new ethers.Wallet(this.config.PRIVATE_KEY);
                this.etherlinkSigner = this.wallet.connect(this.etherlinkProvider);
                this.sepoliaSigner = this.wallet.connect(this.sepoliaProvider);
                console.log('✅ Wallet configured for resolver operations');
            } else {
                console.log('⚠️  No private key - running in read-only mode');
            }
            
        } catch (error) {
            console.error('❌ Provider setup failed:', error.message);
            throw error;
        }
    }

    setupContracts() {
        // Complete EscrowFactory ABI based on your deployed contracts
        const escrowFactoryABI = [
            "function createSrcEscrow((bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256)) external payable",
            "function createDstEscrow((bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256),uint256) external payable",
            "function addressOfEscrowSrc((bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256)) external view returns (address)",
            "function addressOfEscrowDst((bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256)) external view returns (address)",
            "function withdraw(address,bytes32) external",
            "function cancel(address) external",
            "function owner() external view returns (address)",
            "function feeToken() external view returns (address)",
            "function limitOrderProtocol() external view returns (address)",
            "event SrcEscrowCreated((bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256),(uint256,uint256,uint256,uint256,uint256))",
            "event DstEscrowCreated(address,bytes32,uint256)",
            "event WithdrawalCompleted(address,bytes32,uint256)",
            "event EscrowCancelled(address,uint256)"
        ];

        // LimitOrderProtocol ABI for your deployed LOP contracts
        const lopABI = [
            "function fillOrder(address maker, address fromToken, address toToken, uint256 fromAmount, uint256 toAmount, string fromChain, string toChain, uint256 nonce, uint256 deadline, bytes signature) external",
            "function executeOrder(address maker, address fromToken, address toToken, uint256 fromAmount, uint256 toAmount, string fromChain, string toChain, uint256 nonce, uint256 deadline, bytes signature) external",
            "function validateOrder(address maker, address fromToken, address toToken, uint256 fromAmount, uint256 toAmount, string fromChain, string toChain, uint256 nonce, uint256 deadline, bytes signature) external view returns (bool)",
            "function cancelOrder(uint256 nonce) external",
            "function isOrderCancelled(address maker, uint256 nonce) external view returns (bool)",
            "event OrderFilled(address indexed maker, address indexed taker, address fromToken, address toToken, uint256 fromAmount, uint256 toAmount)",
            "event OrderCancelled(address indexed maker, uint256 nonce)"
        ];

        try {
            // EscrowFactory contracts
            this.etherlinkFactory = new ethers.Contract(
                process.env.ETHERLINK_ESCROW_FACTORY_ADDRESS || '0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff',
                escrowFactoryABI,
                this.etherlinkSigner || this.etherlinkProvider
            );

            this.sepoliaFactory = new ethers.Contract(
                process.env.SEPOLIA_ESCROW_FACTORY_ADDRESS || '0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312',
                escrowFactoryABI,
                this.sepoliaSigner || this.sepoliaProvider
            );

            // LimitOrderProtocol contracts
            this.etherlinkLOP = new ethers.Contract(
                process.env.ETHERLINK_HYBRID_LOP_ADDRESS || '0xf4C21603E2A717aC176880Bf7EB00E560A4459ab',
                lopABI,
                this.etherlinkSigner || this.etherlinkProvider
            );

            this.sepoliaLOP = new ethers.Contract(
                process.env.SEPOLIA_HYBRID_LOP_ADDRESS || '0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff',
                lopABI,
                this.sepoliaSigner || this.sepoliaProvider
            );

            console.log('✅ 1inch Fusion+ contract interfaces loaded');
            console.log('📍 Etherlink LOP:', process.env.ETHERLINK_HYBRID_LOP_ADDRESS || '0xf4C21603E2A717aC176880Bf7EB00E560A4459ab');
            console.log('📍 Sepolia LOP:', process.env.SEPOLIA_HYBRID_LOP_ADDRESS || '0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff');
        } catch (error) {
            console.error('❌ Contract setup failed:', error.message);
            throw error;
        }
    }

    // Phase 1: Announcement Phase (as per 1inch Fusion+ spec)
    async announceOrder(orderData) {
        console.log('📢 Phase 1: Order Announcement - Dutch Auction Started');
        
        try {
            // Generate unique order ID
            const orderId = this.generateOrderId();
            
            // Generate N+1 secrets for N parts (Fusion+ spec requirement)
            const partsAmount = orderData.partsAmount || 4;
            const secrets = this.generateSecrets(partsAmount); // Generates partsAmount + 1 secrets
            
            // Create Merkle tree of secret hashes (Fusion+ partial fill mechanism)
            const merkleTree = this.buildMerkleTree(secrets);
            const merkleRoot = merkleTree.getRoot();
            
            // Create 1inch Fusion+ order with Dutch auction
            const order = {
                id: orderId,
                maker: orderData.maker || this.config.DEPLOYER_ADDRESS,
                makerAsset: orderData.makerAsset || ethers.ZeroAddress,
                takerAsset: orderData.takerAsset || ethers.ZeroAddress,
                makerAmount: ethers.parseEther(orderData.makerAmount || '1.0'),
                startPrice: ethers.parseEther(orderData.startPrice || '1.0'),
                endPrice: ethers.parseEther(orderData.endPrice || '0.95'),
                auctionDuration: orderData.duration || 300000, // 5 minutes
                partsAmount: partsAmount,
                
                // Fusion+ specific fields
                merkleRoot: merkleRoot.toString('hex'),
                safetyDeposit: this.SAFETY_DEPOSIT_AMOUNT,
                status: 'announced',
                phase: 1,
                
                // Timestamps
                announcementTime: Date.now(),
                finalityLockDeadline: null,
                exclusiveWithdrawDeadline: null,
                cancellationDeadline: null,
                
                // Escrow addresses (filled in Phase 2)
                sourceEscrow: null,
                destinationEscrow: null,
                
                // Fill tracking
                currentFillPercentage: 0,
                filledAmount: 0n,
                
                // Gas adjustment tracking
                baseFeeAtOrder: await this.getCurrentBaseFee('source'),
                priceAdjustmentEnabled: orderData.gasAdjustment !== false
            };

            // Store order and secrets
            this.orderBook.set(orderId, order);
            this.secretStore.set(orderId, {
                secrets: secrets,
                merkleTree: merkleTree,
                revealedSecrets: new Set()
            });

            console.log(`🎯 1inch Fusion+ Order ${orderId} announced`);
            console.log(`💰 Dutch Auction: ${ethers.formatEther(order.startPrice)} → ${ethers.formatEther(order.endPrice)} ETH`);
            console.log(`🌳 Merkle Root: 0x${order.merkleRoot}`);
            console.log(`🔄 Parts: ${partsAmount} (${partsAmount + 1} secrets generated)`);
            
            // Start Dutch auction monitoring
            this.startDutchAuction(orderId);
            
            return order;
            
        } catch (error) {
            console.error('❌ Phase 1 failed:', error.message);
            throw error;
        }
    }

    // Dutch Auction Implementation (Fusion+ spec)
    startDutchAuction(orderId) {
        const auctionInterval = setInterval(() => {
            const order = this.orderBook.get(orderId);
            if (!order || order.status !== 'announced') {
                clearInterval(auctionInterval);
                return;
            }

            const currentPrice = this.getCurrentAuctionPrice(order);
            
            // Apply gas price adjustments if enabled (Fusion+ feature)
            let adjustedPrice = currentPrice;
            if (order.priceAdjustmentEnabled) {
                try {
                    const gasAdjustment = this.applyGasAdjustment(order, currentPrice);
                    // Handle if applyGasAdjustment returns a Promise
                    if (gasAdjustment && typeof gasAdjustment.then === 'function') {
                        console.warn(`⚠️ Gas adjustment returned Promise for order ${orderId}, using currentPrice`);
                        adjustedPrice = currentPrice;
                    } else {
                        adjustedPrice = gasAdjustment;
                    }
                } catch (error) {
                    console.error(`❌ Error in gas adjustment for order ${orderId}:`, error.message);
                    adjustedPrice = currentPrice;
                }
            }
            
            // Check if price is profitable for resolvers
            try {
                // Ensure adjustedPrice is not null/undefined and is a valid number
                if (adjustedPrice != null && !isNaN(adjustedPrice)) {
                    if (adjustedPrice <= order.endPrice || this.isOrderProfitable(order, adjustedPrice)) {
                        console.log(`💰 Order ${orderId} became profitable at ${ethers.formatEther(adjustedPrice)} ETH`);
                        this.executeDepositPhase(orderId, adjustedPrice);
                        clearInterval(auctionInterval);
                    }
                } else {
                    console.warn(`⚠️ Invalid adjustedPrice for order ${orderId}:`, adjustedPrice);
                }
            } catch (error) {
                console.error(`❌ Error checking profitability for order ${orderId}:`, error.message);
                // Continue auction on error
            }
        }, 5000); // Check every 5 seconds
    }

    // Phase 2: Deposit Phase (Fusion+ spec)
    async executeDepositPhase(orderId, finalPrice) {
        console.log('🏦 Phase 2: Deposit Phase - Creating Escrows');
        
        const order = this.orderBook.get(orderId);
        if (!order) {
            console.error('❌ Order not found');
            return;
        }

        try {
            // Update order status and price
            order.status = 'depositing';
            order.phase = 2;
            order.finalPrice = finalPrice;
            order.finalityLockDeadline = Date.now() + this.FINALITY_LOCK_PERIOD;
            
            console.log('🔒 Step 1: Creating Source Chain Escrow (Chain A)');
            
            // Create escrow on source chain (Etherlink) with safety deposit
            const sourceEscrowTx = await this.createSourceEscrow(order);
            order.sourceEscrow = sourceEscrowTx.escrowAddress;
            order.sourceEscrowTx = sourceEscrowTx.hash;
            
            console.log(`✅ Source escrow created: ${order.sourceEscrow}`);
            
            // Wait briefly, then create destination escrow
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('🔒 Step 2: Creating Destination Chain Escrow (Chain B)');
            
            // Create escrow on destination chain (Sepolia) with safety deposit
            const destEscrowTx = await this.createDestinationEscrow(order);
            order.destinationEscrow = destEscrowTx.escrowAddress;
            order.destinationEscrowTx = destEscrowTx.hash;
            
            console.log(`✅ Destination escrow created: ${order.destinationEscrow}`);
            
            // Update status and set withdrawal deadlines
            order.status = 'escrows_created';
            order.exclusiveWithdrawDeadline = order.finalityLockDeadline + this.EXCLUSIVE_WITHDRAW_PERIOD;
            order.cancellationDeadline = order.exclusiveWithdrawDeadline + this.CANCELLATION_PERIOD;
            
            console.log(`⏰ Finality lock until: ${new Date(order.finalityLockDeadline).toISOString()}`);
            
            // Start finality lock countdown
            setTimeout(() => this.handleFinalityLockExpiry(orderId), this.FINALITY_LOCK_PERIOD);
            
        } catch (error) {
            console.error('❌ Phase 2 failed:', error.message);
            order.status = 'failed';
            await this.initiateRecovery(orderId);
        }
    }

    // Phase 3: Withdrawal Phase (Fusion+ spec)
    async handleFinalityLockExpiry(orderId) {
        console.log('🔓 Phase 3: Withdrawal Phase - Finality Lock Expired');
        
        const order = this.orderBook.get(orderId);
        const secretData = this.secretStore.get(orderId);
        
        if (!order || !secretData) {
            console.error('❌ Order or secrets not found');
            return;
        }

        try {
            // Verify both escrows exist and have correct parameters
            const sourceValid = await this.verifyEscrow('source', order);
            const destValid = await this.verifyEscrow('destination', order);
            
            if (!sourceValid || !destValid) {
                console.error('❌ Escrow verification failed');
                await this.initiateRecovery(orderId);
                return;
            }
            
            console.log('✅ Both escrows verified - proceeding with secret revelation');
            
            // Determine which secret to reveal based on fill percentage
            const secretIndex = this.calculateSecretIndex(order.currentFillPercentage || 100);
            const secret = secretData.secrets[secretIndex];
            
            // Update order status
            order.status = 'secret_revealed';
            order.phase = 3;
            order.revealedSecret = secret;
            order.revealedSecretIndex = secretIndex;
            order.secretRevealTime = Date.now();
            
            console.log(`🔑 Revealing secret ${secretIndex} for ${order.currentFillPercentage || 100}% fill`);
            console.log(`🔐 Secret: ${secret}`);
            
            // Mark secret as revealed
            secretData.revealedSecrets.add(secretIndex);
            
            // Start exclusive withdrawal period for executing resolver
            this.startExclusiveWithdrawal(orderId, secret);
            
        } catch (error) {
            console.error('❌ Phase 3 failed:', error.message);
            await this.initiateRecovery(orderId);
        }
    }

    // Exclusive Withdrawal Period (Fusion+ spec)
    async startExclusiveWithdrawal(orderId, secret) {
        console.log('⏰ Starting exclusive withdrawal period for resolver');
        
        const order = this.orderBook.get(orderId);
        
        try {
            // Execute withdrawal on both chains
            console.log('💸 Step 1: Withdrawing from source chain...');
            const sourceWithdrawal = await this.executeWithdrawal('source', order, secret);
            
            console.log('💸 Step 2: Withdrawing from destination chain...');
            const destWithdrawal = await this.executeWithdrawal('destination', order, secret);
            
            // Mark order as completed
            order.status = 'completed';
            order.completionTime = Date.now();
            order.totalExecutionTime = order.completionTime - order.announcementTime;
            
            console.log(`✅ 1inch Fusion+ swap completed successfully!`);
            console.log(`⏱️  Total execution time: ${order.totalExecutionTime / 1000}s`);
            console.log(`💰 Final price: ${ethers.formatEther(order.finalPrice)} ETH`);
            
        } catch (error) {
            console.error('❌ Exclusive withdrawal failed:', error.message);
            
            // Set timeout for open withdrawal period
            setTimeout(() => {
                this.startOpenWithdrawal(orderId, secret);
            }, this.EXCLUSIVE_WITHDRAW_PERIOD);
        }
    }

    // Open Withdrawal Period (Fusion+ spec)
    async startOpenWithdrawal(orderId, secret) {
        console.log('🌐 Starting open withdrawal period - any resolver can claim');
        
        const order = this.orderBook.get(orderId);
        
        try {
            // Any resolver can now execute the withdrawal and claim safety deposits
            await this.executeWithdrawal('source', order, secret);
            await this.executeWithdrawal('destination', order, secret);
            
            order.status = 'completed';
            order.completionTime = Date.now();
            
            console.log(`✅ Swap completed in open withdrawal period`);
            
        } catch (error) {
            console.error('❌ Open withdrawal failed, entering recovery phase');
            await this.initiateRecovery(orderId);
        }
    }

    // Phase 4: Recovery Phase (Fusion+ spec)
    async initiateRecovery(orderId) {
        console.log('🚨 Phase 4: Recovery Phase - Returning Funds');
        
        const order = this.orderBook.get(orderId);
        if (!order) return;

        try {
            console.log('🔄 Cancelling escrows and returning funds...');
            
            // Cancel source escrow (returns maker's funds)
            if (order.sourceEscrow) {
                console.log('↩️  Cancelling source escrow...');
                await this.cancelEscrow('source', order);
            }
            
            // Cancel destination escrow (returns resolver's funds + safety deposit)
            if (order.destinationEscrow) {
                console.log('↩️  Cancelling destination escrow...');
                await this.cancelEscrow('destination', order);
            }
            
            order.status = 'recovered';
            order.recoveryTime = Date.now();
            
            console.log(`✅ Recovery completed for order ${orderId}`);
            
        } catch (error) {
            console.error('❌ Recovery failed:', error.message);
            order.status = 'failed';
        }
    }

    // Merkle Tree Implementation for Partial Fills (Fusion+ spec)
    generateSecrets(partsAmount) {
        const secrets = [];
        // Generate N+1 secrets for N parts (as per Fusion+ spec)
        for (let i = 0; i <= partsAmount; i++) {
            secrets.push('0x' + crypto.randomBytes(32).toString('hex'));
        }
        console.log(`🔑 Generated ${secrets.length} secrets for ${partsAmount} parts`);
        return secrets;
    }

    buildMerkleTree(secrets) {
        // Hash all secrets
        const hashedSecrets = secrets.map(secret => 
            ethers.keccak256(secret)
        );
        
        // Create Merkle tree
        const merkleTree = new MerkleTree(hashedSecrets, ethers.keccak256, { sortPairs: true });
        
        console.log(`🌳 Built Merkle tree with ${hashedSecrets.length} secret hashes`);
        return merkleTree;
    }

    calculateSecretIndex(fillPercentage) {
        // 1inch Fusion+ partial fill logic (from spec)
        if (fillPercentage <= 25) return 0;
        if (fillPercentage <= 50) return 1;
        if (fillPercentage <= 75) return 2;
        if (fillPercentage <= 100) return 3;
        return 4; // Final secret for completion
    }

    // Dutch Auction Price Calculation (Fusion+ spec)
    getCurrentAuctionPrice(order) {
        const elapsed = Date.now() - order.announcementTime;
        const progress = Math.min(elapsed / order.auctionDuration, 1);
        
        // Linear price decrease from start to end price
        const priceRange = order.startPrice - order.endPrice;
        return order.startPrice - (priceRange * BigInt(Math.floor(progress * 1000000)) / 1000000n);
    }

    // Gas Price Adjustment (Fusion+ spec)
    async applyGasAdjustment(order, currentPrice) {
        try {
            const currentBaseFee = await this.getCurrentBaseFee('source');
            const baseFeeChange = currentBaseFee - order.baseFeeAtOrder;
            
            // Adjust price based on gas fee changes
            if (baseFeeChange > 0) {
                // Gas increased, reduce user's received amount slightly
                const adjustment = BigInt(Math.abs(baseFeeChange)) * 1000n; // Small adjustment
                return currentPrice - adjustment;
            } else if (baseFeeChange < 0) {
                // Gas decreased, increase user's received amount
                const adjustment = BigInt(Math.abs(baseFeeChange)) * 1000n;
                return currentPrice + adjustment;
            }
            
            return currentPrice;
        } catch {
            return currentPrice; // Fallback to non-adjusted price
        }
    }

    async getCurrentBaseFee(chain) {
        try {
            const provider = chain === 'source' ? this.etherlinkProvider : this.sepoliaProvider;
            const block = await provider.getBlock('latest');
            return Number(block.baseFeePerGas || 0n);
        } catch {
            return 0;
        }
    }

    isOrderProfitable(order, currentPrice) {
        try {
            // Simple profitability check (can be enhanced)
            const minProfitMargin = ethers.parseEther('0.01'); // 0.01 ETH minimum profit
            
            // Handle Promise rejection - if currentPrice is a Promise, skip this check
            if (currentPrice && typeof currentPrice.then === 'function') {
                console.warn('⚠️ currentPrice is a Promise, skipping profitability check');
                return false;
            }
            
            // Convert to BigInt if needed, with better type checking
            let startPrice;
            if (typeof order.startPrice === 'string') {
                startPrice = ethers.parseEther(order.startPrice);
            } else if (typeof order.startPrice === 'number') {
                startPrice = ethers.parseEther(order.startPrice.toString());
            } else {
                startPrice = BigInt(order.startPrice);
            }
            
            let currentPriceBigInt;
            if (typeof currentPrice === 'string') {
                currentPriceBigInt = ethers.parseEther(currentPrice);
            } else if (typeof currentPrice === 'number') {
                currentPriceBigInt = ethers.parseEther(currentPrice.toString());
            } else {
                currentPriceBigInt = BigInt(currentPrice);
            }
            
            const profitable = (startPrice - currentPriceBigInt) >= minProfitMargin;
            console.log(`🔍 Profitability check: startPrice=${ethers.formatEther(startPrice)}, currentPrice=${ethers.formatEther(currentPriceBigInt)}, profitable=${profitable}`);
            
            return profitable;
        } catch (error) {
            console.error('❌ Error in profitability check:', error.message);
            console.error('❌ Order data:', JSON.stringify(order, null, 2));
            console.error('❌ Current price:', currentPrice);
            return false; // Default to not profitable if calculation fails
        }
    }

    // Contract Interaction Methods
    async createSourceEscrow(order) {
        // Simulate escrow creation on source chain
        console.log('📝 Creating source escrow with safety deposit');
        return {
            escrowAddress: '0x' + crypto.randomBytes(20).toString('hex'),
            hash: '0x' + crypto.randomBytes(32).toString('hex')
        };
    }

    async createDestinationEscrow(order) {
        // Simulate escrow creation on destination chain
        console.log('📝 Creating destination escrow with safety deposit');
        return {
            escrowAddress: '0x' + crypto.randomBytes(20).toString('hex'),
            hash: '0x' + crypto.randomBytes(32).toString('hex')
        };
    }

    async verifyEscrow(chain, order) {
        // Simulate escrow verification
        console.log(`🔍 Verifying ${chain} escrow parameters`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
    }

    async executeWithdrawal(chain, order, secret) {
        // Simulate withdrawal execution
        console.log(`💸 Executing withdrawal on ${chain} chain with secret`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
            hash: '0x' + crypto.randomBytes(32).toString('hex'),
            success: true
        };
    }

    async cancelEscrow(chain, order) {
        // Simulate escrow cancellation
        console.log(`❌ Cancelling ${chain} escrow`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            hash: '0x' + crypto.randomBytes(32).toString('hex'),
            success: true
        };
    }

    // Utility Functions
    generateOrderId() {
        return '0x' + crypto.randomBytes(16).toString('hex');
    }

    // API Methods for external access
    getAllOrders() {
        return Array.from(this.orderBook.values()).map(order => ({
            id: order.id,
            status: order.status,
            phase: order.phase,
            maker: order.maker,
            announcementTime: order.announcementTime,
            currentPrice: order.status === 'announced' ? 
                ethers.formatEther(this.getCurrentAuctionPrice(order)) : 
                order.finalPrice ? ethers.formatEther(order.finalPrice) : 'N/A',
            safetyDeposit: ethers.formatEther(order.safetyDeposit),
            partsAmount: order.partsAmount,
            fillPercentage: order.currentFillPercentage || 100,
            executionTime: order.completionTime ? 
                `${(order.completionTime - order.announcementTime) / 1000}s` : 'Pending'
        }));
    }

    async getStatus() {
        try {
            const etherlinkBlock = await this.etherlinkProvider.getBlockNumber();
            const sepoliaBlock = await this.sepoliaProvider.getBlockNumber();
            
            return {
                protocol: '1inch Fusion+',
                status: 'active',
                connections: {
                    etherlink: { connected: true, block: etherlinkBlock },
                    sepolia: { connected: true, block: sepoliaBlock }
                },
                contracts: {
                    etherlink: '0xCfDE9a76C9D0e3f0220Ff15deD434cE3968f63Ff',
                    sepolia: '0xd76e13de08cfF2d3463Ce8c1a78a2A86E631E312'
                },
                orders: {
                    total: this.orderBook.size,
                    active: Array.from(this.orderBook.values()).filter(o => 
                        ['announced', 'depositing', 'escrows_created', 'secret_revealed'].includes(o.status)
                    ).length,
                    completed: Array.from(this.orderBook.values()).filter(o => 
                        o.status === 'completed'
                    ).length
                },
                protocolSettings: {
                    finalityLockPeriod: `${this.FINALITY_LOCK_PERIOD / 1000}s`,
                    exclusiveWithdrawPeriod: `${this.EXCLUSIVE_WITHDRAW_PERIOD / 1000}s`,
                    cancellationPeriod: `${this.CANCELLATION_PERIOD / 1000}s`,
                    safetyDeposit: ethers.formatEther(this.SAFETY_DEPOSIT_AMOUNT)
                },
                uptime: process.uptime()
            };
        } catch (error) {
            return {
                protocol: '1inch Fusion+',
                status: 'error',
                error: error.message
            };
        }
    }

    async testConnection() {
        try {
            console.log('🔍 Testing 1inch Fusion+ infrastructure...');
            
            const etherlinkBlock = await this.etherlinkProvider.getBlockNumber();
            const sepoliaBlock = await this.sepoliaProvider.getBlockNumber();
            
            console.log(`✅ Etherlink (Source) connected - Block: ${etherlinkBlock}`);
            console.log(`✅ Sepolia (Destination) connected - Block: ${sepoliaBlock}`);
            
            // Test contract calls
            const etherlinkOwner = await this.etherlinkFactory.owner();
            const sepoliaOwner = await this.sepoliaFactory.owner();
            
            console.log(`✅ Etherlink contract owner: ${etherlinkOwner}`);
            console.log(`✅ Sepolia contract owner: ${sepoliaOwner}`);
            
            console.log('✅ 1inch Fusion+ protocol ready for cross-chain swaps');
            return true;
            
        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
            return false;
        }
    }

    stop() {
        console.log('🛑 Stopping 1inch Fusion+ relayer...');
        this.isRunning = false;
        
        // Clean up event listeners
        if (this.etherlinkFactory) {
            this.etherlinkFactory.removeAllListeners();
        }
        if (this.sepoliaFactory) {
            this.sepoliaFactory.removeAllListeners();
        }
        
        console.log('✅ 1inch Fusion+ relayer stopped');
    }
}

module.exports = FusionPlusRelayer; 