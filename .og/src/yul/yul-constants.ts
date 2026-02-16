export const decoderFunctions: Record<string, string> = {
  address: "decodeAsAddress",
  uint256: "decodeAsUint",
  bool: "decodeAsUint",
  bytes32: "decodeAsUint",
};

export const returnFunctions: Record<string, string> = {
  uint256: "return256",
  bool: "returnBoolean",
  address: "return256",
  string: "returnString",
  array: "returnArray",
  bytes32: "return256",
};

export const evmDialects: Record<string, Record<string, string>> = {
  block: {
    coinbase: "coinbase()",
    difficulty: "difficulty()",
    block: "number()",
    prevhash: "",
    timestamp: "timestamp()",
  },
  chain: {
    id: "chainid()",
  },
  msg: {
    data: "",
    sender: "caller()",
    value: "callvalue()",
  },
  tx: {
    gasPrice: "gasprice()",
    origin: "origin()",
  },
};
