import getAbi from "./lib/get-abi";
import { utils } from "ethers";

const abi = getAbi("./contracts/hello-world.ts");

const iface = new utils.Interface(abi);
console.log("Balance", iface.encodeFunctionData("balance", []));
console.log("Add Balance", iface.encodeFunctionData("addBalance", [1]));
