/**
 * Vercel Serverless Function Entrypoint for ShipSafe
 * Handles all /api/* routes seamlessly in serverless environments.
 */

import { handleApiRequest } from '../lib/api-handler.js';

export default async function handler(req, res) {
  return handleApiRequest(req, res, { cwd: process.cwd() });
}
