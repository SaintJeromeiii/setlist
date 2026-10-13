export function isLoopbackHost(host: string): boolean {
  const bare = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.replace(/:\d+$/, "");
  return bare === "localhost" || bare === "127.0.0.1" || bare === "::1";
}

export function boothBrowserOrigin(port = process.env.PORT || "3847"): string {
  return `http://127.0.0.1:${port}`;
}
