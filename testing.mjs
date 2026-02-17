// ESM entry point for skittles/testing.
// Vitest resolves to this file via the package.json "import" condition.

import { beforeAll, afterAll } from "vitest";
import {
  createTestEnv as coreCreateTestEnv,
  deploy as coreDeploy,
  connectAs,
  getBalance as coreGetBalance,
  loadArtifact,
} from "./dist/testing.js";

function createTestEnv() {
  return coreCreateTestEnv();
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

  function requireEnv() {
    if (!env) {
      throw new Error(
        "skittles/testing: setup() environment is not ready yet. " +
        "Make sure setup() is called at the top of your describe block " +
        "and only access its properties inside beforeAll, beforeEach, it, or afterAll hooks."
      );
    }
    return env;
  }

  beforeAll(async () => {
    env = await createTestEnv();
  }, 30_000);

  afterAll(async () => {
    await env?.close();
  });

  return {
    get accounts() {
      return requireEnv().accounts;
    },
    get provider() {
      return requireEnv().provider;
    },
    deploy(contractName, constructorArgs = [], options = {}) {
      return coreDeploy(requireEnv(), contractName, constructorArgs, options);
    },
    connectAs,
    getBalance(address) {
      return coreGetBalance(requireEnv(), address);
    },
  };
}

export { createTestEnv, coreDeploy as deploy, connectAs, coreGetBalance as getBalance, loadArtifact };
