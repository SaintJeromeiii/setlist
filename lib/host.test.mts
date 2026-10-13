import assert from "node:assert/strict";
import { boothBrowserOrigin, isLoopbackHost } from "./host.ts";

assert.equal(isLoopbackHost("127.0.0.1:3848"), true);
assert.equal(isLoopbackHost("localhost:3848"), true);
assert.equal(isLoopbackHost("[::1]:3848"), true);
assert.equal(isLoopbackHost("192.168.1.20:3848"), false);
assert.equal(isLoopbackHost("setlist.example"), false);
assert.equal(boothBrowserOrigin("3857"), "http://127.0.0.1:3857");

console.log("host tests passed");
