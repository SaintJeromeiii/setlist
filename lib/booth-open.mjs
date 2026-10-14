import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export function boothPageUrl(port = process.env.PORT || "3847") {
  return `http://127.0.0.1:${port}`;
}

export function shouldOpenBooth(env = process.env, docker = existsSync("/.dockerenv")) {
  if (env.SETLIST_DESKTOP === "1") return false;
  if (env.SETLIST_OPEN_BROWSER === "0") return false;
  if (docker) return false;
  if (env.SETLIST_BOOTH_HOST === "0.0.0.0") return false;
  return true;
}

export function browserCommand(platform, url) {
  if (platform === "darwin") return { command: "open", args: [url] };
  if (platform === "win32") return { command: "cmd", args: ["/c", "start", "", url] };
  return { command: "xdg-open", args: [url] };
}

export function openBooth(url, { platform = process.platform, spawnFn = spawn } = {}) {
  const spec = browserCommand(platform, url);
  try {
    const child = spawnFn(spec.command, spec.args, { detached: true, stdio: "ignore" });
    child.on?.("error", () => {
      console.error(`The browser did not open. Open ${url} on this computer.`);
    });
    child.unref?.();
  } catch {
    return false;
  }
  return true;
}

export function startupLines({ port, origin, opened, desktop = false }) {
  const booth = boothPageUrl(port);
  const lines = desktop
    ? ["Setlist is open."]
    : opened
      ? [
          "Setlist opened the booth in your browser.",
          `If that tab does not appear, open ${booth} on this computer.`,
        ]
      : [`Open ${booth} in the browser on this computer. That page is the booth.`];
  lines.push(origin ? `Overlay   ${origin}/overlay` : `Overlay   ${booth}/overlay`);
  lines.push(origin ? `Requests  ${origin}/request` : "Requests  unavailable until this computer has a network address");
  lines.push(origin ? `Phone     ${origin}/booth` : "Phone     unavailable until this computer has a network address");
  return lines;
}
