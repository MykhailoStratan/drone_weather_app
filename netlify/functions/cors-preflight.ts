import type { Config } from "@netlify/functions";
import { CORS_HEADERS } from "./_shared/cors";

export default async () => new Response(null, { status: 204, headers: CORS_HEADERS });

export const config: Config = {
  path: "/api/*",
  method: "OPTIONS",
};
