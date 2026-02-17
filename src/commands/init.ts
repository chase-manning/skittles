import path from "path";
import fs from "fs";
import { writeFile, ensureDirectory } from "../utils/file";
import { logSuccess, logInfo, logWarning } from "../utils/console";

const CONFIG_TEMPLATE = JSON.stringify(
  {
    typeCheck: true,
    optimizer: {
      enabled: false,
      runs: 200,
    },
    contractsDir: "contracts",
    outputDir: "build",
  },
  null,
  2
);

const EXAMPLE_CONTRACT = `import { address, msg } from "skittles";

export class Token {
  public name: string = "MyToken";
  public symbol: string = "MTK";
  public totalSupply: number = 0;
  private balances: Record<address, number> = {};

  constructor(initialSupply: number) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
  }

  public balanceOf(account: address): number {
    return this.balances[account];
  }

  public transfer(to: address, amount: number): boolean {
    const sender: address = msg.sender;
    if (this.balances[sender] < amount) {
      throw new Error("Insufficient balance");
    }
    this.balances[sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
`;

export async function initCommand(projectRoot: string): Promise<void> {
  logInfo("Initializing new Skittles project...");

  // Create contracts directory
  const contractsDir = path.join(projectRoot, "contracts");
  ensureDirectory(contractsDir);
  logSuccess("Created contracts/ directory");

  // Write config file
  const configPath = path.join(projectRoot, "skittles.config.json");
  if (fs.existsSync(configPath)) {
    logWarning("skittles.config.json already exists, skipping");
  } else {
    writeFile(configPath, CONFIG_TEMPLATE + "\n");
    logSuccess("Created skittles.config.json");
  }

  // Write example contract
  const examplePath = path.join(contractsDir, "Token.ts");
  if (fs.existsSync(examplePath)) {
    logWarning("contracts/Token.ts already exists, skipping");
  } else {
    writeFile(examplePath, EXAMPLE_CONTRACT);
    logSuccess("Created contracts/Token.ts");
  }

  // Update .gitignore
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const gitignoreEntries = ["build/", "node_modules/"];

  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, "utf-8");
    const toAdd = gitignoreEntries.filter(
      (entry) => !existing.includes(entry)
    );
    if (toAdd.length > 0) {
      fs.appendFileSync(gitignorePath, "\n" + toAdd.join("\n") + "\n");
      logSuccess("Updated .gitignore");
    }
  } else {
    writeFile(gitignorePath, gitignoreEntries.join("\n") + "\n");
    logSuccess("Created .gitignore");
  }

  logSuccess(
    "Skittles project initialized! Run 'skittles compile' to compile your contracts."
  );
}
