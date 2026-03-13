# Skittles Webapp

The Skittles webapp is the marketing site and interactive playground hosted at [skittles.dev](https://skittles.dev/). It includes a landing page that explains Skittles and a browser-based playground where users can write TypeScript smart contracts and see the compiled Solidity output in real time.

## Running Locally

From the `webapp/` directory:

```bash
npm install
npm run dev
```

This starts the Vite dev server with hot module replacement.

## How It Works

The webapp imports the core Skittles package (`skittles`) directly to power the playground compiler. When a user types TypeScript in the playground editor, the source is passed through the Skittles parser and code generator entirely in the browser to produce Solidity output.

The landing page includes a marketing overview, code comparison examples, feature highlights, and a quick-start guide.

## Building

```bash
npm run build
```

This compiles TypeScript and builds the production bundle into `dist/`.
