import { expect, test, type Page } from "@playwright/test";

const locationQuery =
  "/?lat=49.2497&lon=-123.1193&name=Vancouver&admin1=British+Columbia&country=Canada&tz=America%2FVancouver";

const baseWeather = {
  locationLabel: "Vancouver, British Columbia, Canada",
  timezone: "America/Vancouver",
  latitude: 49.2497,
  longitude: -123.1193,
};

const overviewPayload = {
  ...baseWeather,
  current: {
    time: "2026-04-15T12:00",
    temperature: 4,
    windSpeed: 6,
    windGusts: 10,
    windDirection: 114,
    precipitationAmount: 0.4,
    precipitationProbability: 12,
    cloudCover: 31,
    visibility: 10000,
    pressure: 1015,
    weatherCode: 0,
    isDay: 1,
    windSpeed80m: 14,
    windGusts80m: 22,
    windDirection80m: 135,
    windSpeed120m: 18,
    windGusts120m: 24,
    windDirection120m: 150,
    relativeHumidity: 61,
  },
  today: {
    date: "2026-04-15",
    sunrise: "2026-04-15T06:15",
    sunset: "2026-04-15T19:55",
    temperatureMax: 9,
    temperatureMin: 3,
    windSpeedMax: 12,
    windGustsMax: 18,
    precipitationProbabilityMax: 35,
    precipitationHours: 2,
    precipitationSum: 1.2,
    weatherCode: 0,
  },
};

const timelinePayload = {
  ...baseWeather,
  hourly: Array.from({ length: 48 }, (_, index) => {
    const day = index < 24 ? 15 : 16;
    const hour = index % 24;
    const isTomorrowMidnight = index === 24;
    return {
      time: `2026-04-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`,
      temperature: isTomorrowMidnight ? 19 : 3 + index / 3,
      windSpeed: 5 + (index % 24) / 4,
      windGusts: index === 0 ? 42 : isTomorrowMidnight ? 36 : 7 + (index % 24) / 3,
      windDirection: index < 24 ? 90 : 140,
      precipitationAmount: hour > 14 && hour < 20 ? 0.8 : 0,
      precipitationProbability: isTomorrowMidnight ? 74 : index < 24 ? hour * 2 : 20 + hour,
      cloudCover: 20 + hour,
      visibility: index === 0 ? 2500 : isTomorrowMidnight ? 4000 : 10000,
      pressure: 1012 - Math.floor(index / 12),
      weatherCode: 0,
      isDay: hour > 5 && hour < 20 ? 1 : 0,
      relativeHumidity: isTomorrowMidnight ? 72 : 58 + (hour % 4),
    };
  }),
  daily: Array.from({ length: 14 }, (_, index) => ({
    date: `2026-04-${String(index + 9).padStart(2, "0")}`,
    sunrise: "2026-04-15T06:15",
    sunset: "2026-04-15T19:55",
    temperatureMax: 9 + index,
    temperatureMin: 3 + Math.floor(index / 2),
    windSpeedMax: 12 + index,
    windGustsMax: 18 + index,
    precipitationProbabilityMax: index === 7 ? 76 : 35,
    precipitationHours: 2,
    precipitationSum: 1.2,
    weatherCode: 0,
  })),
};

const alertsPayload = {
  ...baseWeather,
  alerts: [
    {
      id: "alert-1",
      event: "Wind Advisory",
      headline: "Strong gusts possible near the coast this evening.",
      severity: "Moderate",
      urgency: "Expected",
      area: "Metro Vancouver",
      description: "Brief periods of stronger surface winds are possible.",
      startsAt: "2026-04-15T18:00:00-07:00",
      endsAt: "2026-04-16T02:00:00-07:00",
    },
  ],
};

const airspacePayload = {
  latitude: 49.2497,
  longitude: -123.1193,
  features: [
    {
      id: "cyvr-controlled",
      name: "Vancouver International",
      icao: "CYVR",
      classification: "controlled",
      featureType: "airport",
      latitude: 49.1947,
      longitude: -123.1792,
      distanceKm: 7.8,
      bearingDeg: 214,
      zoneRadiusKm: 4,
      altitudeLowerFt: 0,
      altitudeUpperFt: 3000,
    },
  ],
  tfrs: [],
};

async function mockWeatherApis(page: Page) {
  await page.route("**/api/v1/weather/overview?**", async (route) => {
    await route.fulfill({ json: overviewPayload });
  });
  await page.route("**/api/v1/weather/timeline?**", async (route) => {
    await route.fulfill({ json: timelinePayload });
  });
  await page.route("**/api/v1/weather/alerts?**", async (route) => {
    await route.fulfill({ json: alertsPayload });
  });
  await page.route("**/api/v1/airspace?**", async (route) => {
    await route.fulfill({ json: airspacePayload });
  });
  await page.route("**/api/v1/locations?**", async (route) => {
    await route.fulfill({
      json: [
        {
          id: 2,
          name: "Seattle",
          admin1: "Washington",
          country: "United States",
          latitude: 47.6062,
          longitude: -122.3321,
          timezone: "America/Los_Angeles",
        },
      ],
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const fixedNow = new Date("2026-04-15T12:00:00").getTime();
    Date.now = () => fixedNow;
  });
  await mockWeatherApis(page);
});

test("loads the main weather dashboard with mocked data", async ({ page }) => {
  await page.goto(locationQuery);

  await expect(page.getByRole("heading", { name: "Clear sky", level: 2 })).toBeVisible();
  await expect(page.getByText("Wind direction")).toBeVisible();
  await expect(page.getByText("Flight readiness")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Select forecast hour" })).toBeVisible();
  await expect(page.getByText("Airspace · restrictions")).toBeVisible();
  await expect(page.locator(".airspace-status-badge")).toContainText("Controlled airspace nearby");
});

test("supports preferences, detail tabs, and hourly cards", async ({ page }) => {
  await page.goto(locationQuery);

  await page.getByRole("button", { name: /12h/i }).click();
  const preferencesPanel = page.locator(".lbar-prefs-section");
  await preferencesPanel.getByRole("button", { name: "F", exact: true }).click();
  await preferencesPanel.getByRole("button", { name: "Light", exact: true }).click();

  await expect(page.locator(".temperature-unit")).toContainText("F");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Show hourly cards" }).click();
  await expect(page.getByRole("heading", { name: "Detailed readout", level: 3 })).toBeVisible();

  await page.getByRole("button", { name: "7 days" }).click();
  await expect(page.getByRole("heading", { name: "Next 7 days", level: 3 })).toBeVisible();

  await page.getByRole("button", { name: /Alerts/ }).click();
  await expect(page.getByRole("heading", { name: "Weather warnings for this area", level: 3 })).toBeVisible();
  await expect(page.getByText("Wind Advisory")).toBeVisible();
});

test("updates the hero and readiness panel when the selected hour changes", async ({ page }) => {
  await page.goto(locationQuery);

  await expect(page.locator(".readiness-summary")).toContainText("comfortable range");

  const slider = page.getByRole("slider", { name: "Select forecast hour" });
  await slider.fill("0");

  await expect(page.locator(".temperature-value")).toContainText("3");
  await expect(page.locator(".readiness-summary")).toContainText("gusts are reaching 42");
  await expect(page.locator(".readiness-summary")).toContainText("visibility is down to 2.5 km");
});

test("clicking the visible tomorrow hour updates the page using tomorrow snapshot logic", async ({ page }) => {
  await page.goto(locationQuery);

  await expect(page.locator(".hour-scrubber-tick-now")).toContainText("12:00 PM");

  const tomorrowSegment = page.locator(".hour-scrubber-seg.next-day").first();
  await expect(tomorrowSegment).toBeVisible();
  await tomorrowSegment.click();

  await expect(page.locator(".summary-badge")).toContainText("Apr 16");
  await expect(page.locator(".hour-scrubber-header strong")).toContainText("12:00 AM");
  await expect(page.locator(".temperature-value")).toContainText("19");
  await expect(page.locator(".hour-scrubber-tick-now")).toContainText("12:00 PM");
  await expect(page.locator(".hour-scrubber-seg.prev-day").first()).toBeVisible();
  await expect(page.locator(".readiness-summary")).toContainText("gusts are reaching 36");
  await expect(page.locator(".readiness-summary")).toContainText("visibility is down to 4.0 km");
  await expect(page.locator(".readiness-summary")).toContainText("76% rain potential");
});
