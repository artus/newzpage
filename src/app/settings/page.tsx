import type { Metadata } from "next";
import ComposingRoom from "./composing-room";

export const metadata: Metadata = { title: "The composing room" };

export default function SettingsPage() {
  return <ComposingRoom />;
}
