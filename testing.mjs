// ESM entry point for skittles/testing.
// Vitest resolves to this file via the package.json "import" condition.

import { beforeAll, afterAll } from "vitest";
import testing from "./dist/testing.js";

const {
  createTestEnv: coreCreateTestEnv,
  deploy: coreDeploy,
  connectAs,
  getBalance: coreGetBalance,
  loadArtifact,
} = testing;

// Pass native ESM import() so Hardhat (ESM only) loads correctly.
const nativeImport = (specifier) => import(specifier);

function createTestEnv() {
  return coreCreateTestEnv(nativeImport);
}

/**
 * Set up a complete test environment with automatic lifecycle management.
 * Registers beforeAll and afterAll hooks so you never have to create or
 * tear down the EVM yourself.
 *
 * Call this inside a describe block (or at the top level of a test file).
 * The returned object's properties (accounts, provider) are populated once
 * the internal beforeAll has run, so access them inside beforeAll, it,
 * beforeEach, etc.
 *
 * @example
 * import { describe, it, expect, beforeAll } from "vitest";
 * import { setup } from "skittles/testing";
 *
 * describe("Token", () => {
 *   const env = setup();
 *   let token;
 *
 *   beforeAll(async () => {
 *     token = await env.deploy("Token", [1_000_000n]);
 *   });
 *
 *   it("has the correct name", async () => {
 *     expect(await token.name()).toBe("MyToken");
 *   });
 * });
 */
export function setup() {
  let env;

  beforeAll(async () => {
    env = await createTestEnv();
  }, 30_000);

  afterAll(async () => {
    await env?.close();
  });

  return {
    get accounts() {
      return env.accounts;
    },
    get provider() {
      return env.provider;
    },
    deploy(contractName, constructorArgs = [], options = {}) {
      return coreDeploy(env, contractName, constructorArgs, options);
    },
    connectAs,
    getBalance(address) {
      return coreGetBalance(env, address);
    },
  };
}

export { createTestEnv, coreDeploy as deploy, connectAs, coreGetBalance as getBalance, loadArtifact };
