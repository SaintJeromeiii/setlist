import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PAGES = new Set(["/overlay", "/booth", "/login", "/history", "/desk"]);

const APIS = new Set([
  "/api/public",
  "/api/requests",
  "/api/login",
  "/api/logout",
  "/api/logo",
  "/api/show",
  "/api/lookup",
  "/api/facebook",
  "/api/youtube",
  "/api/nights",
  "/api/tips",
  "/api/stripe/webhook",
]);

export function middleware(request: NextRequest) {
  if (request.headers.get("x-setlist-peer") !== "public") return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (path === "/request" || path.startsWith("/request/") || PAGES.has(path) || APIS.has(path)) {
    return NextResponse.next();
  }
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
  return NextResponse.redirect(new URL(`${proto}://${host}/request`));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
