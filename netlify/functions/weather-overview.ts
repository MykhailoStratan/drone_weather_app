import type { Config } from "@netlify/functions";
import { createOverviewResponse, parseWeatherQuery, toWeatherQuery } from "./_shared/contracts";
import { fetchForecastBundle } from "./_shared/provider";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
    const forecast = await fetchForecastBundle(query);
    const today = forecast.daily[7] ?? forecast.daily[0];

    return Response.json(
      createOverviewResponse({
        location: query,
        timezone: forecast.timezone,
        latitude: forecast.latitude,
        longitude: forecast.longitude,
        current: forecast.current,
        today,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather overview is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/weather/overview",
  method: "GET",
};
