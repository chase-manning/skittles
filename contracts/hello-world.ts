import { address, block, chain, msg, tx } from "../src/types/core-types";

export class HelloWorld {
  private _privatebalance: number = 111;
  balance: number = 1;
  readonly decimals: number = 18;
  readonly age: number;
  name: string = "Hello World";
  init: number;

  private _balances: Record<address, number>;
  private _approvals: Record<address, Record<address, number>>;

  constructor(init_: number) {
    this.age = 46;
    this.init = init_;
    this._balances[msg.sender] = init_;
  }

  addBalance = (value: number): void => {
    this._addBalance(value);
  };

  getBalanceTimesTwo(): number {
    return this.balance * 2;
  }

  getPrivateBalance(): number {
    return this._privatebalance;
  }

  private _addBalance(value: number): void {
    this.balance += value;
  }

  setApproval(spender: address, amount: number): boolean {
    this._approvals[msg.sender][spender] = amount;
    return true;
  }

  getApproval(owner: address, spender: address): number {
    return this._approvals[owner][spender];
  }

  getUsersBalance(user: address): number {
    return this._balances[user];
  }

  // Testing EVM OP Codes
  getCoinbase = (): address => block.coinbase;
  getDifficulty = (): number => block.difficulty;
  getBlock = (): number => block.block;
  getTimestamp = (): number => block.timestamp;
  getChainId = (): number => chain.id;
  getMsgValue = (): number => msg.value;
  getTxGasPrice = (): number => tx.gasPrice;
  getTxOrigin = (): address => tx.origin;

  // Testing maths and logic
  getMathsResult = (): number => 2 + 3 - (((4 * 6) / 6) % 7);
  getNotEqualToTwo = (value: number): boolean => 2 !== value;
  getEqualToSeven = (value: number): boolean => 7 === value;
  getGreaterThanFour = (value: number): boolean => value > 4;
  getLessThan9 = (value: number): boolean => value < 9;
  getGreaterThanOrEqualToFour = (value: number): boolean => value >= 4;
  getLessThanOrEqualTo9 = (value: number): boolean => value <= 9;
  getAnd = (value: boolean): boolean => value && true;
  getOr = (value: boolean): boolean => value || false;
  getNot = (value: boolean): boolean => !value;
}
