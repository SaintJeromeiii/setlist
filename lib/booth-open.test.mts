import assert from "node:assert/strict";
import { boothPageUrl, browserCommand, openBooth, shouldOpenBooth, startupLines } from "./booth-open.mjs";

assert.equal(boothPageUrl(3847), "http://127.0.0.1:3847");
assert.equal(shouldOpenBooth({}), true);
assert.equal(shouldOpenBooth({ SETLIST_OPEN_BROWSER: "0" }), false);
assert.equal(shouldOpenBooth({}, true), false);
assert.equal(shouldOpenBooth({ SETLIST_BOOTH_HOST: "0.0.0.0" }), false);
assert.equal(shouldOpenBooth({ SETLIST_DESKTOP: "1" }), false);

assert.deepEqual(browserCommand("darwin", "http://127.0.0.1:3847"), {
  command: "open",
  args: ["http://127.0.0.1:3847"],
});
assert.deepEqual(browserCommand("win32", "http://127.0.0.1:3847"), {
  command: "cmd",
  args: ["/c", "start", "", "http://127.0.0.1:3847"],
});
assert.deepEqual(browserCommand("linux", "http://127.0.0.1:3847"), {
  command: "xdg-open",
  args: ["http://127.0.0.1:3847"],
});

let spawned: { command: string; args: string[] } | null = null;
const opened = openBooth("http://127.0.0.1:3847", {
  platform: "linux",
  spawnFn: ((command: string, args: string[]) => {
    spawned = { command, args };
    return { on() {}, unref() {} };
  }) as never,
});
assert.equal(opened, true);
assert.deepEqual(spawned, { command: "xdg-open", args: ["http://127.0.0.1:3847"] });

const ready = startupLines({ port: 3847, origin: "http://192.168.1.20:3848", opened: true });
assert.equal(ready[0], "Setlist opened the booth in your browser.");
assert.match(ready[1], /127\.0\.0\.1:3847/);
assert.match(ready[3], /192\.168\.1\.20:3848\/request/);

const desktop = startupLines({ port: 3847, origin: "http://192.168.1.20:3848", opened: false, desktop: true });
assert.equal(desktop[0], "Setlist is open.");

const docker = startupLines({ port: 3847, origin: "", opened: false });
assert.match(docker[0], /Open http:\/\/127\.0\.0\.1:3847/);
assert.match(docker[2], /this computer/);

console.log("booth open tests passed");
