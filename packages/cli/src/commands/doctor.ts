import { Command } from "commander";

import { runDoctorChecks, runDoctorFix } from "../services/doctor.service.js";
import { log } from "../utils/logger.js";

interface DoctorOptions {
  fix?: boolean;
}

function printChecks(results: Awaited<ReturnType<typeof runDoctorChecks>>): boolean {
  let hasFailure = false;
  for (const result of results) {
    if (result.ok) {
      log.success(`${result.name}: ${result.message}`);
    } else {
      hasFailure = true;
      log.error(`${result.name}: ${result.message}`);
    }
  }
  return hasFailure;
}

async function runDoctor(options: DoctorOptions): Promise<void> {
  log.title("OpenOTA Doctor");

  if (options.fix) {
    const { fixed, failed } = await runDoctorFix();
    for (const message of fixed) {
      log.success(message);
    }
    for (const failure of failed) {
      log.error(`${failure.name}: could not fix automatically (${failure.message})`);
    }
    if (fixed.length === 0 && failed.length === 0) {
      log.info("Nothing to fix — all auto-fixable checks already pass.");
    }
    log.title("Re-checking");
  }

  const results = await runDoctorChecks();
  const hasFailure = printChecks(results);

  if (hasFailure) {
    if (!options.fix) {
      log.info("Some checks can be repaired automatically — run `openota doctor --fix`.");
    }
    process.exitCode = 1;
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check your environment for OpenOTA compatibility")
    .option("--fix", "Automatically repair non-destructive issues (currently: missing SDK dependencies)")
    .action(async (options: DoctorOptions) => {
      await runDoctor(options);
    });
}
