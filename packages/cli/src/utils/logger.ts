import chalk from "chalk";
import ora, { type Ora } from "ora";

export function startSpinner(text: string): Ora {
  return ora({ text, color: "cyan" }).start();
}

export function succeed(spinner: Ora, text: string): void {
  spinner.succeed(chalk.green(text));
}

export function fail(spinner: Ora, text: string): void {
  spinner.fail(chalk.red(text));
}

export const log = {
  info(message: string): void {
    // eslint-disable-next-line no-console
    console.log(chalk.cyan("ℹ"), message);
  },
  success(message: string): void {
    // eslint-disable-next-line no-console
    console.log(chalk.green("✔"), message);
  },
  warn(message: string): void {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow("⚠"), message);
  },
  error(message: string): void {
    // eslint-disable-next-line no-console
    console.error(chalk.red("✖"), message);
  },
  title(message: string): void {
    // eslint-disable-next-line no-console
    console.log(chalk.bold.magenta(`\n${message}\n`));
  },
};
