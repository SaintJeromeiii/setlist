const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { appDataDir, boothIsUp, serverCommand, serverEnv } = require("./launch.cjs");

app.setName("Setlist");
if (process.argv.includes("--no-sandbox")) app.commandLine.appendSwitch("no-sandbox");

const port = Number(process.env.PORT || 3847);
let server = null;
let startedByUs = false;
let quitting = false;
let win = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

function projectRoot() {
  return app.isPackaged ? app.getAppPath() : path.join(__dirname, "..");
}

function nodeBinary() {
  return process.env.npm_node_execpath || "node";
}

function stopServer() {
  if (!startedByUs || !server || server.killed) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { windowsHide: true, stdio: "ignore" });
    } else {
      process.kill(-server.pid, "SIGTERM");
    }
  } catch {
    try {
      server.kill("SIGTERM");
    } catch {
      // The server has already stopped.
    }
  }
}

async function ensureServer(dir) {
  if (await boothIsUp(port)) return;
  const root = projectRoot();
  const spec = serverCommand({
    packaged: app.isPackaged,
    execPath: process.execPath,
    nodePath: nodeBinary(),
    appRoot: root,
  });
  const logPath = path.join(app.getPath("userData"), "setlist.log");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logFd = fs.openSync(logPath, "a");
  server = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: serverEnv(process.env, { dataDir: dir, packaged: app.isPackaged }),
    detached: process.platform !== "win32",
    windowsHide: true,
    stdio: ["ignore", logFd, logFd],
  });
  fs.closeSync(logFd);
  startedByUs = true;
  server.on("error", () => {});
  server.on("exit", () => {
    if (quitting || !win || win.isDestroyed()) return;
    dialog.showMessageBox(win, {
      type: "error",
      title: "Setlist",
      message: "Setlist stopped. Close the window and open Setlist again.",
    });
  });
}

async function waitForBooth() {
  const deadline = Date.now() + 90_000;
  while (!(await boothIsUp(port))) {
    if (Date.now() > deadline) throw new Error("The booth did not open.");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

function keepNavigationInside() {
  const home = `http://127.0.0.1:${port}`;
  const local = `http://localhost:${port}`;
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(home) || url.startsWith(local)) return;
    event.preventDefault();
    shell.openExternal(url);
  });
}

async function openWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 880,
    minHeight: 640,
    title: "Setlist",
    backgroundColor: "#100e0c",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win.show());
  await win.loadFile(path.join(__dirname, "splash.html"));
  try {
    await ensureServer(appDataDir(app.getPath("userData")));
    await waitForBooth();
    await win.loadURL(`http://127.0.0.1:${port}/`);
    keepNavigationInside();
  } catch {
    await dialog.showMessageBox(win, {
      type: "error",
      title: "Setlist",
      message: "Setlist could not open. Quit any other copy and open Setlist again.",
    });
  }
}

app.on("second-instance", () => {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.whenReady().then(openWindow);

app.on("before-quit", () => {
  quitting = true;
  stopServer();
});

app.on("window-all-closed", () => {
  app.quit();
});
