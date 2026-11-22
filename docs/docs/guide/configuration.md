---
sidebar_position: 10
title: Configuration
---

# Configuration

Configure Skittles with a `skittles.config.json` or `skittles.config.js` file in your project root.

## Config File

Create `skittles.config.json`:

```json title="skittles.config.json"
{
  "contractsDir": "contracts",
  "outputDir": "artifacts",
  "typeCheck": true
}
```

Or use JavaScript for dynamic configuration:

```javascript title="skittles.config.js"
module.exports = {
  contractsDir: "contracts",
  outputDir: "artifacts",
  typeCheck: true,
};
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `contractsDir` | `string` | `"contracts"` | Directory containing your TypeScript contract files |
| `outputDir` | `string` | `"artifacts"` | Directory where compiled output is written |
| `cacheDir` | `string` | `"cache"` | Directory where the compilation cache is stored |
| `typeCheck` | `boolean` | `true` | Accepted and validated, but not currently read by the compiler. Compiling does not run TypeScript type checking, though your editor still checks your files |
| `consoleLog` | `boolean` | `false` | Enable `console.log()` support for debugging (compiles to Hardhat's `console.log`) |
| `solidity` | `object` | See below | Solidity output settings (pragma version and SPDX licence) |

### Solidity Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `solidity.version` | `string` | `"^0.8.20"` | Solidity pragma version for generated files |
| `solidity.license` | `string` | `"MIT"` | SPDX licence identifier for generated files |

Example with custom Solidity settings:

```json title="skittles.config.json"
{
  "solidity": {
    "version": "^0.8.24",
    "license": "GPL-3.0"
  }
}
```

## Default Behaviour

If no config file is found, Skittles uses these defaults:

```json
{
  "contractsDir": "contracts",
  "outputDir": "artifacts",
  "typeCheck": true,
  "solidity": {
    "version": "^0.8.20",
    "license": "MIT"
  }
}
```

## Hardhat Configuration

Skittles writes generated Solidity under your configured `outputDir` (`artifacts/solidity/` by default). To test and deploy with Hardhat, point `paths.sources` in `hardhat.config.ts` at that directory:

```typescript title="hardhat.config.ts"
export default defineConfig({
  paths: { sources: "./artifacts/solidity", tests: "./test" },
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
});
```

## Incremental Compilation

Skittles uses SHA-256 hashing for incremental compilation. A cache file (`.skittles-cache.json`) is stored in the cache directory (`cache/` by default) and tracks the hash of each source file and of all shared definitions (types, enums, interfaces, functions and constants).

On subsequent builds:

- If a file and all shared definitions are unchanged, Skittles reuses the cached output
- If a file changes, only that file is recompiled
- If a parent contract changes, the files that extend it are recompiled
- If any shared definition changes (for example, a struct in `types.ts`), every file is recompiled
- If you change the `consoleLog`, `solidity` or formatting config, every file is recompiled

Run `skittles clean` to clear the cache and force a full rebuild.

## TypeScript Configuration

Skittles reads TypeScript files directly using the TypeScript compiler API. You don't need a special `tsconfig.json` for Skittles, but having one gives you editor support.

Running `skittles init` creates a `tsconfig.json` set up for contract development:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["ES2022"],
    "strict": true,
    "strictPropertyInitialization": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["contracts/**/*"],
  "exclude": ["node_modules", "artifacts", "cache", "dist"]
}
```

Key settings:

- `strictPropertyInitialization: false` stops TypeScript flagging state variables that are initialised on-chain rather than in a constructor
- `include` should cover your contracts directory
- `outDir` and `rootDir` only matter if you also run the TypeScript compiler directly (Skittles does not need them)
