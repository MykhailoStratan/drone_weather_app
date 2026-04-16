import type { Config } from "@netlify/functions";
import { searchLocationsFromProvider } from "./_shared/weather";

export default async (req: Request) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim() ?? "";

  if (query.length < 2) {
    return Response.json([]);
  }

  try {
    const locations = await searchLocationsFromProvider(query);
    return Response.json(locations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search locations.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/locations",
  method: "GET",
};
