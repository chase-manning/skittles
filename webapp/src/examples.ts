export const EXAMPLES: Record<string, string> = {
  Token: `import { address, msg } from "skittles";

export class Token {
  name: string = "MyToken";
  symbol: string = "MTK";
  totalSupply: number = 0;
  private balances: Record<address, number> = {};

  constructor(initialSupply: number) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
  }

  balanceOf(account: address): number {
    return this.balances[account];
  }

  transfer(to: address, amount: number): boolean {
    if (this.balances[msg.sender] < amount) {
      throw new Error("Insufficient balance");
    }
    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
`,
  Counter: `export class Counter {
  count: number = 0;

  increment(): void {
    this.count += 1;
  }

  decrement(): void {
    if (this.count <= 0) {
      throw new Error("Counter cannot go below zero");
    }
    this.count -= 1;
  }

  getCount(): number {
    return this.count;
  }
}
`,
  Ownable: `import { address, msg } from "skittles";

export class Ownable {
  owner: address = msg.sender;

  transferOwnership(newOwner: address): void {
    if (msg.sender !== this.owner) {
      throw new Error("Not the owner");
    }
    this.owner = newOwner;
  }
}
`,
  Staking: `import { address, msg, block } from "skittles";

export class Staking {
  private stakes: Record<address, number> = {};
  private stakedAt: Record<address, number> = {};
  totalStaked: number = 0;

  stake(amount: number): void {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }
    this.stakes[msg.sender] += amount;
    this.stakedAt[msg.sender] = block.timestamp;
    this.totalStaked += amount;
  }

  withdraw(): void {
    const staked = this.stakes[msg.sender];
    if (staked <= 0) {
      throw new Error("Nothing staked");
    }
    this.stakes[msg.sender] = 0;
    this.totalStaked -= staked;
  }

  stakeOf(account: address): number {
    return this.stakes[account];
  }
}
`,
};

export const COMPARISON_SOL_LINES = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.20;",
  "",
  "contract Token {",
  "    string public name = \"MyToken\";",
  "    string public symbol = \"MTK\";",
  "    uint256 public totalSupply;",
  "    mapping(address => uint256) internal balances;",
  "",
  "    constructor(uint256 initialSupply) {",
  "        totalSupply = initialSupply;",
  "        balances[msg.sender] = initialSupply;",
  "    }",
  "",
  "    function balanceOf(address account)",
  "        public view virtual returns (uint256) {",
  "        return balances[account];",
  "    }",
  "",
  "    function transfer(address to, uint256 amount)",
  "        public virtual returns (bool) {",
  "        require(balances[msg.sender] >= amount,",
  "            \"Insufficient balance\");",
  "        balances[msg.sender] -= amount;",
  "        balances[to] += amount;",
  "        return true;",
  "    }",
  "}",
];
