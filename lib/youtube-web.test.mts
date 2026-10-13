import assert from "node:assert/strict";
import { liveChatKind, readChatPage, readLiveSession } from "./youtube-web.ts";

const html = `
"INNERTUBE_API_KEY":"test-key"
"INNERTUBE_CLIENT_VERSION":"2.20261012.01.00"
"liveChatRenderer":{"continuations":[{"reloadContinuationData":{"continuation":"token-1"}}]
`;

const session = readLiveSession(html);
assert.equal(session?.apiKey, "test-key");
assert.equal(session?.clientVersion, "2.20261012.01.00");
assert.equal(session?.continuation, "token-1");
assert.equal(readLiveSession("<html>offline</html>"), null);

const page = readChatPage({
  continuationContents: {
    liveChatContinuation: {
      continuations: [{ invalidationContinuationData: { continuation: "token-2", timeoutMs: 10000 } }],
      actions: [
        {
          addChatItemAction: {
            item: {
              liveChatTextMessageRenderer: {
                id: "m1",
                timestampUsec: "1791911409340619",
                message: { runs: [{ text: "Harvest Moon" }, { text: " - Neil Young" }] },
                authorName: { simpleText: "@booth" },
                authorExternalChannelId: "UC123",
              },
            },
          },
        },
        {
          addChatItemAction: {
            item: {
              liveChatPaidMessageRenderer: {
                id: "m2",
                timestampUsec: "1791911409341619",
                message: { simpleText: "River by Joni Mitchell" },
                authorName: { simpleText: "Guest" },
                authorExternalChannelId: "UC456",
              },
            },
          },
        },
        {
          addChatItemAction: {
            item: { liveChatViewerEngagementMessageRenderer: { id: "skip" } },
          },
        },
      ],
    },
  },
});

assert.equal(page.ended, false);
assert.equal(page.continuation, "token-2");
assert.equal(page.waitMs, 10000);
assert.deepEqual(
  page.lines.map((line) => [line.id, line.text, line.author, line.channelId]),
  [
    ["m1", "Harvest Moon - Neil Young", "@booth", "UC123"],
    ["m2", "River by Joni Mitchell", "Guest", "UC456"],
  ],
);
assert.equal(page.lines[0].timestampMs, 1791911409341);

const ended = readChatPage({
  continuationContents: {
    liveChatContinuation: {
      continuations: [{ liveChatReplayContinuationData: { continuation: "replay" } }],
      actions: [],
    },
  },
});
assert.equal(ended.ended, true);
assert.equal(ended.continuation, "");

const liveHtml = `${html}"title":"Top chat"`;
const replayHtml = `${html}"title":"Live chat replay"`;
assert.equal(liveChatKind(liveHtml), "live");
assert.equal(liveChatKind(replayHtml), "replay");
assert.equal(liveChatKind("<html></html>"), "none");

console.log("youtube-web tests passed");
