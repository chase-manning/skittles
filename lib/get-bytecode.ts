import { Compile } from "@truffle/compile-solidity";
import { Resolver } from "@truffle/resolver";

const options = {
  working_directory: __dirname,
  contracts_directory: "./not-actually-needed",
  contracts_build_directory: "./not-actually-needed",
  compilers: {
    solc: {
      version: "0.5.17",
      settings: {
        optimizer: {
          enabled: false,
          runs: 200,
        },
      },
    },
  },
  quiet: true,
};

(options as any).resolver = new Resolver(options);

const getBytecode = async (path: string) => {
  const paths = [path];
  const { compilations } = await Compile.sourcesWithDependencies({
    paths,
    options,
  });

  return compilations[0].contracts[0].bytecode.bytes;
};

export default getBytecode;
