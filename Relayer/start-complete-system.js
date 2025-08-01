#!/usr/bin/env node
require('dotenv').config();
const { spawn } = require('child_process');

/**
 * 🚀 Complete System Launcher
 * 
 * Starts the complete Unite DeFi system:
 * 1. Enhanced Relayer (1inch API + orderbook)
 * 2. Resolver Bot (order execution)
 * 3. Monitoring and health checks
 */
class CompleteSystemLauncher {
    constructor() {
        this.processes = [];
        this.isShuttingDown = false;
        
        // Handle graceful shutdown
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }

    async start() {
        console.log('🚀 Starting Complete Unite DeFi System...\n');
        
        try {
            // Check environment
            await this.checkEnvironment();
            
            // Start enhanced relayer
            console.log('📡 Starting Enhanced Relayer...');
            const relayer = this.startProcess('enhanced-relayer.js', 'RELAYER', '3001');
            this.processes.push(relayer);
            
            // Wait for relayer to start
            await this.sleep(5000);
            
            // Start resolver bot
            console.log('🤖 Starting Resolver Bot...');
            const resolver = this.startProcess('resolver-bot.js', 'RESOLVER-BOT');
            this.processes.push(resolver);
            
            console.log('\n✅ Complete system started successfully!');
            console.log('🌐 System URLs:');
            console.log('   📊 Relayer API: http://localhost:3001');
            console.log('   🔍 Health Check: http://localhost:3001/api/health');
            console.log('   📖 Orderbook: http://localhost:3001/api/orderbook');
            console.log('   🌐 WebSocket: ws://localhost:8080');
            console.log('\n🎯 ETHGlobal Unite Demo Ready!');
            console.log('   💰 Get Quote: GET /api/quote');
            console.log('   📝 Create Order: POST /api/orders');
            console.log('   🔐 Submit Secret: POST /api/orders/:id/secret');
            console.log('\nPress Ctrl+C to stop the system\n');
            
            // Keep alive and monitor
            this.startMonitoring();
            
        } catch (error) {
            console.error('❌ Failed to start system:', error);
            this.shutdown();
        }
    }

    async checkEnvironment() {
        console.log('🔍 Checking environment...');
        
        const required = [
            'PRIVATE_KEY',
            'SEPOLIA_RPC_URL',
            'ETHERLINK_TESTNET_RPC_URL',
            'SEPOLIA_HYBRID_LOP_ADDRESS',
            'ETHERLINK_HYBRID_LOP_ADDRESS'
        ];

        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        console.log('✅ Environment check passed');
        console.log('   Sepolia LOP:', process.env.SEPOLIA_HYBRID_LOP_ADDRESS);
        console.log('   Etherlink LOP:', process.env.ETHERLINK_HYBRID_LOP_ADDRESS);
    }

    startProcess(script, name, port = null) {
        const process = spawn('node', [script], {
            stdio: ['inherit', 'pipe', 'pipe'],
            env: { ...process.env, PROCESS_NAME: name }
        });

        // Handle process output
        process.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                const timestamp = new Date().toISOString().substring(11, 19);
                console.log(`[${timestamp}] [${name}] ${line}`);
            });
        });

        process.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                const timestamp = new Date().toISOString().substring(11, 19);
                console.error(`[${timestamp}] [${name}] ❌ ${line}`);
            });
        });

        process.on('close', (code) => {
            if (!this.isShuttingDown) {
                console.log(`[${name}] Process exited with code ${code}`);
                if (code !== 0) {
                    console.error(`[${name}] ❌ Process crashed, restarting in 5s...`);
                    setTimeout(() => {
                        if (!this.isShuttingDown) {
                            const newProcess = this.startProcess(script, name, port);
                            const index = this.processes.indexOf(process);
                            if (index > -1) {
                                this.processes[index] = newProcess;
                            }
                        }
                    }, 5000);
                }
            }
        });

        process.on('error', (error) => {
            console.error(`[${name}] ❌ Failed to start:`, error.message);
        });

        return process;
    }

    startMonitoring() {
        // Health check every 2 minutes
        setInterval(async () => {
            if (!this.isShuttingDown) {
                await this.healthCheck();
            }
        }, 120000);

        // Initial health check after 10 seconds
        setTimeout(() => this.healthCheck(), 10000);
    }

    async healthCheck() {
        try {
            const axios = require('axios');
            
            // Check relayer health
            const response = await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
            const health = response.data;
            
            console.log('🏥 System Health:');
            console.log(`   📊 Relayer: Healthy (${health.orderbook} orders, ${health.connectedResolvers} resolvers)`);
            console.log(`   🤖 Resolver Bot: ${this.processes.length >= 2 ? 'Running' : 'Stopped'}`);
            console.log(`   ⏱️  Uptime: ${Math.floor((Date.now() - this.startTime) / 60000)} minutes`);
            
        } catch (error) {
            console.log('⚠️  Health check failed - relayer may be starting up');
        }
    }

    async shutdown() {
        if (this.isShuttingDown) return;
        
        this.isShuttingDown = true;
        console.log('\n🛑 Shutting down complete system...');
        
        // Kill all processes
        for (const process of this.processes) {
            if (process && !process.killed) {
                process.kill('SIGTERM');
            }
        }
        
        // Wait for graceful shutdown
        await this.sleep(3000);
        
        // Force kill if needed
        for (const process of this.processes) {
            if (process && !process.killed) {
                process.kill('SIGKILL');
            }
        }
        
        console.log('✅ System shutdown complete');
        process.exit(0);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Start the complete system
if (require.main === module) {
    const launcher = new CompleteSystemLauncher();
    launcher.startTime = Date.now();
    launcher.start().catch(console.error);
}

module.exports = CompleteSystemLauncher;