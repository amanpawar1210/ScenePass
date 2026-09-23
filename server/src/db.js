import mongoose from "mongoose";
import { config } from "./config.js";
import { seedEvents } from "./seed-data.js";
import { Event } from "./models/event.js";

let memoryServer;

export async function connectDb() {
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
    await Event.insertMany(seedEvents);
    console.log(`Seeded ${seedEvents.length} events`);
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
  await memoryServer?.stop();
}
