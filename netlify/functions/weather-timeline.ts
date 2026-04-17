import type { Config } from "@netlify/functions";
import { createTimelineResponse, parseWeatherQuery, toWeatherQuery } from "./_shared/contracts";
import { fetchForecastBundle } from "./_shared/provider";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
    const forecast = await fetchForecastBundle(query);

    return Response.json(
      createTimelineResponse({
        location: query,
        timezone: forecast.timezone,
        latitude: forecast.latitude,
        longitude: forecast.longitude,
        hourly: forecast.hourly,
        daily: forecast.daily,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather timeline is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/weather/timeline",
  method: "GET",
};
