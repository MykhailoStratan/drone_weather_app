import type { Config } from "@netlify/functions";
import type { LocationOption } from "../../packages/weather-domain/src/types";
import { fetchWeatherFromProvider } from "./_shared/weather";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const location = (await req.json()) as LocationOption;
    const payload = await fetchWeatherFromProvider(location);
    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather data is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/weather",
  method: "POST",
};
