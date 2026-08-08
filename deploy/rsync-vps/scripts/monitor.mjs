#!/usr/bin/env node
// OpenOTA — standalone health-check monitor, run every 5 minutes via cron on the VPS.
//
// Not Sentry/APM — this is a deliberate zero-external-account substitute (Sentry needs a signup
// this environment can't complete, and per the operator's own "no paid services" constraint,
// nothing external was added). It checks the same real /health endpoint deploy.sh already trusts
// (real database + storage connectivity, not just "the process is up"), plus that the dashboard
// and docs apps answer at all. On a state CHANGE (healthy -> unhealthy, or the reverse) it emails
// the operator via the same real SMTP transport apps/server/email.service.ts uses — not on every
// run, so a real outage doesn't produce hundreds of duplicate emails, and recovery is reported too
// so silence never has to be read as "still down".
//
// Known blind spot, disclosed rather than hidden: if the whole VPS is down, this cron can't run
// either — true of any self-hosted-only monitoring without an external always-on watcher. Catches
// what actually matters most in practice: app crashes, PM2 process death, DB/storage failures
// while the VPS itself stays up.

import nodemailer from "/var/www/openota/current/apps/server/node_modules/nodemailer/lib/nodemailer.js";
import fs from "node:fs";

const STATE_FILE = "/var/www/openota/shared/logs/monitor-state.json";
const CHECKS = [
  { name: "server /health", url: "https://api.openota.xyz/health", requireJson: true },
  { name: "dashboard", url: "https://dashboard.openota.xyz/login" },
  { name: "docs/website", url: "https://openota.xyz/" },
];

async function checkOne(check) {
  try {
    const res = await fetch(check.url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ...check, healthy: false, detail: `HTTP ${res.status}` };
    if (check.requireJson) {
      const body = await res.json();
      const ok = body?.data?.database === "connected" && body?.data?.storage === "connected";
      return { ...check, healthy: ok, detail: ok ? "ok" : JSON.stringify(body?.data) };
    }
    return { ...check, healthy: true, detail: "ok" };
  } catch (error) {
    return { ...check, healthy: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync("/var/www/openota/shared/logs", { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function sendAlert(subject, html) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.MONITOR_ALERT_EMAIL || user;
  if (!host || !user || !pass) {
    console.error("[monitor] SMTP not configured — cannot send alert:", subject);
    return;
  }
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  await transport.sendMail({ from: user, to, subject, html });
}

async function main() {
  const results = await Promise.all(CHECKS.map(checkOne));
  const state = loadState();
  const now = new Date().toISOString();
  let changed = false;

  for (const r of results) {
    const wasHealthy = state[r.name]?.healthy ?? true; // assume healthy until proven otherwise on first run
    if (r.healthy !== wasHealthy) {
      changed = true;
      const subject = r.healthy
        ? `✅ OpenOTA RECOVERED: ${r.name}`
        : `🚨 OpenOTA DOWN: ${r.name} — ${r.detail}`;
      await sendAlert(
        subject,
        `<p><strong>${r.name}</strong> is now <strong>${r.healthy ? "healthy" : "UNHEALTHY"}</strong> as of ${now}.</p><p>Detail: ${r.detail}</p><p>URL: ${r.url}</p>`,
      ).catch((err) => console.error("[monitor] failed to send alert:", err.message));
    }
    state[r.name] = { healthy: r.healthy, detail: r.detail, checkedAt: now };
  }

  saveState(state);
  console.log(`[${now}] ${results.map((r) => `${r.name}=${r.healthy ? "ok" : "DOWN"}`).join(" ")}${changed ? " (state changed, alert sent)" : ""}`);
}

main().catch((err) => {
  console.error("[monitor] fatal:", err);
  process.exit(1);
});
