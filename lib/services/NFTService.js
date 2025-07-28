const NFTContractFactory = require('../contracts/NFTContractFactory');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class NFTService {
  constructor(evmProvider) {
    this.evmProvider = evmProvider;
    this.contractFactory = new NFTContractFactory();
    this.contractsDir = path.join(process.cwd(), 'data', 'nft-contracts');
    this.metadataDir = path.join(process.cwd(), 'data', 'nft-metadata');
    
    // Hardcoded deployed contract details
    this.deployedContract = {
      contractAddress: "0x176E38D94AD24022fDb813E8F3f3fe10Fde17249",
      name: "Unite DeFi NFT",
      symbol: "UNITE",
      description: "Unite DeFi NFT Collection",
      baseURI: "",
      owner: "0x7184B01a8A9ac24428bB8d3925701D151920C9Ce",
      network: "sepolia",
      deployedAt: "2025-07-28T11:04:00.885Z",
      royaltyReceiver: "0x7184B01a8A9ac24428bB8d3925701D151920C9Ce",
      royaltyFeeBps: 500,
      totalSupply: 0
    };
    
    this.ensureDirectories();
    this.saveDeployedContract();
  }

  ensureDirectories() {
    [this.contractsDir, this.metadataDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  saveDeployedContract() {
    this.saveContractInfo(this.deployedContract);
  }

  /**
   * Get the deployed contract info
   */
  getDeployedContract() {
    return { ...this.deployedContract };
  }

  /**
   * Mint a single NFT
   */
  async mintNFT(walletData, contractAddress, mintParams, network = 'sepolia') {
    try {
      const { recipient, name, description, image, attributes } = mintParams;
      
      // Validate inputs
      if (!recipient || !name) {
        throw new Error('Recipient address and NFT name are required');
      }

      // Create metadata
      const metadata = await this.createNFTMetadata({
        name,
        description: description || '',
        image: image || '',
        attributes: attributes || []
      });

      // Get wallet for minting
      const wallet = await this.evmProvider.getWallet(walletData.evm.privateKey, network);
      
      // Create contract instance
      const contract = this.contractFactory.createContractInstance(contractAddress, wallet);
      
      // Estimate gas
      const gasEstimate = await this.contractFactory.estimateMintGas(1);
      
      // Simulate minting transaction for demo
      const tokenId = Math.floor(Math.random() * 10000) + 1;
      const mockTxHash = crypto.randomBytes(32).toString('hex');
      
      const mintResult = {
        transactionHash: '0x' + mockTxHash,
        tokenId,
        recipient,
        metadata,
        gasUsed: gasEstimate,
        blockNumber: Math.floor(Math.random() * 1000000) + 5000000
      };

      // Save NFT info
      this.saveNFTInfo(contractAddress, tokenId, {
        ...mintResult,
        contractAddress,
        network,
        mintedAt: new Date().toISOString(),
        minter: wallet.address
      });

      // Update contract total supply
      this.updateContractSupply(contractAddress, 1);

      return mintResult;
    } catch (error) {
      throw new Error(`NFT minting failed: ${error.message}`);
    }
  }

  /**
   * Batch mint NFTs
   */
  async batchMintNFTs(walletData, contractAddress, batchMintParams, network = 'sepolia') {
    try {
      const { recipients, nftData } = batchMintParams;
      
      if (!recipients || !nftData || recipients.length !== nftData.length) {
        throw new Error('Recipients and NFT data arrays must have the same length');
      }

      if (recipients.length > 50) {
        throw new Error('Batch size cannot exceed 50 NFTs');
      }

      const wallet = await this.evmProvider.getWallet(walletData.evm.privateKey, network);
      const results = [];

      // Process each NFT in the batch
      for (let i = 0; i < recipients.length; i++) {
        const mintResult = await this.mintNFT(walletData, contractAddress, {
          recipient: recipients[i],
          ...nftData[i]
        }, network);
        
        results.push(mintResult);
      }

      return {
        batchSize: recipients.length,
        results,
        totalGasUsed: results.reduce((total, result) => total + result.gasUsed, 0)
      };
    } catch (error) {
      throw new Error(`Batch minting failed: ${error.message}`);
    }
  }

  /**
   * Create NFT metadata
   */
  async createNFTMetadata(metadata) {
    const { name, description, image, attributes, external_url } = metadata;
    
    const nftMetadata = {
      name,
      description,
      image,
      external_url: external_url || '',
      attributes: attributes || [],
      created_at: new Date().toISOString()
    };

    // Generate metadata ID
    const metadataId = crypto.randomBytes(16).toString('hex');
    
    // Save metadata to file (simulating IPFS)
    const metadataPath = path.join(this.metadataDir, `${metadataId}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(nftMetadata, null, 2));

    // Return metadata URI (in production, this would be IPFS URI)
    const metadataURI = `${process.env.BASE_URL || 'http://localhost:3000'}/api/nft/metadata/${metadataId}`;
    
    return {
      metadataId,
      metadataURI,
      metadata: nftMetadata
    };
  }

  /**
   * Get NFT metadata by ID
   */
  getNFTMetadata(metadataId) {
    const metadataPath = path.join(this.metadataDir, `${metadataId}.json`);
    
    if (!fs.existsSync(metadataPath)) {
      throw new Error('Metadata not found');
    }

    const metadataContent = fs.readFileSync(metadataPath, 'utf8');
    return JSON.parse(metadataContent);
  }

  /**
   * Get contract information
   */
  getContractInfo(contractAddress) {
    const contractPath = path.join(this.contractsDir, `${contractAddress}.json`);
    
    if (!fs.existsSync(contractPath)) {
      throw new Error('Contract not found');
    }

    const contractData = fs.readFileSync(contractPath, 'utf8');
    return JSON.parse(contractData);
  }

  /**
   * Get all contracts deployed by a user
   */
  getUserContracts(userAddress) {
    // Always return the deployed contract for any user
    return [this.deployedContract];
  }

  /**
   * Get NFTs in a contract
   */
  getContractNFTs(contractAddress) {
    const nftsDir = path.join(this.contractsDir, 'nfts', contractAddress);
    
    if (!fs.existsSync(nftsDir)) {
      return [];
    }

    const nftFiles = fs.readdirSync(nftsDir).filter(file => file.endsWith('.json'));
    const nfts = [];

    for (const file of nftFiles) {
      try {
        const nftData = JSON.parse(
          fs.readFileSync(path.join(nftsDir, file), 'utf8')
        );
        nfts.push(nftData);
      } catch (error) {
        console.warn(`Error reading NFT file ${file}:`, error);
      }
    }

    return nfts.sort((a, b) => a.tokenId - b.tokenId);
  }

  /**
   * Get NFTs owned by a user
   */
  getUserNFTs(userAddress, contractAddress = null) {
    const userNFTs = [];
    
    if (contractAddress) {
      // Get NFTs from specific contract
      const contractNFTs = this.getContractNFTs(contractAddress);
      return contractNFTs.filter(nft => 
        nft.recipient.toLowerCase() === userAddress.toLowerCase()
      );
    } else {
      // Get NFTs from all contracts
      const contractFiles = fs.readdirSync(this.contractsDir).filter(file => file.endsWith('.json'));
      
      for (const file of contractFiles) {
        const contractAddress = file.replace('.json', '');
        const contractNFTs = this.getContractNFTs(contractAddress);
        const ownedNFTs = contractNFTs.filter(nft => 
          nft.recipient.toLowerCase() === userAddress.toLowerCase()
        );
        userNFTs.push(...ownedNFTs);
      }
    }

    return userNFTs.sort((a, b) => new Date(b.mintedAt) - new Date(a.mintedAt));
  }

  /**
   * Save contract information
   */
  saveContractInfo(contractInfo) {
    const contractPath = path.join(this.contractsDir, `${contractInfo.contractAddress}.json`);
    fs.writeFileSync(contractPath, JSON.stringify(contractInfo, null, 2));
  }

  /**
   * Save NFT information
   */
  saveNFTInfo(contractAddress, tokenId, nftInfo) {
    const nftsDir = path.join(this.contractsDir, 'nfts', contractAddress);
    
    if (!fs.existsSync(nftsDir)) {
      fs.mkdirSync(nftsDir, { recursive: true });
    }

    const nftPath = path.join(nftsDir, `${tokenId}.json`);
    fs.writeFileSync(nftPath, JSON.stringify(nftInfo, null, 2));
  }

  /**
   * Update contract total supply
   */
  updateContractSupply(contractAddress, increment) {
    try {
      const contractInfo = this.getContractInfo(contractAddress);
      contractInfo.totalSupply = (contractInfo.totalSupply || 0) + increment;
      contractInfo.updatedAt = new Date().toISOString();
      this.saveContractInfo(contractInfo);
    } catch (error) {
      console.warn('Failed to update contract supply:', error);
    }
  }

}

module.exports = NFTService;