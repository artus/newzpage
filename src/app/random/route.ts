import { redirect } from "next/navigation";
import { randomEntry } from "@/lib/feeds/directory";

export const dynamic = "force-dynamic";

/** GET /random — sends the reader to a wire drawn at random from the bundled directory. */
export function GET() {
  const entry = randomEntry();
  const query = new URLSearchParams({ feed: entry.url, name: entry.name });
  redirect(`/wire?${query}`);
}
