const solc = require("solc");

const getBytecode = (className: string, content: string) => {
  const input = {
    language: "Yul",
    sources: {
      main: {
        content,
      },
    },
    settings: {
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
