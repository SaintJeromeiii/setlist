import RequestDesk from "@/components/RequestDesk";
import { isRequestId } from "@/lib/requests";
import { readShow } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RequestStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const show = await readShow();
  return <RequestDesk venueName={show.settings.venueName} trackId={isRequestId(id) ? id : undefined} invalidLink={!isRequestId(id)} />;
}
