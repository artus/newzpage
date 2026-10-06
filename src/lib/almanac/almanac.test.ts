import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CITIES, distanceKm, findCities, nearestCity } from "./cities";
import { moonPhase, moonSentence, phaseName } from "./moon";
import { daylight, sunTimes } from "./sun";

const minutesApart = (a: Date | undefined, iso: string) => Math.abs((a!.getTime() - Date.parse(iso)) / 60_000);

describe("sunTimes", () => {
  it("agrees with the almanacs to a few minutes, around the world and the year", () => {
    // Dates are given at each place's own noon, so the reader's calendar day is the right one in any zone.
    const london = sunTimes(new Date("2024-06-21T12:00:00Z"), 51.51, -0.13);
    assert.ok(minutesApart(london.sunrise, "2024-06-21T03:43:00Z") <= 3, `London sunrise ${london.sunrise?.toISOString()}`);
    assert.ok(minutesApart(london.sunset, "2024-06-21T20:21:00Z") <= 3, `London sunset ${london.sunset?.toISOString()}`);
    const amsterdam = sunTimes(new Date("2024-06-21T11:00:00Z"), 52.37, 4.9);
    assert.ok(minutesApart(amsterdam.sunrise, "2024-06-21T03:19:00Z") <= 3, `Amsterdam sunrise ${amsterdam.sunrise?.toISOString()}`);
    assert.ok(minutesApart(amsterdam.sunset, "2024-06-21T20:06:00Z") <= 3, `Amsterdam sunset ${amsterdam.sunset?.toISOString()}`);
    const newYork = sunTimes(new Date("2024-12-21T17:00:00Z"), 40.71, -74.01);
    assert.ok(minutesApart(newYork.sunrise, "2024-12-21T12:17:00Z") <= 3, `New York sunrise ${newYork.sunrise?.toISOString()}`);
    assert.ok(minutesApart(newYork.sunset, "2024-12-21T21:32:00Z") <= 3, `New York sunset ${newYork.sunset?.toISOString()}`);
    const sydney = sunTimes(new Date("2024-12-21T01:00:00Z"), -33.87, 151.21);
    assert.ok(minutesApart(sydney.sunrise, "2024-12-20T18:41:00Z") <= 4, `Sydney sunrise ${sydney.sunrise?.toISOString()}`);
    assert.ok(minutesApart(sydney.sunset, "2024-12-21T09:06:00Z") <= 4, `Sydney sunset ${sydney.sunset?.toISOString()}`);
    assert.equal(daylight(london), "16 h 38 min");
  });

  it("knows the midnight sun and the polar night", () => {
    assert.equal(sunTimes(new Date("2024-06-21T11:00:00Z"), 69.65, 18.96).polar, "day");
    assert.equal(sunTimes(new Date("2024-12-21T11:00:00Z"), 69.65, 18.96).polar, "night");
    assert.equal(daylight(sunTimes(new Date("2024-12-21T11:00:00Z"), 69.65, 18.96)), undefined);
  });
});

describe("moonPhase", () => {
  it("finds the new and full moons of the eclipses, and the quarters between", () => {
    const within = (angle: number, target: number) => Math.min(Math.abs(angle - target), 360 - Math.abs(angle - target)) <= 6;
    assert.ok(within(moonPhase(new Date("2024-04-08T18:21:00Z")).angle, 0), "new moon of the April 2024 eclipse");
    assert.ok(within(moonPhase(new Date("2024-03-25T07:00:00Z")).angle, 180), "full moon of the March 2024 eclipse");
    assert.ok(within(moonPhase(new Date("2024-01-18T03:53:00Z")).angle, 90), "first quarter, January 2024");
    assert.ok(within(moonPhase(new Date("2024-02-02T23:18:00Z")).angle, 270), "last quarter, February 2024");
    assert.equal(moonPhase(new Date("2024-04-08T18:21:00Z")).name, "New moon");
    assert.equal(moonPhase(new Date("2024-03-25T07:00:00Z")).name, "Full moon");
    const week = moonPhase(new Date("2024-04-15T12:00:00Z"));
    assert.equal(week.name, "First quarter");
    assert.ok(week.illumination > 0.4 && week.illumination < 0.6 && week.age > 6 && week.age < 8);
  });

  it("names every phase and speaks of it in a sentence", () => {
    assert.deepEqual([0, 45, 90, 135, 180, 225, 270, 315].map(phaseName), ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"]);
    assert.equal(moonSentence({ angle: 135, illumination: 0.71, name: "Waxing gibbous", age: 11 }), "The moon is a waxing gibbous, 71% lit.");
    assert.equal(moonSentence({ angle: 180, illumination: 1, name: "Full moon", age: 14.8 }), "The moon is full, 100% lit.");
    assert.equal(moonSentence({ angle: 270, illumination: 0.5, name: "Last quarter", age: 22 }), "The moon is at its last quarter, 50% lit.");
  });
});

describe("cities", () => {
  it("are many, distinct, and findable without accents or case", () => {
    assert.ok(CITIES.length >= 180);
    assert.equal(new Set(CITIES.map((city) => `${city.name}, ${city.country}`)).size, CITIES.length);
    assert.ok(CITIES.every((city) => Math.abs(city.lat) <= 90 && Math.abs(city.lon) <= 180));
    for (const city of CITIES) assert.doesNotThrow(() => new Intl.DateTimeFormat("en", { timeZone: city.timeZone }), `${city.name}: ${city.timeZone}`);
    assert.equal(findCities("tokyo")[0].timeZone, "Asia/Tokyo");
    assert.equal(findCities("rott")[0].name, "Rotterdam");
    assert.equal(findCities("SAO PAULO")[0].name, "São Paulo");
    assert.equal(findCities("dusseldorf")[0].name, "Düsseldorf");
    assert.ok(findCities("york").some((city) => city.name === "New York"));
    assert.deepEqual(findCities(""), []);
  });

  it("name the place nearest a point, within reach", () => {
    assert.equal(nearestCity(51.93, 4.5)?.name, "Rotterdam");
    assert.equal(nearestCity(52.3, 4.7)?.name, "Amsterdam");
    assert.equal(nearestCity(0, -150), undefined);
    assert.ok(Math.abs(distanceKm(52.37, 4.9, 51.92, 4.48) - 57) < 5);
  });
});
