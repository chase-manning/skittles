/**
 * skittles/testing (core)
 *
 * Lower level testing utilities for Skittles projects.
 * Provides helpers to spin up an in memory EVM, deploy compiled contracts,
 * and interact with them using ethers.js v6.
 *
 * Most users should import from "skittles/testing" which provides the
 * higher level `setup()` function with automatic lifecycle management.
 *
 * Requirements for the core utilities (devDependencies in your project):
 *   - ethers ^6.0.0
 *   - hardhat ^3.0.0
 *
 * Additional tooling (used by the higher level ESM wrapper `"skittles/testing"`, not by this core module):
 *   - vitest ^2.0.0 (or another compatible test runner)
 */

import path from "path";
import fs from "fs";
import { ethers } from "ethers";

// ============================================================
// Types
// ============================================================

/**
 * A test environment backed by an in memory Hardhat EDR node.
 * Create one per test suite with `createTestEnv()`.
 */
export interface TestEnv {
  /** JSON RPC provider connected to the in memory EVM. */
  provider: ethers.JsonRpcProvider;
  /** Ten pre-funded signer accounts. */
  accounts: ethers.Signer[];
  /** Shut down the in memory EVM. Call this in afterAll. */
  close: () => Promise<void>;
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Preserve a real ESM dynamic import() even when compiled to CommonJS.
 * TypeScript converts `import()` to `require()` in CJS output, which
 * breaks ESM only packages like Hardhat v3. This helper sidesteps
 * that transformation.
 */
const importModule = new Function(
  "specifier",
  "return import(specifier)"
) as (specifier: string) => Promise<any>;

// ============================================================
// Environment setup
// ============================================================

/**
 * Create a fresh in memory EVM backed by Hardhat's EDR runtime.
 * Each test suite should call this once in `beforeAll` and tear it
 * down with `env.close()` in `afterAll`.
 *
 * ```ts
 * let env: TestEnv;
 * beforeAll(async () => { env = await createTestEnv(); });
 * afterAll(async () => { await env.close(); });
 * ```
 *
 * @param dynamicImport Optional custom import function. The ESM wrapper
 *   passes native import() here so it works inside vitest's runtime.
 */
export async function createTestEnv(
  dynamicImport: (specifier: string) => Promise<any> = importModule
): Promise<TestEnv> {
  const { network } = await dynamicImport("hardhat");
  const server = await network.createServer();
  const { address, port } = await server.listen();

  const provider = new ethers.JsonRpcProvider(`http://${address}:${port}`);

  const accounts: ethers.Signer[] = [];
  for (let i = 0; i < 10; i++) {
    accounts.push(await provider.getSigner(i));
  }

  return {
    provider,
    accounts,
    close: () => server.close(),
  };
}

// ============================================================
// Artifact loading
// ============================================================

/**
 * Load a compiled contract artifact (ABI + bytecode) from the build directory.
 * Defaults to `build/` relative to the current working directory.
 */
export function loadArtifact(
  contractName: string,
  buildDir?: string
): { abi: ethers.InterfaceAbi; bytecode: string } {
  const dir = buildDir ?? path.join(process.cwd(), "build");
  const abiPath = path.join(dir, "abi", `${contractName}.json`);
  const bytecodePath = path.join(dir, "bytecode", `${contractName}.bin`);

  if (!fs.existsSync(abiPath)) {
    throw new Error(
      `ABI not found for "${contractName}". Did you run "skittles test" (or "skittles compile") first?\n  Expected: ${abiPath}`
    );
  }

  if (!fs.existsSync(bytecodePath)) {
    throw new Error(
      `Bytecode not found for "${contractName}". Did you run "skittles test" (or "skittles compile") first?\n  Expected: ${bytecodePath}`
    );
  }

  const abi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
  const bytecode = fs.readFileSync(bytecodePath, "utf-8");

  return { abi, bytecode: "0x" + bytecode };
}

// ============================================================
// Deployment
// ============================================================

export interface DeployOptions {
  /** Override the build directory. Defaults to `build/` in the project root. */
  buildDir?: string;
  /** Send ETH with deployment (payable constructors). */
  value?: bigint;
  /** Index of the account to deploy from. Defaults to 0. */
  from?: number;
}

/**
 * Deploy a compiled Skittles contract to the test EVM.
 *
 * Automatically loads the ABI and bytecode from the build directory,
 * deploys the contract, and returns an ethers.js Contract instance.
 *
 * ```ts
 * const token = await deploy(env, "Token", [1_000_000n]);
 * expect(await token.name()).toBe("MyToken");
 * ```
 */
export async function deploy(
  env: TestEnv,
  contractName: string,
  constructorArgs: unknown[] = [],
  options: DeployOptions = {}
): Promise<ethers.Contract> {
  const { abi, bytecode } = loadArtifact(contractName, options.buildDir);
  const deployer = env.accounts[options.from ?? 0];

  const factory = new ethers.ContractFactory(abi, bytecode, deployer);
  const overrides = options.value ? { value: options.value } : {};
  const deployed = await factory.deploy(...constructorArgs, overrides);
  await deployed.waitForDeployment();

  const address = await deployed.getAddress();
  return new ethers.Contract(address, abi, deployer);
}

// ============================================================
// Utilities
// ============================================================

/**
 * Connect to a deployed contract from a different signer.
 * Useful for testing multi account scenarios.
 *
 * ```ts
 * const [, alice] = env.accounts;
 * const aliceToken = connectAs(token, alice);
 * await aliceToken.transfer(bobAddr, 100n);
 * ```
 */
export function connectAs(
  contract: ethers.Contract,
  signer: ethers.Signer
): ethers.Contract {
  return contract.connect(signer) as ethers.Contract;
}

/**
 * Get the ETH balance of an address.
 *
 * ```ts
 * const balance = await getBalance(env, aliceAddr);
 * ```
 */
export async function getBalance(
  env: TestEnv,
  address: string
): Promise<bigint> {
  return env.provider.getBalance(address);
}
