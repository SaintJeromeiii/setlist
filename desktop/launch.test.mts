import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { appDataDir, serverCommand, serverEnv } = require("./launch.cjs");

assert.equal(appDataDir("/home/dj/.config/Setlist"), path.join("/home/dj/.config/Setlist", "data"));

const dev = serverCommand({
  packaged: false,
  execPath: "/usr/bin/electron",
  nodePath: "/usr/bin/node",
  appRoot: "/apps/setlist",
});
assert.equal(dev.command, "/usr/bin/node");
assert.deepEqual(dev.args, ["/apps/setlist/server.mjs"]);
assert.equal(dev.cwd, "/apps/setlist");

const packed = serverCommand({
  packaged: true,
  execPath: "/Setlist.app/Contents/MacOS/Setlist",
  nodePath: "/usr/bin/node",
  appRoot: "/Setlist.app/Contents/Resources/app",
});
assert.equal(packed.command, "/Setlist.app/Contents/MacOS/Setlist");

const env = serverEnv({ ELECTRON_RUN_AS_NODE: "1", PATH: "/usr/bin" }, { dataDir: "/tmp/setlist-data", packaged: false });
assert.equal(env.SETLIST_DESKTOP, "1");
assert.equal(env.SETLIST_OPEN_BROWSER, "0");
assert.equal(env.SETLIST_DATA_DIR, "/tmp/setlist-data");
assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);

const production = serverEnv({}, { dataDir: "/tmp/setlist-data", packaged: true });
assert.equal(production.ELECTRON_RUN_AS_NODE, "1");
assert.equal(production.NODE_ENV, "production");

console.log("desktop launch tests passed");
