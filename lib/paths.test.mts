import assert from "node:assert/strict";
import path from "node:path";
import { dataDir } from "./paths.ts";

const previous = process.env.SETLIST_DATA_DIR;
process.env.SETLIST_DATA_DIR = "/tmp/setlist-booth";
assert.equal(dataDir(), "/tmp/setlist-booth");
delete process.env.SETLIST_DATA_DIR;
assert.equal(dataDir(), path.join(process.cwd(), "data"));
if (previous === undefined) delete process.env.SETLIST_DATA_DIR;
else process.env.SETLIST_DATA_DIR = previous;

console.log("paths tests passed");
