export interface IPool {
  deposit(amount: number): number;
  withdraw(amount: number): number;
  totalUnderlying: number;
}

export class Pool implements IPool {
  public totalUnderlying: number;

  deposit = (amount: number): number => {
    this.totalUnderlying += amount;
    return amount;
  };

  withdraw = (amount: number): number => {
    this.totalUnderlying -= amount;
    return amount;
  };
}
