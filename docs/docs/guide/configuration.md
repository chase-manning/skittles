---
sidebar_position: 10
title: Configuration
---

# Configuration

Skittles is configured with a `skittles.config.json` or `skittles.config.js` file in your project root.

## Config File

Create `skittles.config.json`:

```json title="skittles.config.json"
{
  "contractsDir": "contracts",
  "outputDir": "artifacts",
  "typeCheck": true
}
```

Or use JavaScript if you need dynamic configuration:

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
| `typeCheck` | `boolean` | `true` | Run TypeScript type checking during compilation |
| `consoleLog` | `boolean` | `false` | Keep `console.log()` calls for debugging (compiles to Hardhat's `console.log`) |
| `solidity` | `object` | See below | Solidity output settings (pragma version and SPDX licence) |

When `consoleLog` is `false`, `console.log()` calls are removed from the generated Solidity. Running `skittles init` sets `consoleLog` to `true`.

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

## Default Behavior

If no config file is found, Skittles uses these defaults (with `cacheDir` set to `"cache"` and `consoleLog` set to `false`):

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

Skittles compiles your TypeScript contracts and writes the generated Solidity to a solidity subfolder inside your configured `outputDir` (by default, artifacts/solidity/). To test and deploy those contracts, use Hardhat. Point `paths.sources` in `hardhat.config.ts` at that folder:

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

Skittles uses SHA-256 hashing for incremental compilation. It stores a cache file (`.skittles-cache.json`) in the cache directory (default: `cache/`) that tracks:

- The hash of each source file
- The hash of all shared definitions (types, functions and constants)

On later compilations:

- If a file has not changed and no shared definitions have changed, Skittles reuses the cached output
- If a file has changed, only that file is recompiled
- If a shared definition has changed (for example, a struct in `types.ts`), every file that depends on shared definitions is recompiled

This avoids recompiling unchanged files as your project grows. Run `skittles clean` to clear the cache and force a full recompilation.

## TypeScript Configuration

Skittles reads TypeScript files directly using the TypeScript compiler API. You don't need a special `tsconfig.json` for Skittles, though having one gives you IDE support.

The `skittles init` command generates a `tsconfig.json` set up for contract development:

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

- `strictPropertyInitialization: false` is needed because state variables are initialised on the blockchain, not in a constructor
- `include` should cover your contracts directory
- `outDir` and `rootDir` only matter if you also run the TypeScript compiler directly (Skittles does not need them)
