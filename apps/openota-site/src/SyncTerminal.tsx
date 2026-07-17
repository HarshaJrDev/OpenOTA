import { useEffect, useRef, useState } from "react";

interface LogLine {
  key: string;
  value: string;
  extra?: string;
  ok?: boolean;
}

const LOG_SCRIPT: Array<LogLine & { delay: number }> = [
  { key: "$", value: "ota.sync()", delay: 0 },
  { key: "→", value: "check      ", extra: "runtimeVersion=0.1.0", delay: 250 },
  { key: "", value: "  found v1.2.0, downloading…", delay: 250 },
  { key: "→", value: "download   ", extra: "895,873 bytes", delay: 500 },
  { key: "", value: "  ██████████████████ 100%", delay: 700 },
  { key: "→", value: "verify     ", extra: "sha256 match", delay: 350, ok: true },
  { key: "→", value: "extract    ", extra: "bundle + 0 assets", delay: 300 },
  { key: "→", value: "install    ", extra: "staged for next launch", delay: 300 },
  { key: "→", value: "activate   ", extra: "restart to apply", delay: 300, ok: true },
];

const LOOP_PAUSE_MS = 3400;

export function SyncTerminal() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [cycle, setCycle] = useState(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reducedMotion.current) {
      setVisibleCount(LOG_SCRIPT.length);
      return;
    }

    setVisibleCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;

    LOG_SCRIPT.forEach((line, index) => {
      elapsed += line.delay;
      timers.push(
        setTimeout(() => setVisibleCount(index + 1), elapsed),
      );
    });

    timers.push(
      setTimeout(() => setCycle((c) => c + 1), elapsed + LOOP_PAUSE_MS),
    );

    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  return (
    <div className="terminal">
      <div className="terminal-bar">
        <span className="tdot" />
        <span className="tdot" />
        <span className="tdot" />
        <span className="terminal-title">ota.sync() — device log</span>
      </div>
      <div className="terminal-body">
        {LOG_SCRIPT.slice(0, visibleCount).map((line, index) => (
          <div className={`tline${line.ok ? " ok" : ""}`} key={index}>
            <span className="tk">{line.key || " "}</span>
            <span className="tv">
              {line.value}
              {line.extra ? <span className="bar"> {line.extra}</span> : null}
            </span>
          </div>
        ))}
        {visibleCount === LOG_SCRIPT.length && (
          <div className="tline" style={{ opacity: 1 }}>
            <span className="tk">$</span>
            <span className="cursor" />
          </div>
        )}
      </div>
    </div>
  );
}
