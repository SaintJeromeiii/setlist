export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { publishPhonePassword } = await import("./lib/password");
  const { startFacebookPoll } = await import("./lib/facebook");
  const { startYouTubePoll } = await import("./lib/youtube");
  await publishPhonePassword();
  startFacebookPoll();
  startYouTubePoll();
}
