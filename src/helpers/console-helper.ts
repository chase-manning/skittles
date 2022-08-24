import chalk from "chalk";

const lines = [
  `         888      d8b 888    888    888                   `,
  `         888      Y8P 888    888    888                   `,
  `         888          888    888    888                   `,
  `.d8888b  888  888 888 888888 888888 888  .d88b.  .d8888b  `,
  `88K      888 .88P 888 888    888    888 d8P  Y8b 88K      `,
  `"Y8888b. 888888K  888 888    888    888 88888888 "Y8888b. `,
  `     X88 888 "88b 888 Y88b.  Y88b.  888 Y8b.          X88 `,
  ` 88888P' 888  888 888  "Y888  "Y888 888  "Y8888   88888P' `,
];

const letterBreakpoints = [9, 17, 21, 28, 35, 39, 48];

export const logSkittles = () => {
  console.log("");
  lines.forEach((line) => {
    console.log(
      chalk.hex("#de3c3c")(line.substring(0, letterBreakpoints[0])) +
        chalk.hex("#deb53c")(
          line.substring(letterBreakpoints[0], letterBreakpoints[1])
        ) +
        chalk.hex("#8dde3c")(
          line.substring(letterBreakpoints[1], letterBreakpoints[2])
        ) +
        chalk.hex("#3cde64")(
          line.substring(letterBreakpoints[2], letterBreakpoints[3])
        ) +
        chalk.hex("#3cdede")(
          line.substring(letterBreakpoints[3], letterBreakpoints[4])
        ) +
        chalk.hex("#3c64de")(
          line.substring(letterBreakpoints[4], letterBreakpoints[5])
        ) +
        chalk.hex("#8d3cde")(
          line.substring(letterBreakpoints[5], letterBreakpoints[6])
        ) +
        chalk.hex("#de3cb5")(line.substring(letterBreakpoints[6]))
    );
  });
  console.log("");
};
