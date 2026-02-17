import path from "path";
import fs from "fs";
import { ethers } from "ethers";

const BUILD_DIR = path.join(__dirname, "..", "build");

/**
 * Load a compiled contract artifact (ABI + bytecode) from the build/ directory.
 * Run `yarn compile` before running tests to generate artifacts.
 */
export function loadArtifact(contractName: string): {
  abi: ethers.InterfaceAbi;
  bytecode: string;
} {
  const abiPath = path.join(BUILD_DIR, "abi", `${contractName}.json`);
  const bytecodePath = path.join(BUILD_DIR, "bytecode", `${contractName}.bin`);

  if (!fs.existsSync(abiPath)) {
    throw new Error(
      `ABI not found for ${contractName}. Run "yarn compile" first.\n  Expected: ${abiPath}`
    );
  }

  if (!fs.existsSync(bytecodePath)) {
    throw new Error(
      `Bytecode not found for ${contractName}. Run "yarn compile" first.\n  Expected: ${bytecodePath}`
    );
  }

  const abi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
  const bytecode = fs.readFileSync(bytecodePath, "utf-8");

  return { abi, bytecode: "0x" + bytecode };
}

/**
 * Test environment: Hardhat JSON-RPC server + ethers.js v6.
 */
export interface TestEnv {
  provider: ethers.JsonRpcProvider;
  accounts: ethers.Signer[];
  server: { close: () => Promise<void> };
}

/**
 * Create a fresh in-memory EVM backed by Hardhat's EDR runtime.
 * Each test suite should call this in beforeAll and tear it down in afterAll.
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

/**
 * Deploy a compiled contract to the test EVM.
 */
export async function deploy(
  env: TestEnv,
  contractName: string,
  constructorArgs: unknown[] = [],
  value?: bigint
): Promise<ethers.Contract> {
  const { abi, bytecode } = loadArtifact(contractName);
  const deployer = env.accounts[0];

  const factory = new ethers.ContractFactory(abi, bytecode, deployer);
  const overrides = value ? { value } : {};
  const deployed = await factory.deploy(...constructorArgs, overrides);
  await deployed.waitForDeployment();

  const address = await deployed.getAddress();
  return new ethers.Contract(address, abi, deployer);
}

/**
 * Connect to a deployed contract from a different signer.
 */
export function connectAs(
  contract: ethers.Contract,
  signer: ethers.Signer
): ethers.Contract {
  return contract.connect(signer) as ethers.Contract;
}

/**
 * Get the ETH balance of an address.
 */
export async function getBalance(
  env: TestEnv,
  address: string
): Promise<bigint> {
  return env.provider.getBalance(address);
}
