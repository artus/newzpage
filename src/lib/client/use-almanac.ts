import { useSyncExternalStore } from "react";
import { nearestCity } from "@/lib/almanac/cities";
import { getAlmanacSnapshot, subscribeAlmanac, type AlmanacPlace, type AlmanacSnapshot } from "./almanac-store";

const unknown = () => undefined;

/** The place the almanac is set to: undefined until hydration, null when none is set. */
export function useAlmanacPlace(): AlmanacSnapshot | undefined {
  return useSyncExternalStore(subscribeAlmanac, getAlmanacSnapshot, unknown);
}

/** A hundredth of a degree is about a kilometre: enough for the sun, and less than the browser knows. */
const round = (value: number) => Math.round(value * 100) / 100;

/** Asks the browser where the reader is. Rejects with a sentence the masthead can print. */
export function locateReader(): Promise<AlmanacPlace> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return reject(new Error("This browser cannot share a location; pick a city instead."));
    if (!window.isSecureContext) return reject(new Error("Browsers share locations only over https; pick a city instead."));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = round(position.coords.latitude);
        const lon = round(position.coords.longitude);
        resolve({ lat, lon, name: nearestCity(lat, lon)?.name, source: "browser" });
      },
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? "The location was refused; pick a city instead." : "No location came through; pick a city instead.")),
      { timeout: 10_000, maximumAge: 3_600_000 },
    );
  });
}
