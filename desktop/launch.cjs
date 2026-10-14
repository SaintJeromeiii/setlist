const http = require("http");
const path = require("path");

function appDataDir(userData) {
  return path.join(userData, "data");
}

function serverCommand({ packaged, execPath, nodePath, appRoot }) {
  return {
    command: packaged ? execPath : nodePath,
    args: [path.join(appRoot, "server.mjs")],
    cwd: appRoot,
  };
}

function serverEnv(base, { dataDir, packaged }) {
  const env = {
    ...base,
    SETLIST_OPEN_BROWSER: "0",
    SETLIST_DESKTOP: "1",
    SETLIST_DATA_DIR: dataDir,
  };
  if (packaged) {
    env.ELECTRON_RUN_AS_NODE = "1";
    env.NODE_ENV = "production";
  } else {
    delete env.ELECTRON_RUN_AS_NODE;
  }
  return env;
}

function boothIsUp(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/public`, { timeout: 800 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

module.exports = { appDataDir, boothIsUp, serverCommand, serverEnv };
