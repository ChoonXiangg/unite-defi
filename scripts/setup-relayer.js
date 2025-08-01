#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up 1inch LOP Relayer...');

// Create relayer directory if it doesn't exist
const relayerDir = path.join(__dirname, '../relayer');
if (!fs.existsSync(relayerDir)) {
    fs.mkdirSync(relayerDir, { recursive: true });
    console.log('📁 Created relayer directory');
}

// Install relayer dependencies
const { execSync } = require('child_process');

try {
    console.log('📦 Installing relayer dependencies...');
    process.chdir(relayerDir);
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Relayer dependencies installed');
} catch (error) {
    console.error('❌ Failed to install relayer dependencies:', error.message);
    process.exit(1);
}

// Create .env for relayer if it doesn't exist
const relayerEnvPath = path.join(relayerDir, '.env');
if (!fs.existsSync(relayerEnvPath)) {
    const mainEnvPath = path.join(__dirname, '../.env');
    if (fs.existsSync(mainEnvPath)) {
        fs.copyFileSync(mainEnvPath, relayerEnvPath);
        console.log('📋 Copied .env to relayer directory');
    }
}

console.log('🎉 Relayer setup completed!');
console.log('\n📝 Next steps:');
console.log('1. Update your .env file with proper API keys');
console.log('2. Deploy contracts: npm run deploy:sepolia');
console.log('3. Start relayer: npm run relayer:dev');
console.log('4. Test with API calls to http://localhost:3001');

process.chdir(path.join(__dirname, '..'));