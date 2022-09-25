import {
  address,
  block,
  bytes,
  chain,
  hash,
  msg,
  SkittlesContract,
  SkittlesEvent,
  tx,
} from "../../src/types/core-types";
import IRegressionTest from "./regression-test-interface";
import { ZERO_ADDRESS } from "../../src/data/constants";
import { functionWithParams, returnFifty, returnFourty } from "./regression-test-library";

// This contract is used for regression testing and intends to implement all compile features
// It should NOT be used as an example of a contract implementation using Skittles

const OTHER_ADDRESS: address = "0x106EebF11F34ECCcaD59c1CA9398d828765f64f8";

interface NumberAndAddress {
  number: number;
  address: address;
}

interface ABC {
  a: number;
  b: number;
  c: number;
}

interface AB {
  a: number;
  b: number;
}

interface TestEventType {
  testNumber: number;
  testAddress: address;
}

function returnTwenty(): number {
  return 20;
}

const returnThirty = (): number => {
  return 30;
};

export class RegressionTest extends SkittlesContract implements IRegressionTest {
  private _privatebalance: number = 111;
  protected _protectedBalance: number = 345;
  balance: number = 1;
  readonly decimals: number = 18;
  readonly age: number;
  name: string = "Regression Test";
  init: number;
  readonly readOnlyString: string = "Readonly string";
  publicMapping: Record<address, number>;
  publicMappingNested: Record<address, Record<address, number>>;
  addressArray: address[];

  private _balances: Record<address, number>;
  private _approvals: Record<address, Record<address, number>>;

  TestEvent: SkittlesEvent<TestEventType>;

  constructor(init_: number) {
    super();
    this.age = 46;
    this.init = init_;
    this._balances[msg.sender] = init_;
    this.publicMapping[msg.sender] = init_ * 2;
    this.publicMappingNested[msg.sender][msg.sender] = init_ * 3;
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

  protected _protectedView(): number {
    return 123;
  }

  protected _protectedFunction(): void {
    this._protectedBalance = 123;
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

  getUsersBalanceWrapper(user: address): number {
    return this.getUsersBalance(user);
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

  getNumberAndAddress(): NumberAndAddress {
    return {
      number: 123,
      address: "0x1234567890123456789012345678901234567890",
    };
  }

  getAddressArrayLength(): number {
    return this.addressArray.length;
  }

  pushAddressArrayValue(value: address): void {
    this.addressArray.push(value);
  }

  declareVariable(): number {
    let x = 1 + 7 * 2;
    return x;
  }

  variableUpdates(): number {
    let x = 1;
    x = 7;
    x = x * 2;
    return x;
  }

  getZeroAddressFromImport = (): address => {
    return ZERO_ADDRESS;
  };

  getOtherAddresFromConstant = (): address => {
    return OTHER_ADDRESS;
  };

  getZeroAddressWithOneLine = (): address => ZERO_ADDRESS;

  getConditionalStatements = (a: number, b: number): number => {
    return a > b ? 123 : 321;
  };

  getConditionalStatementsArrow = (a: number, b: number): string => (a > b ? "Meow" : "woof");

  getStringFromArrowFunction = (): string => "Meow";

  getNumberFromArrowFunction = (): number => 123;

  getNestedConditionals = (a: number, b: number, c: number): number => {
    return a > b ? (a > c ? 1 : 2) : b > c ? 3 : 4;
  };

  getString = (): string => {
    return "Meow";
  };

  revertUnsafeMul = (): void => {
    let meow =
      9007199254740991 *
      9007199254740991 *
      9007199254740991 *
      9007199254740991 *
      9007199254740991 *
      9007199254740991 *
      9007199254740991 *
      9007199254740991 *
      9007199254740991 *
      9007199254740991 *
      9007199254740991 *
      9007199254740991;
  };

  emitEvent = (testNumber2: number, testAddress: address): void => {
    this.TestEvent.emit({
      testAddress,
      testNumber: testNumber2,
    });
  };

  multipleVariableAssignments(): ABC {
    let a = 1,
      b = 2,
      c = 3;
    return { a, b, c };
  }

  arrowFunctionReturningInterface = (): ABC => {
    return { a: 1, b: 2, c: 3 };
  };

  getVariableDeclarationList = (): ABC => {
    const [a, b, c] = [7, 8, 9];
    return { a, b, c };
  };

  getConditionalVariableDeclarationList = (first: number, second: number): AB => {
    let [a, b] = first > second ? [second, first] : [first, second];
    return { a, b };
  };

  returnInternalFunction = (): number => {
    return returnTwenty();
  };

  returnInternalArrowFunction = (): number => {
    return returnThirty();
  };

  returnExternalFunction(): number {
    return returnFifty();
  }

  returnExternalArrowFunction(): number {
    return returnFourty();
  }

  returnFunctionWithParams = (a: number, b: number): number => {
    return functionWithParams(a, b);
  };

  getSingleValueNumberHash = (a: number): bytes => {
    return hash(a);
  };

  getMultiValueNumberHash = (a: number, b: number, c: number, d: number): bytes => {
    return hash(a, b, c, d);
  };

  getMultiValueMixedhash = (a: number, b: address, c: boolean, d: bytes): bytes => {
    return hash(a, b, c, d);
  };

  getContractAddress = (): address => {
    return this.address;
  };

  // deployContract = (): address => {
  //   const contract = new RegressionTestChild();
  //   return contract.address;
  // };

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

class BaseSecondRegressionTest extends SkittlesContract {
  meow: number;
}

interface ISecondRegressionTest {
  variable: number;
}

export class SecondRegressionTest
  extends BaseSecondRegressionTest
  implements ISecondRegressionTest
{
  variable: number = 1;
}
