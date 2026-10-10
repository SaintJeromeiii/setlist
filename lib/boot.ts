import { publishPhonePassword } from "./password";
import { startFacebookPoll } from "./facebook";
import { startYouTubePoll } from "./youtube";

export async function boot() {
  await publishPhonePassword();
  startFacebookPoll();
  startYouTubePoll();
}
