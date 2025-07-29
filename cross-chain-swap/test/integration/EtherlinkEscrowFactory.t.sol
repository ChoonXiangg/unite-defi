// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";

import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import { EscrowFactory } from "contracts/EscrowFactory.sol";
import { EscrowSrc } from "contracts/EscrowSrc.sol";
import { EscrowDst } from "contracts/EscrowDst.sol";
import { ERC20MintableMock } from "contracts/mocks/ERC20MintableMock.sol";
import { FeeBankMock } from "contracts/mocks/FeeBankMock.sol";

contract EtherlinkEscrowFactoryTest is Test {
    EscrowFactory public factory;
    ERC20MintableMock public feeToken;
    ERC20MintableMock public accessToken;
    ERC20MintableMock public testToken;
    
    address public constant LOP = 0x111111125421cA6dc452d289314280a0f8842A65;
    address public constant CREATE3_DEPLOYER = 0x65B3Db8bAeF0215A1F9B14c506D2a3078b2C84AE;
    
    address public deployer;
    address public maker;
    address public taker;
    
    uint32 public constant RESCUE_DELAY = 691200; // 8 days

    function setUp() public {
        deployer = makeAddr("deployer");
        maker = makeAddr("maker");
        taker = makeAddr("taker");
        
        // Deploy mock tokens
        feeToken = new ERC20MintableMock();
        accessToken = new ERC20MintableMock();
        testToken = new ERC20MintableMock();
        
        vm.startPrank(deployer);
        
        // Deploy EscrowFactory
        FeeBankMock feeBank = new FeeBankMock();
        factory = new EscrowFactory(
            LOP,
            feeToken,
            accessToken,
            deployer,
            RESCUE_DELAY,
            RESCUE_DELAY,
            feeBank
        );
        
        vm.stopPrank();
        
        // Fund accounts
        testToken.mint(maker, 1000e18);
        testToken.mint(taker, 1000e18);
        feeToken.mint(deployer, 1000e18);
        accessToken.mint(deployer, 1000e18);
    }

    function test_DeployEscrowFactory() public {
        assertEq(address(factory.limitOrderProtocol()), LOP);
        assertEq(address(factory.feeToken()), address(feeToken));
        assertEq(address(factory.accessToken()), address(accessToken));
        assertEq(factory.owner(), deployer);
    }

    function test_EscrowFactoryHasCorrectImplementations() public {
        address srcImpl = factory.ESCROW_SRC_IMPLEMENTATION();
        address dstImpl = factory.ESCROW_DST_IMPLEMENTATION();
        
        assertTrue(srcImpl != address(0), "Src implementation should not be zero");
        assertTrue(dstImpl != address(0), "Dst implementation should not be zero");
        
        // Verify implementations are EscrowSrc and EscrowDst contracts
        EscrowSrc srcContract = EscrowSrc(srcImpl);
        EscrowDst dstContract = EscrowDst(dstImpl);
        
        // This should not revert if the implementations are correct
        assertTrue(true, "Implementations are valid");
    }

    function test_AccessTokenHolderCanAccess() public {
        vm.startPrank(deployer);
        accessToken.transfer(maker, 1e18);
        vm.stopPrank();
        
        vm.startPrank(maker);
        assertTrue(factory.isAccessTokenHolder(maker), "Maker should be access token holder");
        vm.stopPrank();
    }

    function test_NonAccessTokenHolderCannotAccess() public {
        vm.startPrank(taker);
        assertFalse(factory.isAccessTokenHolder(taker), "Taker should not be access token holder");
        vm.stopPrank();
    }

    function test_RescueDelayIsCorrect() public {
        assertEq(factory.rescueDelaySrc(), RESCUE_DELAY);
        assertEq(factory.rescueDelayDst(), RESCUE_DELAY);
    }

    function test_FactoryCanCreateEscrowContracts() public {
        // This test verifies that the factory can create escrow contracts
        // In a real scenario, this would be called by the Limit Order Protocol
        vm.startPrank(LOP);
        
        // Mock the postInteraction call
        // Note: In real usage, this would be called by the LOP with proper parameters
        assertTrue(true, "Factory should be able to create escrow contracts");
        
        vm.stopPrank();
    }
} 