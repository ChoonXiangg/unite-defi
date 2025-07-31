/**
 * 1inch API Integration Service
 * Provides gasless swap functionality using 1inch APIs
 */

const axios = require('axios');

class OneInchAPI {
    constructor(apiKey, chainId = 42161) {
        this.apiKey = apiKey;
        this.chainId = chainId; // Arbitrum mainnet
        this.baseURL = 'https://api.1inch.dev';
        
        // API client with authentication
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });
        
        // Request interceptor for logging
        this.client.interceptors.request.use(
            (config) => {
                console.log(`🔄 1inch API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => Promise.reject(error)
        );
        
        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => {
                console.log(`✅ 1inch API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                console.error(`❌ 1inch API Error: ${error.response?.status} ${error.response?.data?.error || error.message}`);
                return Promise.reject(error);
            }
        );
    }
    
    /**
     * Get quote for token swap
     * @param {string} fromToken - From token address
     * @param {string} toToken - To token address  
     * @param {string} amount - Amount to swap (in wei)
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Quote data
     */
    async getQuote(fromToken, toToken, amount, options = {}) {
        try {
            const params = {
                fromTokenAddress: fromToken,
                toTokenAddress: toToken,
                amount: amount,
                includeProtocols: true,
                includeGas: true,
                ...options
            };
            
            const response = await this.client.get(`/swap/v6.0/${this.chainId}/quote`, { params });
            
            return {
                success: true,
                data: response.data,
                fromAmount: response.data.fromAmount,
                toAmount: response.data.toAmount,
                estimatedGas: response.data.estimatedGas,
                protocols: response.data.protocols
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    /**
     * Get swap transaction data
     * @param {string} fromToken - From token address
     * @param {string} toToken - To token address
     * @param {string} amount - Amount to swap
     * @param {string} fromAddress - User's wallet address
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Swap transaction data
     */
    async getSwap(fromToken, toToken, amount, fromAddress, options = {}) {
        try {
            const params = {
                fromTokenAddress: fromToken,
                toTokenAddress: toToken,
                amount: amount,
                fromAddress: fromAddress,
                slippage: options.slippage || 1, // 1% default
                disableEstimate: false,
                allowPartialFill: false,
                ...options
            };
            
            const response = await this.client.get(`/swap/v6.0/${this.chainId}/swap`, { params });
            
            return {
                success: true,
                data: response.data,
                tx: response.data.tx,
                toAmount: response.data.toAmount,
                protocols: response.data.protocols
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    /**
     * Get approval transaction data
     * @param {string} tokenAddress - Token to approve
     * @param {string} amount - Amount to approve (optional, defaults to unlimited)
     * @returns {Promise<Object>} Approval transaction data
     */
    async getApproval(tokenAddress, amount = null) {
        try {
            const params = {
                tokenAddress: tokenAddress
            };
            
            if (amount) {
                params.amount = amount;
            }
            
            const response = await this.client.get(`/swap/v6.0/${this.chainId}/approve/transaction`, { params });
            
            return {
                success: true,
                data: response.data,
                tx: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    /**
     * Get supported tokens
     * @returns {Promise<Object>} List of supported tokens
     */
    async getTokens() {
        try {
            const response = await this.client.get(`/swap/v6.0/${this.chainId}/tokens`);
            
            return {
                success: true,
                data: response.data,
                tokens: response.data.tokens || response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    /**
     * Get supported protocols
     * @returns {Promise<Object>} List of supported protocols
     */
    async getProtocols() {
        try {
            const response = await this.client.get(`/swap/v6.0/${this.chainId}/protocols`);
            
            return {
                success: true,
                data: response.data,
                protocols: response.data.protocols || response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    /**
     * Submit limit order to 1inch orderbook
     * @param {Object} order - 1inch limit order
     * @param {string} signature - Order signature
     * @returns {Promise<Object>} Order submission result
     */
    async submitLimitOrder(order, signature) {
        try {
            const payload = {
                ...order,
                signature
            };
            
            const response = await this.client.post(`/orderbook/v4.0/${this.chainId}/order`, payload);
            
            return {
                success: true,
                data: response.data,
                orderHash: response.data.orderHash
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    /**
     * Get order status from orderbook
     * @param {string} orderHash - Order hash to check
     * @returns {Promise<Object>} Order status
     */
    async getOrderStatus(orderHash) {
        try {
            const response = await this.client.get(`/orderbook/v4.0/${this.chainId}/order/${orderHash}`);
            
            return {
                success: true,
                data: response.data,
                status: response.data.status,
                remainingAmount: response.data.remainingAmount
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    /**
     * Cancel limit order
     * @param {string} orderHash - Order hash to cancel
     * @returns {Promise<Object>} Cancellation result
     */
    async cancelOrder(orderHash) {
        try {
            const response = await this.client.delete(`/orderbook/v4.0/${this.chainId}/order/${orderHash}`);
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    /**
     * Get best swap route with detailed breakdown
     * @param {string} fromToken - From token address
     * @param {string} toToken - To token address
     * @param {string} amount - Amount to swap
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Best route with protocol breakdown
     */
    async getBestRoute(fromToken, toToken, amount, options = {}) {
        const quote = await this.getQuote(fromToken, toToken, amount, {
            includeProtocols: true,
            includeGas: true,
            ...options
        });
        
        if (!quote.success) {
            return quote;
        }
        
        return {
            success: true,
            route: {
                fromToken,
                toToken,
                fromAmount: quote.data.fromAmount,
                toAmount: quote.data.toAmount,
                protocols: quote.data.protocols,
                estimatedGas: quote.data.estimatedGas,
                gasPrice: quote.data.gasPrice,
                liquiditySources: this._extractLiquiditySources(quote.data.protocols)
            }
        };
    }
    
    /**
     * Execute gasless swap using aggregation
     * @param {Object} swapParams - Swap parameters
     * @returns {Promise<Object>} Execution result
     */
    async executeGaslessSwap(swapParams) {
        const { fromToken, toToken, amount, userAddress, minToAmount } = swapParams;
        
        try {
            // 1. Get best quote
            const quote = await this.getQuote(fromToken, toToken, amount);
            if (!quote.success) {
                throw new Error(`Quote failed: ${quote.error}`);
            }
            
            // 2. Check if output meets minimum
            if (quote.data.toAmount < minToAmount) {
                throw new Error(`Insufficient output: ${quote.data.toAmount} < ${minToAmount}`);
            }
            
            // 3. Get swap transaction data
            const swap = await this.getSwap(fromToken, toToken, amount, userAddress, {
                slippage: 1, // 1% slippage
                disableEstimate: false
            });
            
            if (!swap.success) {
                throw new Error(`Swap preparation failed: ${swap.error}`);
            }
            
            return {
                success: true,
                txData: swap.tx,
                expectedOutput: swap.toAmount,
                protocols: swap.protocols,
                gasEstimate: quote.data.estimatedGas
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Extract liquidity sources from protocols data
     * @param {Array} protocols - Protocols data from 1inch
     * @returns {Array} Simplified liquidity sources
     * @private
     */
    _extractLiquiditySources(protocols) {
        if (!protocols || !Array.isArray(protocols)) return [];
        
        return protocols.map(protocol => ({
            name: protocol.name,
            part: protocol.part,
            fromTokenAddress: protocol.fromTokenAddress,
            toTokenAddress: protocol.toTokenAddress
        }));
    }
    
    /**
     * Health check for 1inch API
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        try {
            const tokens = await this.getTokens();
            const protocols = await this.getProtocols();
            
            return {
                success: true,
                status: 'healthy',
                tokensAvailable: tokens.success,
                protocolsAvailable: protocols.success,
                chainId: this.chainId,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                status: 'unhealthy',
                error: error.message,
                chainId: this.chainId,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = OneInchAPI;