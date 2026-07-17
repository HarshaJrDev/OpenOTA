#!/usr/bin/env node
import { Command } from "commander";

import { registerBuildCommand } from "./commands/build.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { registerReleaseCommand } from "./commands/release.js";
import { registerRollbackCommand } from "./commands/rollback.js";
import { registerUploadCommand } from "./commands/upload.js";
import { getCliVersion } from "./utils/version.js";

const program = new Command();

program
  .name("openota")
  .description("Official CLI for OpenOTA — build, upload and release OTA packages")
  .version(getCliVersion(), "-V", "output the CLI version");

registerInitCommand(program);
registerDoctorCommand(program);
registerBuildCommand(program);
registerUploadCommand(program);
registerReleaseCommand(program);
registerRollbackCommand(program);
registerLoginCommand(program);
registerLogoutCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
