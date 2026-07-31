import { Command } from "commander";

import { loadConfig, setProjectId } from "../services/config.service.js";
import { saveApiKey } from "../services/credentials.service.js";
import { resolveProjectFromKey } from "../services/project.service.js";
import { log } from "../utils/logger.js";
import { getProjectRoot } from "../utils/paths.js";

interface LoginCommandOptions {
  apiKey: string;
}

export async function runLogin(options: LoginCommandOptions): Promise<void> {
  const root = getProjectRoot();
  const config = await loadConfig(root);

  // Written to the user-level credentials file, never to openota.config.json — that file lives
  // in the project repo and is meant to be committed. See credentials.service.ts's doc comment.
  await saveApiKey(config.serverUrl, options.apiKey);
  log.success(`Logged in. API key saved for ${config.serverUrl}.`);

  // Best-effort: a project-scoped key (Cloud) resolves to exactly one project server-side; a
  // self-hosted global OPENOTA_API_KEY resolves to nothing and is silently skipped (see
  // resolveProjectFromKey's doc comment).
  const project = await resolveProjectFromKey(config.serverUrl, options.apiKey);
  if (!project) {
    return;
  }

  if (!config.projectId) {
    await setProjectId(root, project.id);
    log.info(`Linked to project "${project.name}" (${project.id}) — saved to openota.config.json.`);
  } else if (config.projectId !== project.id) {
    log.warn(
      `This API key belongs to project "${project.name}" (${project.id}), but openota.config.json ` +
        `is set to a different project (${config.projectId}). Releases will go to ${config.projectId} ` +
        "unless you update projectId.",
    );
  }
}

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Authenticate the CLI with an OpenOTA API key")
    .requiredOption("--api-key <key>", "API key issued by the OpenOTA server")
    .action(async (options: LoginCommandOptions) => {
      try {
        await runLogin(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown login error";
        log.error(`Login failed: ${message}`);
        process.exitCode = 1;
      }
    });
}
