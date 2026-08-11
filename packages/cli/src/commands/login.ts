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

  // Verify the key against THIS server before saving it as a success — the previous version
  // saved unconditionally and printed "✔ Logged in." even for a key that belonged to a
  // completely different server, which is exactly how a key gets silently paired with the wrong
  // deployment (discovered the hard way: a Cloud project's key stored against a self-hosted
  // server's URL, 401ing on every release with no clue why). Resolve first, decide the message
  // from what the server actually says, then persist — except when the server was simply
  // unreachable, where blocking would punish a correct key for a transient network blip.
  const resolution = await resolveProjectFromKey(config.serverUrl, options.apiKey);

  if (resolution.kind === "rejected") {
    log.error(
      `This API key was rejected by ${config.serverUrl} (${resolution.detail}). ` +
        "Not saving it — a key that doesn't work here will just fail on the next `openota release` " +
        "with a confusing 401. Double-check the key was created for this exact server, or that this " +
        "server even requires a key at all (self-hosted servers with no OPENOTA_API_KEY need no login).",
    );
    process.exitCode = 1;
    return;
  }

  await saveApiKey(config.serverUrl, options.apiKey);

  if (resolution.kind === "unreachable") {
    log.success(`Logged in. API key saved for ${config.serverUrl}.`);
    log.warn(`Could not verify the key right now (${resolution.detail}) — saved anyway. Run \`openota doctor\` once the server's reachable to confirm it actually works.`);
    return;
  }

  if (resolution.kind === "flat-key") {
    log.success(`Logged in. API key saved for ${config.serverUrl}.`);
    log.info("This server has no project system (self-hosted flat mode) — nothing further to link.");
    return;
  }

  const { project } = resolution;
  log.success(`Logged in. API key saved for ${config.serverUrl}.`);

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
