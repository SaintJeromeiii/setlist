import os from "os";

function lanIPv4(): string | null {
  const found: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list ?? []) {
      const family = net.family as string | number;
      if (net.internal || (family !== "IPv4" && family !== 4)) continue;
      if (net.address.startsWith("169.254.")) continue;
      found.push(net.address);
    }
  }
  return found[0] ?? null;
}

export type ServiceLinks = { request: string; overlay: string; phone: string };

export function serviceLinks(): ServiceLinks {
  const boothPort = process.env.PORT || "3847";
  const publicPort = process.env.SETLIST_PUBLIC_PORT || "3848";
  const configured = process.env.SETLIST_PUBLIC_URL?.trim().replace(/\/$/, "");
  const lan = lanIPv4();
  const origin = configured || (lan ? `http://${lan}:${publicPort}` : "");
  return {
    request: origin ? `${origin}/request` : "",
    overlay: origin ? `${origin}/overlay` : `http://127.0.0.1:${boothPort}/overlay`,
    phone: origin ? `${origin}/booth` : "",
  };
}

export function publicOrigin(request?: Request): string {
  const links = serviceLinks();
  if (links.request) return new URL(links.request).origin;
  const host = request?.headers.get("host");
  if (host) {
    const proto = request?.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
    return `${proto}://${host}`;
  }
  const publicPort = process.env.SETLIST_PUBLIC_PORT || "3848";
  return `http://127.0.0.1:${publicPort}`;
}
