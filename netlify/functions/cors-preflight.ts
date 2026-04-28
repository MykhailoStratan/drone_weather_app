import type { Config } from "@netlify/functions";

export default async () => new Response(null, { status: 204 });

export const config: Config = {
  path: "/api/*",
  method: "OPTIONS",
};
