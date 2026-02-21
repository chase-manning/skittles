---
sidebar_position: 10
title: Configuration
---

# Configuration

Skittles is configured via a `skittles.config.json` or `skittles.config.js` file in your project root.

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

| Option         | Type      | Default        | Description                                |
| -------------- | --------- | -------------- | ------------------------------------------ |
| `contractsDir` | `string`  | `"contracts"`  | Directory containing your TypeScript contract files |
| `outputDir`    | `string`  | `"artifacts"`  | Directory where compiled output is written |
| `cacheDir`     | `string`  | `"cache"`      | Directory where the compilation cache is stored |
| `typeCheck`    | `boolean` | `true`         | Enable TypeScript type checking during compilation |

## Default Behavior

If no config file is found, Skittles uses these defaults:

```json
{
  "contractsDir": "contracts",
  "outputDir": "artifacts",
  "typeCheck": true
}
```

## Hardhat Configuration

Skittles compiles your contracts and outputs the result to the configured `outputDir`. To test and deploy, use Hardhat. Configure `paths.sources` in `hardhat.config.ts` to point at your output directory:

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

Skittles uses SHA256 based incremental compilation. A cache file (`.skittles-cache.json`) is stored in the cache directory (default: `cache/`) and tracks:

- The hash of each source file
- The hash of all shared definitions (types, functions, constants)

On subsequent compilations:

- If a file has not changed and no shared definitions have changed, the cached artifacts are reused
- If a file changed, only that file is recompiled
- If any shared definition changed (e.g., a struct in `types.ts`), all files that depend on shared definitions are recompiled

This keeps compilation fast even as your project grows. Use `skittles clean` to clear the cache and force a full recompilation.

## TypeScript Configuration

Skittles reads TypeScript files directly using the TypeScript compiler API. You do not need a special `tsconfig.json` for Skittles, but having one gives you IDE support.

The `skittles init` command generates a `tsconfig.json` configured for contract development:

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

- `strictPropertyInitialization: false` is important because state variables are initialized on the blockchain, not in a constructor
- `include` should cover your contracts directory
- `outDir` and `rootDir` are only relevant if you also run the TypeScript compiler directly (not required for Skittles)
