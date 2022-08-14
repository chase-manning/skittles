export class HelloWorld {
  balance: number = 1;

  addBalance = (value: number): void => {
    this.balance += value;
  };

  getBalanceTimesTwo(): number {
    return this.balance * 2;
  }
}
