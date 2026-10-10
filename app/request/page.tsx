import RequestDesk from "@/components/RequestDesk";
import { readShow } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const show = await readShow();
  return <RequestDesk venueName={show.settings.venueName} />;
}
