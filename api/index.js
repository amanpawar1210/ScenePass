// Vercel serverless entry: runs the Express API for every /api/* request.
import { createApp } from "../server/src/app.js";
import { connectDb } from "../server/src/db.js";

const app = createApp();

export default async function handler(req, res) {
  await connectDb();
  return app(req, res);
}
