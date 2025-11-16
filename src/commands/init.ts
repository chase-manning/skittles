import fs from "fs";
import path from "path";
import ora from "ora";

interface InitOptions {
  force?: boolean;
}

/**
 * Template content for IERC20 interface.
 */
const IERC20_TEMPLATE = `import { address } from "skittles/lib/types/core-types";

export interface TransferEvent {
  from: address;
  to: address;
  amount: number;
}

export interface ApprovalEvent {
  owner: address;
  spender: address;
  amount: number;
}

export default interface IERC20 {
  decimals: number;
  symbol: string;
  name: string;
  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;

  approve(spender: address, amount: number): boolean;
  transfer(to: address, amount: number): boolean;
  transferFrom(from: address, to: address, amount: number): boolean;
}
`;

/**
 * Template content for ERC20 contract.
 */
const ERC20_TEMPLATE = `import { address, msg, SkittlesEvent } from "skittles/lib/types/core-types";
import IERC20, { ApprovalEvent, TransferEvent } from "./ierc20";

export class ERC20 implements IERC20 {
  readonly decimals: number = 18;
  readonly symbol: string = "TEST";
  readonly name: string = "TEST ERC20";

  totalSupply: number;
  balanceOf: Record<address, number>;
  allowance: Record<address, Record<address, number>>;

  Transfer: SkittlesEvent<TransferEvent>;
  Approval: SkittlesEvent<ApprovalEvent>;

  approve(spender: address, amount: number): boolean {
    this.allowance[msg.sender][spender] = amount;
    this.Approval.emit({ owner: msg.sender, spender, amount });
    return true;
  }

  transfer(to: address, amount: number): boolean {
    this._transfer(msg.sender, to, amount);
    return true;
  }

  transferFrom(from: address, to: address, amount: number): boolean {
    if (this.allowance[from][msg.sender] !== Number.MAX_VALUE) {
      this.allowance[from][msg.sender] -= amount;
    }
    this._transfer(from, to, amount);
    return true;
  }

  private _transfer(from: address, to: address, amount: number): void {
    this.balanceOf[to] += amount;
    this.balanceOf[from] -= amount;
    this.Transfer.emit({ from, to, amount });
  }
}
`;

/**
 * Checks if a file or directory exists.
 */
const exists = (filePath: string): boolean => {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Creates the contracts directory if it doesn't exist.
 */
const ensureContractsDirectory = (): void => {
  const contractsDir = path.join(process.cwd(), "contracts");
  if (!exists(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
};

/**
 * Generates the skittles.config.ts file.
 */
const generateConfig = (): string => {
  return `import { SkittlesConfig } from "skittles/lib/types/core-types";

const config: SkittlesConfig = {
  optimizer: {
    enabled: true,
    runs: 200,
  },
};

export default config;
`;
};

/**
 * Generates .gitignore entries for Skittles projects.
 */
const generateGitignoreEntries = (): string => {
  return `# Skittles build artifacts
build/
*.abi
*.bytecode
*.yul

`;
};

/**
 * Updates or creates .gitignore file with Skittles entries.
 */
const updateGitignore = (): void => {
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  const entries = generateGitignoreEntries();

  if (exists(gitignorePath)) {
    const currentContent = fs.readFileSync(gitignorePath, "utf8");
    // Only add if entries don't already exist
    if (!currentContent.includes("# Skittles build artifacts")) {
      fs.appendFileSync(gitignorePath, `\n${entries}`);
    }
  } else {
    fs.writeFileSync(gitignorePath, entries);
  }
};

/**
 * Updates package.json with Skittles scripts if they don't exist.
 */
const updatePackageJson = (): void => {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!exists(packageJsonPath)) {
    return; // Skip if package.json doesn't exist
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  // Add scripts if they don't exist
  if (!packageJson.scripts.compile) {
    packageJson.scripts.compile = "skittles compile";
  }
  if (!packageJson.scripts.clean) {
    packageJson.scripts.clean = "skittles clean";
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
};

/**
 * Creates example IERC20 and ERC20 contract files.
 */
const createExampleContracts = (force: boolean = false): void => {
  ensureContractsDirectory();

  const ierc20Path = path.join(process.cwd(), "contracts", "ierc20.ts");
  const erc20Path = path.join(process.cwd(), "contracts", "erc20.ts");

  if (exists(ierc20Path) && !force) {
    throw new Error(`Contract file ierc20.ts already exists. Use --force to overwrite.`);
  }
  if (exists(erc20Path) && !force) {
    throw new Error(`Contract file erc20.ts already exists. Use --force to overwrite.`);
  }

  fs.writeFileSync(ierc20Path, IERC20_TEMPLATE);
  fs.writeFileSync(erc20Path, ERC20_TEMPLATE);
};

/**
 * Initializes a new Skittles project.
 */
export const initSkittles = (options: InitOptions = {}): void => {
  const spinner = ora("Initializing Skittles project").start();

  try {
    // Check if config already exists
    const configPath = path.join(process.cwd(), "skittles.config.ts");
    if (exists(configPath) && !options.force) {
      spinner.fail("skittles.config.ts already exists. Use --force to overwrite.");
      return;
    }

    // Generate and write config
    spinner.text = "Creating skittles.config.ts";
    const configContent = generateConfig();
    fs.writeFileSync(configPath, configContent);

    // Create contracts directory and example contracts
    spinner.text = "Creating example ERC20 contracts";
    createExampleContracts(options.force);

    // Update .gitignore
    spinner.text = "Updating .gitignore";
    updateGitignore();

    // Update package.json scripts
    spinner.text = "Updating package.json scripts";
    updatePackageJson();

    spinner.succeed("Skittles project initialized successfully!");
    console.log("\nNext steps:");
    console.log("  1. Review the generated contract in contracts/");
    console.log("  2. Run 'skittles compile' to compile your contracts");
    console.log("  3. Check out the README for more information");
  } catch (error: any) {
    spinner.fail(`Failed to initialize project: ${error?.message || "Unknown error"}`);
    throw error;
  }
};
