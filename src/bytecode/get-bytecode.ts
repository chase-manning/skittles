import { SkittlesConfig } from "../types/core-types";

const solc = require("solc");

const getBytecode = (className: string, content: string, config: SkittlesConfig) => {
  const input = {
    language: "Yul",
    sources: {
      main: {
        content,
      },
    },
    settings: {
      optimizer: config.optimizer,
      outputSelection: {
        "*": {
          "*": ["*"],
        },
      },
    },
  };

  const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
  return compiled.contracts["main"][className].evm.bytecode.object;
};

export default getBytecode;
