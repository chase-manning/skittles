export class HelloWorld {
  balance: number = 0;

  add = (value: number) => {
    this.balance += value;
    return this.balance;
  };
}
