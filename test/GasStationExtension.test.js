const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GasStationExtension", function () {
  let gasStation;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const GasStationExtension = await ethers.getContractFactory("GasStationExtension");
    gasStation = await GasStationExtension.deploy();
    await gasStation.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await gasStation.owner()).to.equal(owner.address);
    });

    it("Should emit GasStationInitialized event", async function () {
      const GasStationExtension = await ethers.getContractFactory("GasStationExtension");
      const newGasStation = await GasStationExtension.deploy();
      
      await expect(newGasStation.deploymentTransaction())
        .to.emit(newGasStation, "GasStationInitialized")
        .withArgs(owner.address);
    });

    it("Should return correct version", async function () {
      expect(await gasStation.version()).to.equal("1.0.0");
    });
  });

  describe("Order Pair Management", function () {
    const orderHash1 = ethers.keccak256(ethers.toUtf8Bytes("order1"));
    const orderHash2 = ethers.keccak256(ethers.toUtf8Bytes("order2"));

    it("Should register order pairs correctly", async function () {
      await expect(gasStation.registerOrderPair(orderHash1, orderHash2))
        .to.emit(gasStation, "OrderPairRegistered")
        .withArgs(orderHash1, orderHash2);

      expect(await gasStation.registeredOrders(orderHash1)).to.be.true;
      expect(await gasStation.registeredOrders(orderHash2)).to.be.true;
      expect(await gasStation.orderPairs(orderHash1)).to.equal(orderHash2);
      expect(await gasStation.orderPairs(orderHash2)).to.equal(orderHash1);
    });

    it("Should not allow non-owner to register order pairs", async function () {
      await expect(
        gasStation.connect(addr1).registerOrderPair(orderHash1, orderHash2)
      ).to.be.revertedWithCustomError(gasStation, "OwnableUnauthorizedAccount");
    });

    it("Should not allow duplicate order registration", async function () {
      await gasStation.registerOrderPair(orderHash1, orderHash2);
      
      const orderHash3 = ethers.keccak256(ethers.toUtf8Bytes("order3"));
      await expect(
        gasStation.registerOrderPair(orderHash1, orderHash3)
      ).to.be.revertedWith("Order1 already registered");
    });

    it("Should not allow pairing order with itself", async function () {
      await expect(
        gasStation.registerOrderPair(orderHash1, orderHash1)
      ).to.be.revertedWith("Cannot pair order with itself");
    });

    it("Should check if order pair is ready", async function () {
      expect(await gasStation.isOrderPairReady(orderHash1)).to.be.false;
      
      await gasStation.registerOrderPair(orderHash1, orderHash2);
      expect(await gasStation.isOrderPairReady(orderHash1)).to.be.true;
      expect(await gasStation.isOrderPairReady(orderHash2)).to.be.true;
    });

    it("Should get counterpart order correctly", async function () {
      await gasStation.registerOrderPair(orderHash1, orderHash2);
      
      expect(await gasStation.getCounterpartOrder(orderHash1)).to.equal(orderHash2);
      expect(await gasStation.getCounterpartOrder(orderHash2)).to.equal(orderHash1);
    });

    it("Should revert when getting counterpart for unregistered order", async function () {
      await expect(
        gasStation.getCounterpartOrder(orderHash1)
      ).to.be.revertedWith("Order not registered");
    });

    it("Should mark pair as completed", async function () {
      await gasStation.registerOrderPair(orderHash1, orderHash2);
      await gasStation.markPairCompleted(orderHash1);
      
      expect(await gasStation.completedPairs(orderHash1)).to.be.true;
      expect(await gasStation.completedPairs(orderHash2)).to.be.true;
      expect(await gasStation.isOrderPairReady(orderHash1)).to.be.false;
    });

    it("Should reset order pair", async function () {
      await gasStation.registerOrderPair(orderHash1, orderHash2);
      await gasStation.resetOrderPair(orderHash1);
      
      expect(await gasStation.registeredOrders(orderHash1)).to.be.false;
      expect(await gasStation.registeredOrders(orderHash2)).to.be.false;
      expect(await gasStation.completedPairs(orderHash1)).to.be.false;
      expect(await gasStation.completedPairs(orderHash2)).to.be.false;
    });
  });

  describe("Constants", function () {
    it("Should have correct fee basis points", async function () {
      expect(await gasStation.GAS_STATION_FEE_BASIS_POINTS()).to.equal(10); // 0.1%
    });

    it("Should have correct max gas price", async function () {
      expect(await gasStation.MAX_GAS_PRICE()).to.equal(ethers.parseUnits("50", "gwei"));
    });
  });
});