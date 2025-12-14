import { createConfig } from "ponder";

// Import ABIs
import CarbonCreditTokenAbi from "./abis/CarbonCreditToken.json";
import GuardianNFTAbi from "./abis/GuardianNFT.json";
import CarbonOrderBookAbi from "./abis/CarbonOrderBook.json";
import CarbonPoolFactoryAbi from "./abis/CarbonPoolFactory.json";
import KYCServiceManagerAbi from "./abis/KYCServiceManager.json";

// Deployed contract addresses on Mantle Sepolia (Chain 5003)
const CARBON_TOKEN = "0xc4CebF58836707611439e23996f4FA4165Ea6A28" as const;
const GUARDIAN_NFT = "0xE1349D2c44422b70C73BF767AFB58ae1C59cd1Fd" as const;
const ORDER_BOOK = "0xc8d6B960CFe734452f2468A2E0a654C5C25Bb6b1" as const;
const KYC_SERVICE_MANAGER = "0xbDe5421D508C781c401E2af2101D74A23E39cBd6" as const;
const POOL_FACTORY = "0xAECB3a3a5b32161c77a67Fe5E1Ed89dDF0FC0884" as const;

// Start block for indexing (approximate deployment block)
const START_BLOCK = 18000000;

export default createConfig({
  chains: {
    mantleSepolia: {
      id: 5003,
      rpc: process.env.PONDER_RPC_URL_5003 || "https://rpc.sepolia.mantle.xyz",
    },
  },
  contracts: {
    CarbonCreditToken: {
      chain: "mantleSepolia",
      abi: CarbonCreditTokenAbi as any,
      address: CARBON_TOKEN,
      startBlock: START_BLOCK,
    },
    GuardianNFT: {
      chain: "mantleSepolia",
      abi: GuardianNFTAbi as any,
      address: GUARDIAN_NFT,
      startBlock: START_BLOCK,
    },
    CarbonOrderBook: {
      chain: "mantleSepolia",
      abi: CarbonOrderBookAbi as any,
      address: ORDER_BOOK,
      startBlock: START_BLOCK,
    },
    KYCServiceManager: {
      chain: "mantleSepolia",
      abi: KYCServiceManagerAbi as any,
      address: KYC_SERVICE_MANAGER,
      startBlock: START_BLOCK,
    },
    CarbonPoolFactory: {
      chain: "mantleSepolia",
      abi: CarbonPoolFactoryAbi as any,
      address: POOL_FACTORY,
      startBlock: START_BLOCK,
    },
    // Note: AMM Pool events are tracked via CarbonPoolFactory:PoolCreated
    // Individual pool indexing can be added later if needed
  },
});
