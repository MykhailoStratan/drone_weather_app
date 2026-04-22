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
  fetchedAt: "2026-04-15T19:00:00.000Z",
  country: "CA",
  dataSources: ["Mock airspace"],
  features: [
    {
      id: "cyvr-controlled",
      name: "Vancouver International",
      icao: "CYVR",
      classification: "controlled",
      featureType: "airport",
      source: "mock",
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
  await page.route("**/api/v1/weather/overview**", async (route) => {
    await route.fulfill({ json: overviewPayload });
  });
  await page.route("**/api/v1/weather/timeline**", async (route) => {
    await route.fulfill({ json: timelinePayload });
  });
  await page.route("**/api/v1/weather/alerts**", async (route) => {
    await route.fulfill({ json: alertsPayload });
  });
  await page.route("**/api/v1/airspace**", async (route) => {
    await route.fulfill({ json: airspacePayload });
  });
  await page.route("**/api/v1/locations**", async (route) => {
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

test("loads the Now tab weather dashboard with mocked data", async ({ page }) => {
  await page.goto(locationQuery);

  await expect(page.getByRole("heading", { name: "Clear sky", level: 2 })).toBeVisible();
  await expect(page.getByText("Wind Direction")).toBeVisible();
  await expect(page.getByText("Flight Readiness")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Select forecast hour" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Now" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Map" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Drone" })).toBeVisible();
});

test("supports preferences and the Map and Drone tabs", async ({ page }) => {
  await page.goto(locationQuery);

  await page.getByRole("button", { name: /12h/i }).click();
  const preferencesPanel = page.locator(".lbar-prefs-section");
  await preferencesPanel.getByRole("button", { name: "F", exact: true }).click();
  await preferencesPanel.getByRole("button", { name: "Light", exact: true }).click();

  await expect(page.locator(".temperature-unit")).toContainText("F");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("tab", { name: "Drone" }).click();
  await expect(page.getByText("Battery Thermal Performance")).toBeVisible();
  await expect(page.getByText("Dew point", { exact: true })).toBeVisible();
  await expect(page.getByText("Density Altitude")).toBeVisible();

  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.locator(".airspace-panel-header")).toContainText("Airspace");
  await expect(page.locator(".airspace-status-badge")).toContainText("Controlled airspace nearby");
  await expect(page.getByText("Vancouver International")).toBeVisible();
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

test("opens the date picker and exposes the available 14-day range", async ({ page }) => {
  await page.goto(locationQuery);

  await page.getByRole("button", { name: "Choose forecast date" }).click();

  const picker = page.getByRole("dialog", { name: "Forecast dates" });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("button", { name: /History Thu, Apr 9/i })).toBeVisible();
  await expect(picker.getByRole("button", { name: /Today Wed, Apr 15/i })).toBeVisible();
  await expect(picker.getByRole("button", { name: /Forecast Wed, Apr 22/i })).toBeVisible();
});

test("choosing a future date from the date picker switches to full-day timeline mode", async ({ page }) => {
  await page.goto(locationQuery);

  await page.getByRole("button", { name: "Choose forecast date" }).click();
  await page.getByRole("button", { name: /Forecast Thu, Apr 16/i }).click();

  await expect(page.locator(".summary-badge")).toContainText("Apr 16");
  await expect(page.locator(".hour-scrubber-ticks span").first()).toContainText("12:00 AM");
  await expect(page.locator(".hour-scrubber-tick-now")).toContainText("11:00 AM");
  await expect(page.locator(".hour-scrubber-ticks span").last()).toContainText("11:00 PM");
  await expect(page.locator(".temperature-value")).toContainText("15");
  await expect(page.getByText("11:00 AM: 15 C")).toBeVisible();
  await expect(page.locator(".hour-scrubber-seg.prev-day")).toHaveCount(0);
});

test("keeps today highlighted in green when another date is selected", async ({ page }) => {
  await page.goto(locationQuery);

  await page.getByRole("button", { name: "Choose forecast date" }).click();
  await page.getByRole("button", { name: /Forecast Thu, Apr 16/i }).click();
  await page.getByRole("button", { name: "Choose forecast date" }).click();

  const todayButton = page.getByRole("button", { name: /Today Wed, Apr 15/i });
  await expect(todayButton).toHaveClass(/today/);
  await expect(todayButton).not.toHaveClass(/active/);
  await expect(todayButton).toHaveCSS("color", "rgb(48, 217, 184)");
});

test("choosing today from the date picker restores the current-hour centered timeline", async ({ page }) => {
  await page.goto(locationQuery);

  await page.getByRole("button", { name: "Choose forecast date" }).click();
  await page.getByRole("button", { name: /Forecast Thu, Apr 16/i }).click();
  await expect(page.locator(".hour-scrubber-tick-now")).toContainText("11:00 AM");

  await page.getByRole("button", { name: "Choose forecast date" }).click();
  await page.getByRole("button", { name: /Today Wed, Apr 15/i }).click();

  await expect(page.locator(".summary-badge")).toContainText("Apr 15");
  await expect(page.locator(".hour-scrubber-tick-now")).toContainText("12:00 PM");
  await expect(page.locator(".hour-scrubber-seg.next-day").first()).toBeVisible();
});

test("mobile tabs do not create horizontal overflow and clear the fixed tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 462, height: 900 });
  await page.goto(locationQuery);
  await expect(page.getByRole("heading", { name: "Clear sky", level: 2 })).toBeVisible();

  for (const tabName of ["Now", "Map", "Drone"]) {
    await page.getByRole("tab", { name: tabName }).click();
    await page.waitForTimeout(150);

    const widthMetrics = await page.evaluate(() => ({
      docClientWidth: document.documentElement.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(widthMetrics.docScrollWidth).toBe(widthMetrics.docClientWidth);
    expect(widthMetrics.bodyScrollWidth).toBe(widthMetrics.bodyClientWidth);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const clearance = await page.evaluate(() => {
      const tabBar = document.querySelector(".app-tab-bar")?.getBoundingClientRect();
      const children = Array.from(document.querySelectorAll(".tab-content > *"));
      const lastContent = children[children.length - 1]?.getBoundingClientRect();
      if (!tabBar || !lastContent) return 0;
      return Math.round(tabBar.top - lastContent.bottom);
    });
    expect(clearance).toBeGreaterThanOrEqual(0);
  }
});
