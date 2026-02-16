import { ethers } from "ethers";
import { parse } from "../../src/compiler/parser";
import {
  generateSolidity,
  generateSolidityFile,
} from "../../src/compiler/codegen";
import { compileSolidity } from "../../src/compiler/solc";
import type { SkittlesConfig } from "../../src/types";

const defaultConfig: Required<SkittlesConfig> = {
  typeCheck: true,
  optimizer: { enabled: false, runs: 200 },
  contractsDir: "contracts",
  outputDir: "build",
};

// ============================================================
// Test environment: Hardhat JSON-RPC server + ethers.js v6
// ============================================================

export interface TestEnv {
  provider: ethers.JsonRpcProvider;
  accounts: ethers.Signer[];
  server: { close: () => Promise<void> };
}

/**
 * Create a fresh in-memory EVM backed by Hardhat's EDR runtime.
 * Starts a local JSON-RPC server and connects ethers.js to it.
 */
export async function createTestEnv(): Promise<TestEnv> {
  const { network } = await import("hardhat");
  const server = await network.createServer();
  const { address, port } = await server.listen();

  const provider = new ethers.JsonRpcProvider(`http://${address}:${port}`);

  const accounts: ethers.Signer[] = [];
  for (let i = 0; i < 10; i++) {
    accounts.push(await provider.getSigner(i));
  }

  return { provider, accounts, server };
}

// ============================================================
// Contract deployment: TypeScript source -> live EVM contract
// ============================================================

export interface DeployedContract {
  contract: ethers.Contract;
  address: string;
  abi: ethers.InterfaceAbi;
}

/**
 * Full pipeline: compile TypeScript source, deploy to the test EVM,
 * and return an ethers.js Contract instance ready for interaction.
 *
 * If the source contains multiple classes (e.g. for inheritance),
 * deploys the contract named `contractName`.
 */
export async function compileAndDeploy(
  env: TestEnv,
  source: string,
  contractName: string,
  constructorArgs: unknown[] = []
): Promise<DeployedContract> {
  const contracts = parse(source, "test.ts");
  if (contracts.length === 0) {
    throw new Error("No contracts found in source");
  }

  const solidity =
    contracts.length > 1
      ? generateSolidityFile(contracts)
      : generateSolidity(contracts[0]);

  const compiled = compileSolidity(contractName, solidity, defaultConfig);
  if (compiled.errors.length > 0) {
    throw new Error(
      `Solidity compilation failed:\n${compiled.errors.join("\n")}`
    );
  }

  if (!compiled.bytecode) {
    throw new Error(`No bytecode produced for ${contractName}`);
  }

  const deployer = env.accounts[0];
  const factory = new ethers.ContractFactory(
    compiled.abi,
    "0x" + compiled.bytecode,
    deployer
  );

  const deployed = await factory.deploy(...constructorArgs);
  await deployed.waitForDeployment();

  const address = await deployed.getAddress();
  const contract = new ethers.Contract(address, compiled.abi, deployer);

  return { contract, address, abi: compiled.abi };
}

/**
 * Connect to an already deployed contract from a different signer.
 * Useful for testing multi-account scenarios (e.g. account B calls transfer).
 */
export function connectAs(
  deployed: DeployedContract,
  signer: ethers.Signer
): ethers.Contract {
  return new ethers.Contract(deployed.address, deployed.abi, signer);
}
