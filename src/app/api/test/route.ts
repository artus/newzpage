import { Logger } from "@/lib/helpers/logger";
import { NextRequest, NextResponse } from "next/server";
import { AsyncTry, Optional } from "voft";

export const GET = async (req: NextRequest) => {

  const result = AsyncTry.of<Optional<string>>(async () => {
    throw new Error("reee");
  }).recoverWith((error) => {
    return Optional.empty();
  });

  const optional = await result.get();

  if (optional.isPresent()) {
    Logger.debug(`test is present`);
  } else {
    Logger.debug(`test is not present`);
  }

  return NextResponse.json({ message: "Hello, World!" });
}