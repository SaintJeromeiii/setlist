import { createServer } from "node:http";
import os from "node:os";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const boothPort = Number(process.env.PORT || 3847);
const publicPort = Number(process.env.SETLIST_PUBLIC_PORT || 3848);
const boothHost = process.env.SETLIST_BOOTH_HOST || "127.0.0.1";

const booth = createServer();
const app = next({
  dev,
  hostname: "127.0.0.1",
  port: boothPort,
  httpServer: booth,
});
const handle = app.getRequestHandler();

function peer(kind) {
  return (req, res) => {
    delete req.headers["x-setlist-peer"];
    req.headers["x-setlist-peer"] = kind;
    handle(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) res.statusCode = 500;
      res.end("internal server error");
    });
  };
}

function lanIPv4() {
  const found = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.internal || (net.family !== "IPv4" && net.family !== 4)) continue;
      if (net.address.startsWith("169.254.")) continue;
      found.push(net.address);
    }
  }
  return found[0] ?? null;
}

await app.prepare();

booth.on("request", peer("booth"));
const publicServer = createServer(peer("public"));

await new Promise((resolve) => {
  booth.listen(boothPort, boothHost, resolve);
});
await new Promise((resolve) => {
  publicServer.listen(publicPort, "0.0.0.0", resolve);
});

const configured = process.env.SETLIST_PUBLIC_URL?.trim().replace(/\/$/, "");
const lan = lanIPv4();
const origin = configured || (lan ? `http://${lan}:${publicPort}` : "");

console.log(`Booth     http://127.0.0.1:${boothPort}`);
console.log(origin ? `Overlay   ${origin}/overlay` : `Overlay   http://127.0.0.1:${boothPort}/overlay`);
console.log(origin ? `Requests  ${origin}/request` : "Requests  unavailable until this Mac has a network address");
console.log(origin ? `Phone     ${origin}/booth` : "Phone     unavailable until this Mac has a network address");
