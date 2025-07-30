const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GasStationExtension - Arbitrum Integration", function () {
  let gasStation;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    // Deploy with Arbitrum configuration (use defaults)
    const GasStationExtension = await ethers.getContractFactory("GasStationExtension");
    gasStation = await GasStationExtension.deploy(
      ethers.ZeroAddress, // Use ArbitrumConfig.AAVE_POOL
      ethers.ZeroAddress, // Use ArbitrumConfig.WETH  
      ethers.ZeroAddress  // Use ArbitrumConfig.INCH_LOP
    );
    await gasStation.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await gasStation.owner()).to.equal(owner.address);
    });

    it("Should return correct version", async function () {
      expect(await gasStation.version()).to.equal("1.2.0");
    });

    it("Should set correct Aave pool address", async function () {
      const expectedAavePool = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
      expect(await gasStation.getAavePool()).to.equal(expectedAavePool);
    });

    it("Should set correct WETH address", async function () {
      const expectedWETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
      expect(await gasStation.getWETH()).to.equal(expectedWETH);
    });

    it("Should set correct 1inch LOP address", async function () {
      const expected1inch = "0x111111125421cA6dc452d289314280a0f8842A65";
      expect(await gasStation.get1inchLOP()).to.equal(expected1inch);
    });
  });

  describe("Order Pair Management", function () {
    const orderHash1 = ethers.keccak256(ethers.toUtf8Bytes("arbitrum_order1"));
    const orderHash2 = ethers.keccak256(ethers.toUtf8Bytes("arbitrum_order2"));

    it("Should register order pairs correctly", async function () {
      await expect(gasStation.registerOrderPair(orderHash1, orderHash2))
        .to.emit(gasStation, "OrderPairRegistered")
        .withArgs(orderHash1, orderHash2);

      expect(await gasStation.registeredOrders(orderHash1)).to.be.true;
      expect(await gasStation.registeredOrders(orderHash2)).to.be.true;
      expect(await gasStation.orderPairs(orderHash1)).to.equal(orderHash2);
      expect(await gasStation.orderPairs(orderHash2)).to.equal(orderHash1);
    });

    it("Should check if order pair is ready", async function () {
      expect(await gasStation.isOrderPairReady(orderHash1)).to.be.false;
      
      await gasStation.registerOrderPair(orderHash1, orderHash2);
      expect(await gasStation.isOrderPairReady(orderHash1)).to.be.true;
      expect(await gasStation.isOrderPairReady(orderHash2)).to.be.true;
    });
  });

  describe("Token Support", function () {
    it("Should support native ETH", async function () {
      expect(await gasStation.isTokenSupported(ethers.ZeroAddress)).to.be.true;
    });

    it("Should support WETH", async function () {
      const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
      expect(await gasStation.isTokenSupported(wethAddress)).to.be.true;
    });

    it("Should support USDC", async function () {
      const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
      expect(await gasStation.isTokenSupported(usdcAddress)).to.be.true;
    });

    it("Should get supported tokens", async function () {
      const supportedTokens = await gasStation.getSupportedTokens();
      expect(supportedTokens.length).to.equal(6); // 5 tokens + native ETH
      expect(supportedTokens[0]).to.equal(ethers.ZeroAddress); // Native ETH should be first
    });
  });

  describe("Gas Estimation", function () {
    it("Should estimate gas cost correctly", async function () {
      const gasPrice = ethers.parseUnits("1", "gwei"); // 1 gwei
      const gasLimit = 260000; // Estimated for dual swap
      const expectedCost = gasPrice * BigInt(gasLimit);
      
      expect(await gasStation.estimateGasCost(gasPrice, gasLimit)).to.equal(expectedCost);
    });

    it("Should calculate realistic gas costs for Arbitrum", async function () {
      const arbitrumGasPrice = ethers.parseUnits("0.1", "gwei"); // 0.1 gwei typical for Arbitrum
      const dualSwapGas = 260000;
      const estimatedCost = await gasStation.estimateGasCost(arbitrumGasPrice, dualSwapGas);
      
      // Should be very cheap on Arbitrum (~$0.01)
      expect(Number(ethers.formatEther(estimatedCost))).to.be.lessThan(0.001);
    });
  });

  describe("1inch Integration", function () {
    it("Should have 1inch LOP address set", async function () {
      const inchAddress = await gasStation.get1inchLOP();
      expect(inchAddress).to.equal("0x111111125421cA6dc452d289314280a0f8842A65");
    });

    // Note: We can't test actual order execution without real orders and signatures
    // This would require integration with 1inch API to create valid orders
    it("Should accept order execution function exists", async function () {
      expect(gasStation.executePairedOrders).to.be.a('function');
    });

    it("Should have order validation function", async function () {
      expect(gasStation.validateOrder).to.be.a('function');
    });
  });

  describe("Flash Loan Integration", function () {
    it("Should have correct Aave pool configured", async function () {
      const aavePool = await gasStation.getAavePool();
      expect(aavePool).to.equal("0x794a61358D6845594F94dc1DB02A252b5b4814aD");
    });

    it("Should check flash loan state functions", async function () {
      const batchId = ethers.keccak256(ethers.toUtf8Bytes("test_batch"));
      expect(await gasStation.isFlashLoanActive(batchId)).to.be.false;
      
      // Only owner can reset flash loan state
      await gasStation.resetFlashLoanState(batchId);
      expect(await gasStation.isFlashLoanActive(batchId)).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("Should reject non-owner order pair registration", async function () {
      const orderHash1 = ethers.keccak256(ethers.toUtf8Bytes("test1"));
      const orderHash2 = ethers.keccak256(ethers.toUtf8Bytes("test2"));
      
      await expect(
        gasStation.connect(addr1).registerOrderPair(orderHash1, orderHash2)
      ).to.be.revertedWithCustomError(gasStation, "OwnableUnauthorizedAccount");
    });

    it("Should allow emergency token rescue by owner", async function () {
      // This function exists for emergency situations
      expect(gasStation.rescueTokens).to.be.a('function');
    });
  });
});