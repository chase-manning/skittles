import { address } from "../../src/types/core-types";

// TODO Add events

export class UniswapV2Factory {
  feeTo: address;
  feeToSetter: address;

  getPair: Record<address, Record<address, address>>;
  allPairs: address[];

  constructor(feeToSetter: address) {
    this.feeToSetter = feeToSetter;
  }

  allPairsLength(): number {
    return 0;
    // return this.allPairs.length;
  }
}
