import { address, msg } from "../src/types/core-types";

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
}
