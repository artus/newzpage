"use client";

import { useState } from "react";
import { findCities, type City } from "@/lib/almanac/cities";
import { clearAlmanacPlace, saveAlmanacPlace, type AlmanacPlace } from "@/lib/client/almanac-store";
import { locateReader, useAlmanacPlace } from "@/lib/client/use-almanac";

function describe(place: AlmanacPlace): string {
  const coordinates = `${Math.abs(place.lat).toFixed(2)}° ${place.lat >= 0 ? "N" : "S"}, ${Math.abs(place.lon).toFixed(2)}° ${place.lon >= 0 ? "E" : "W"}`;
  if (place.source === "browser") return `${place.name ? `Near ${place.name}` : "Your location"} (${coordinates}), from your browser.`;
  return `${place.name ?? "A place"} (${coordinates}).`;
}

/** Where the almanac is worked out for: the browser's word, or a city from the bundled list. */
export default function AlmanacSettings() {
  const place = useAlmanacPlace();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const matches = query.trim().length >= 2 ? findCities(query, 6) : [];

  const choose = (city: City) => {
    saveAlmanacPlace({ lat: city.lat, lon: city.lon, name: city.name, timeZone: city.timeZone, source: "city" });
    setQuery("");
    setNotice(`The almanac is set to ${city.name}, ${city.country}.`);
  };
  const onLocate = async () => {
    setBusy(true);
    try {
      const found = await locateReader();
      saveAlmanacPlace(found);
      setNotice(`The almanac is set from your browser${found.name ? `, near ${found.name}` : ""}.`);
    } catch (caught) {
      setNotice((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const onForget = () => {
    clearAlmanacPlace();
    setNotice("The place is forgotten; the masthead will offer to find one again.");
  };

  return (
    <div className="almanac-form">
      <p className="almanac-form__status" role="status">
        {place === undefined ? " " : place === null ? "No place is set; the masthead offers to use your location." : describe(place)}
      </p>
      <div className="settings__toolbar">
        <button type="button" className="button" onClick={onLocate} disabled={busy}>
          {busy ? "Finding you…" : "Use my location"}
        </button>
        {place ? (
          <button type="button" className="button" onClick={onForget}>
            Forget the place
          </button>
        ) : null}
      </div>
      <label className="field field--name">
        <span>Or a city</span>
        <input
          name="almanac-city"
          value={query}
          placeholder="Rotterdam"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches[0]) {
              event.preventDefault();
              choose(matches[0]);
            }
          }}
        />
      </label>
      {matches.length > 0 ? (
        <ul className="almanac-form__matches">
          {matches.map((city) => (
            <li key={`${city.name}, ${city.country}`}>
              <button type="button" className="button" onClick={() => choose(city)}>
                {city.name}, {city.country}
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 ? (
        <p className="settings__hint">No such city in the list; the nearest large one will do for the sun.</p>
      ) : null}
      {notice ? (
        <p className="settings__hint" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
