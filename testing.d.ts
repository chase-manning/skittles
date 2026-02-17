import { ethers } from "ethers";

/** A test environment backed by an in memory Hardhat EDR node. */
export interface TestEnv {
  /** JSON RPC provider connected to the in memory EVM. */
  provider: ethers.JsonRpcProvider;
  /** Ten pre funded signer accounts. */
  accounts: ethers.Signer[];
  /** Shut down the in memory EVM. */
  close: () => Promise<void>;
}

export interface DeployOptions {
  /** Override the build directory. Defaults to `build/` in the project root. */
  buildDir?: string;
  /** Send ETH with deployment (payable constructors). */
  value?: bigint;
  /** Index of the account to deploy from. Defaults to 0. */
  from?: number;
}

/** The object returned by `setup()`. */
export interface SkittlesTestContext {
  /** Ten pre funded signer accounts. Available after beforeAll runs. */
  readonly accounts: ethers.Signer[];
  /** JSON RPC provider connected to the in memory EVM. */
  readonly provider: ethers.JsonRpcProvider;
  /** Deploy a compiled contract to the test EVM. */
  deploy(
    contractName: string,
    constructorArgs?: unknown[],
    options?: DeployOptions
  ): Promise<ethers.Contract>;
  /** Connect to a deployed contract from a different signer. */
  connectAs(
    contract: ethers.Contract,
    signer: ethers.Signer
  ): ethers.Contract;
  /** Get the ETH balance of an address. */
  getBalance(address: string): Promise<bigint>;
  /**
   * Extract parsed event arguments from a transaction.
   * Returns an array of ethers `Result` objects, one per matching event log.
   * Each Result supports both positional (`events[0][0]`) and named
   * (`events[0].from`) access.
   */
  emitted(
    tx: ethers.ContractTransactionResponse,
    contract: ethers.Contract,
    eventName: string
  ): Promise<ethers.Result[]>;
}

/**
 * Set up a complete test environment with automatic lifecycle management.
 * Registers Vitest `beforeAll`/`afterAll` hooks to start and stop an in
 * memory EVM automatically.
 *
 * Call this inside a `describe` block or at the top level of a test file.
 */
export function setup(): SkittlesTestContext;

/** Create a fresh in memory EVM backed by Hardhat's EDR runtime. */
export function createTestEnv(): Promise<TestEnv>;

/** Deploy a compiled Skittles contract to the test EVM. */
export function deploy(
  env: TestEnv,
  contractName: string,
  constructorArgs?: unknown[],
  options?: DeployOptions
): Promise<ethers.Contract>;

/** Connect to a deployed contract from a different signer. */
export function connectAs(
  contract: ethers.Contract,
  signer: ethers.Signer
): ethers.Contract;

/** Get the ETH balance of an address. */
export function getBalance(env: TestEnv, address: string): Promise<bigint>;

/** Load a compiled contract's ABI and bytecode from disk. */
export function loadArtifact(
  contractName: string,
  buildDir?: string
): { abi: ethers.InterfaceAbi; bytecode: string };

/**
 * Extract parsed event arguments from a transaction.
 * Returns an array of ethers `Result` objects, one per matching event log.
 */
export function emitted(
  tx: ethers.ContractTransactionResponse,
  contract: ethers.Contract,
  eventName: string
): Promise<ethers.Result[]>;
