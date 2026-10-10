import { board } from "@/lib/board";
import { readShow } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(board(await readShow()));
}
