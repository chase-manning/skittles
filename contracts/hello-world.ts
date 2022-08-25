import { address, block, chain, msg, tx } from "../src/types/core-types";

// This contract is used for regression testing and intends to implement all compile features
// It should NOT be used as an example of a contract implementation using Skittles

export class HelloWorld {
  private _privatebalance: number = 111;
  balance: number = 1;
  readonly decimals: number = 18;
  readonly age: number;
  name: string = "Hello World";
  init: number;
  readonly readOnlyString: string = "Readonly string";
  publicMapping: Record<address, number>;

  private _balances: Record<address, number>;
  private _approvals: Record<address, Record<address, number>>;

  constructor(init_: number) {
    this.age = 46;
    this.init = init_;
    this._balances[msg.sender] = init_;
    this.publicMapping[msg.sender] = init_ * 2;
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

  getWeirdCondition(value: number): number {
    if (value % 2 === 0) {
      return 789;
    } else if (value * 7 === 21) {
      return 123;
    } else {
      return 43;
    }
  }

  weirdConditionUpdate(value: number): void {
    if (value % 2 === 0) {
      this.balance = 789;
    } else if (value * 7 === 21) {
      this.balance = 123;
    } else {
      this.balance = 43;
    }
  }

  getSimpleIfStatementReturn(value: number): number {
    if (value === 1) return 1;
    else if (value === 2) return 2;
    else return 3;
  }

  simpleIfStatementUpdate(value: number): void {
    if (value === 1) this.balance = 1;
    else if (value === 2) this.balance = 2;
    else this.balance = 3;
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
