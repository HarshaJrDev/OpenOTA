export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogHandler = (level: LogLevel, message: string, meta?: Record<string, unknown>) => void;

let handler: LogHandler | null = null;

export function setLogHandler(next: LogHandler | null): void {
  handler = next;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (handler) {
    handler(level, message, meta);
    return;
  }

  if (level === "error" || level === "warn") {
    // eslint-disable-next-line no-console
    console[level](`[OpenOTA] ${message}`, meta ?? "");
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    emit("debug", message, meta);
  },
  info(message: string, meta?: Record<string, unknown>): void {
    emit("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    emit("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>): void {
    emit("error", message, meta);
  },
};
