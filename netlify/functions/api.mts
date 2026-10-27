import serverless from "serverless-http";
import { createApp } from "../../server/src/app";
import { getImportStatus, importFlights } from "../../server/src/modules/flight-import/import.service";
import { listFlights } from "../../server/src/modules/flights/flight-list.service";

// Netlify rewrites /api/* here; Express continues to receive the same paths.
export const handler = serverless(
  createApp({ getImportStatus, importFlights }, { listFlights }),
);
