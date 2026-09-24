import mongoose from "mongoose";
import { config } from "./config.js";
import { Event } from "./models/event.js";
import { seedDatabase } from "./services/seeder.js";

let memoryServer;
let connecting;

/** Connects once per process; serverless invocations reuse the same connection. */
export function connectDb() {
  connecting ??= openConnection().catch((err) => {
    connecting = undefined;
    throw err;
  });
  return connecting;
}

async function openConnection() {
  let uri = config.mongoUri;

  if (!uri) {
    if (config.isProduction) throw new Error("MONGODB_URI must be set in production");
    // Development fallback: spin up a throwaway in-memory MongoDB.
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri("scenepass");
    console.warn("MONGODB_URI not set — using in-memory MongoDB (data resets on restart)");
  }

  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);

  if ((await Event.estimatedDocumentCount()) === 0) {
    const result = await seedDatabase();
    console.log(`Seeded ${result.events} events, ${result.orders} demo bookings`);
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
  await memoryServer?.stop();
}
