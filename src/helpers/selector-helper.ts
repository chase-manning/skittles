import { utils } from "ethers";
import { AbiParameter } from "../types/abi-types";
import { SkittlesEventType } from "../types/skittles-contract";

const exampleValues: Record<string, any> = {
  uint256: 1,
  bool: true,
  string: "hello",
  address: "0x1234567890123456789012345678901234567890",
  bytes32: "0x1234567890123456789012345678901234567890123456789012345678901234",
};

export const getFunctionSelector = (abi: any[], func: string): string => {
  const iface = new utils.Interface(abi);
  const abiFunction = abi.find((f) => f.name === func);
  if (!abiFunction) throw new Error(`Could not find function ${func}`);
  const params = abiFunction.inputs.map((input: AbiParameter) => {
    const exampleValue = exampleValues[input.type];
    if (!exampleValue) throw new Error(`Could not find example value for ${input.type}`);
    return exampleValue;
  });
  const data = iface.encodeFunctionData(func, params);
  return data.substring(0, 10);
};

export const getEventSelector = (event: SkittlesEventType): string => {
  const eventString = `event ${event.label}(${event.parameters
    .map((p) => `${p.type.kind} ${p.name}`)
    .join(", ")})`;
  const iface = new utils.Interface([eventString]);
  const sigHash = iface.events[Object.keys(iface.events)[0]].format("sighash");
  return utils.keccak256(utils.toUtf8Bytes(sigHash));
};
