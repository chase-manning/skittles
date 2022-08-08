import { Abi } from "../../lib/get-abi";

const abi: Abi = [
  {
    inputs: [
      {
        name: "value",
        type: "uint256",
      },
    ],
    name: "addBalance",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "balance",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export default abi;
