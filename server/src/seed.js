// Reset events to the default lineup: npm run seed
import mongoose from "mongoose";
import { config } from "./config.js";
import { Event } from "./models/event.js";
import { seedEvents } from "./seed-data.js";

if (!config.mongoUri) {
  console.error("Set MONGODB_URI to seed a persistent database.");
  process.exit(1);
}
await mongoose.connect(config.mongoUri);
// The Atlas cluster is shared with other projects (e.g. quickbite); never wipe their data.
if (mongoose.connection.name !== "scenepass") {
  console.error(`Refusing to reset events in database "${mongoose.connection.name}". Only "scenepass" may be seeded.`);
  await mongoose.disconnect();
  process.exit(1);
}
await Event.deleteMany({});
await Event.insertMany(seedEvents);
console.log(`Seeded ${seedEvents.length} events`);
await mongoose.disconnect();
