const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LimitOrderProtocol", function () {
    let limitOrderProtocol;
    let escrowFactory;
    let oneInchIntegration;
    let owner;
    let resolver;
    let maker;
    let taker;
    let mockToken;

    beforeEach(async function () {
        [owner, resolver, maker, taker] = await ethers.getSigners();

        // Deploy mock ERC20 token
        const MockToken = await ethers.getContractFactory("MockERC20");
        mockToken = await MockToken.deploy("Test Token", "TEST", ethers.parseEther("1000000"));
        await mockToken.waitForDeployment();

        // Deploy EscrowFactory
        const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
        escrowFactory = await EscrowFactory.deploy();
        await escrowFactory.waitForDeployment();

        // Deploy OneInchIntegration
        const OneInchIntegration = await ethers.getContractFactory("OneInchIntegration");
        oneInchIntegration = await OneInchIntegration.deploy();
        await oneInchIntegration.waitForDeployment();

        // Deploy LimitOrderProtocol
        const LimitOrderProtocol = await ethers.getContractFactory("LimitOrderProtocol");
        limitOrderProtocol = await LimitOrderProtocol.deploy(await escrowFactory.getAddress());
        await limitOrderProtocol.waitForDeployment();

        // Authorize LOP in EscrowFactory
        await escrowFactory.setProtocolAuthorization(await limitOrderProtocol.getAddress(), true);

        // Authorize resolver
        await limitOrderProtocol.setResolverAuthorization(resolver.address, true);

        // Setup tokens for maker
        await mockToken.transfer(maker.address, ethers.parseEther("1000"));
        await mockToken.connect(maker).approve(await limitOrderProtocol.getAddress(), ethers.parseEther("1000"));
    });

    describe("Order Creation and Validation", function () {
        it("Should create and validate order hash correctly", async function () {
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress, // ETH
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            const orderHash = await limitOrderProtocol.getOrderHash(order);
            expect(orderHash).to.not.equal(ethers.ZeroHash);
        });

        it("Should validate order signature correctly", async function () {
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress,
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            const orderHash = await limitOrderProtocol.getOrderHash(order);
            const signature = await maker.signMessage(ethers.getBytes(orderHash));

            const isValid = await limitOrderProtocol.validateOrderSignature(order, signature);
            expect(isValid).to.be.true;
        });

        it("Should validate order conditions", async function () {
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress,
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            const isValid = await limitOrderProtocol.validateOrderConditions(order);
            expect(isValid).to.be.true;
        });
    });

    describe("Order Execution", function () {
        it("Should execute order successfully", async function () {
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress,
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            const orderHash = await limitOrderProtocol.getOrderHash(order);
            const signature = await maker.signMessage(ethers.getBytes(orderHash));

            // Execute order
            await expect(
                limitOrderProtocol.connect(resolver).executeOrder(order, signature, taker.address)
            ).to.emit(limitOrderProtocol, "OrderFilled");

            // Check order status
            const status = await limitOrderProtocol.getOrderStatus(orderHash);
            expect(status).to.equal(1); // Filled

            // Check escrow was created
            const escrowAddress = await limitOrderProtocol.getOrderEscrow(orderHash);
            expect(escrowAddress).to.not.equal(ethers.ZeroAddress);
        });

        it("Should fail with invalid signature", async function () {
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress,
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            const fakeSignature = await taker.signMessage("fake message");

            await expect(
                limitOrderProtocol.connect(resolver).executeOrder(order, fakeSignature, taker.address)
            ).to.be.revertedWith("LOP: Invalid signature");
        });

        it("Should fail with expired order", async function () {
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress,
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) - 3600, // Expired
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            const orderHash = await limitOrderProtocol.getOrderHash(order);
            const signature = await maker.signMessage(ethers.getBytes(orderHash));

            await expect(
                limitOrderProtocol.connect(resolver).executeOrder(order, signature, taker.address)
            ).to.be.revertedWith("LOP: Order conditions not met");
        });
    });

    describe("Order Cancellation", function () {
        it("Should allow maker to cancel order", async function () {
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress,
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            await expect(
                limitOrderProtocol.connect(maker).cancelOrder(order)
            ).to.emit(limitOrderProtocol, "OrderCancelled");

            const orderHash = await limitOrderProtocol.getOrderHash(order);
            const status = await limitOrderProtocol.getOrderStatus(orderHash);
            expect(status).to.equal(2); // Cancelled
        });

        it("Should not allow non-maker to cancel order", async function () {
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress,
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            await expect(
                limitOrderProtocol.connect(taker).cancelOrder(order)
            ).to.be.revertedWith("LOP: Only maker can cancel");
        });
    });

    describe("Access Control", function () {
        it("Should only allow authorized resolvers to execute orders", async function () {
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress,
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            const orderHash = await limitOrderProtocol.getOrderHash(order);
            const signature = await maker.signMessage(ethers.getBytes(orderHash));

            await expect(
                limitOrderProtocol.connect(taker).executeOrder(order, signature, taker.address)
            ).to.be.revertedWith("LOP: Unauthorized resolver");
        });

        it("Should allow owner to authorize/deauthorize resolvers", async function () {
            await expect(
                limitOrderProtocol.setResolverAuthorization(taker.address, true)
            ).to.emit(limitOrderProtocol, "ResolverAuthorized");

            // Now taker should be able to execute orders
            const order = {
                maker: maker.address,
                makerAsset: await mockToken.getAddress(),
                takerAsset: ethers.ZeroAddress,
                makerAmount: ethers.parseEther("100"),
                takerAmount: ethers.parseEther("1"),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                salt: 12345,
                makerAssetData: "0x",
                takerAssetData: "0x",
                predicate: "0x",
                permit: "0x",
                interaction: "0x"
            };

            const orderHash = await limitOrderProtocol.getOrderHash(order);
            const signature = await maker.signMessage(ethers.getBytes(orderHash));

            await expect(
                limitOrderProtocol.connect(taker).executeOrder(order, signature, taker.address)
            ).to.emit(limitOrderProtocol, "OrderFilled");
        });
    });
});

// Mock ERC20 contract for testing
const MockERC20 = {
    contractName: "MockERC20",
    abi: [
        "constructor(string memory name, string memory symbol, uint256 totalSupply)",
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function allowance(address owner, address spender) external view returns (uint256)"
    ],
    bytecode: "0x608060405234801561001057600080fd5b50..." // Simplified for example
};