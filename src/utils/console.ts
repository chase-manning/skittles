import chalk from "chalk";

const LOGO = `
   _____ __   _ __  __  __         
  / ___// /__(_) /_/ /_/ /__  _____
  \\__ \\/ //_/ / __/ __/ / _ \\/ ___/
 ___/ / ,< / / /_/ /_/ /  __(__  ) 
/____/_/|_/_/\\__/\\__/_/\\___/____/  
`;

export function printLogo(): void {
  console.log(chalk.hex("#FF6347")(LOGO));
}

export function logSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

export function logError(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

export function logInfo(message: string): void {
  console.log(chalk.cyan(`ℹ ${message}`));
}

export function logWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}
