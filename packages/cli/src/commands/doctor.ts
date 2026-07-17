import { Command } from "commander";

import { runDoctorChecks } from "../services/doctor.service.js";
import { log } from "../utils/logger.js";

async function runDoctor(): Promise<void> {
  log.title("OpenOTA Doctor");

  const results = await runDoctorChecks();
  let hasFailure = false;

  for (const result of results) {
    if (result.ok) {
      log.success(`${result.name}: ${result.message}`);
    } else {
      hasFailure = true;
      log.error(`${result.name}: ${result.message}`);
    }
  }


  if (hasFailure) {
    process.exitCode = 1;
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check your environment for OpenOTA compatibility")
    .action(async () => {
      await runDoctor();
    });
}
