import type { Config } from "@netlify/functions";
import { createAlertsResponse, parseWeatherQuery, toWeatherQuery } from "./_shared/contracts";
import { fetchForecastBundle, fetchUnitedStatesAlerts } from "./_shared/provider";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
    const [forecast, alerts] = await Promise.all([
      fetchForecastBundle(query),
      fetchUnitedStatesAlerts(query),
    ]);

    return Response.json(
      createAlertsResponse({
        location: query,
        timezone: forecast.timezone,
        latitude: forecast.latitude,
        longitude: forecast.longitude,
        alerts,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather alerts are unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/weather/alerts",
  method: "GET",
};
