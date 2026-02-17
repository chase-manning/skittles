import chalk from "chalk";
import figlet from "figlet";

const BRAND_COLORS = [
  "#DD524C",
  "#E97B35",
  "#E9A23B",
  "#5EC269",
  "#56B5A6",
  "#65D0EB",
  "#6566E9",
  "#A28CF3",
];

const ACCENT = "#22D3EE";

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const RGB_COLORS = BRAND_COLORS.map(hexToRgb);

function interpolateColor(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

function getGradientColor(position: number): string {
  const segment = position * (RGB_COLORS.length - 1);
  const index = Math.min(Math.floor(segment), RGB_COLORS.length - 2);
  const t = segment - index;
  const [r, g, b] = interpolateColor(
    RGB_COLORS[index],
    RGB_COLORS[index + 1],
    t
  );
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function applyGradient(text: string): string {
  const lines = text.split("\n").filter((l) => l.trimEnd().length > 0);
  const maxWidth = Math.max(...lines.map((l) => l.length));

  return lines
    .map((line) =>
      line
        .split("")
        .map((char, i) => {
          if (char === " ") return " ";
          const color = getGradientColor(i / Math.max(maxWidth - 1, 1));
          return chalk.hex(color)(char);
        })
        .join("")
    )
    .join("\n");
}

export function printLogo(): void {
  const text = figlet.textSync("skittles", { font: "Standard" });

  console.log();
  console.log(applyGradient(text));
  console.log();
}

export function logSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

export function logError(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

export function logInfo(message: string): void {
  console.log(chalk.hex(ACCENT)(`ℹ ${message}`));
}

export function logWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}
