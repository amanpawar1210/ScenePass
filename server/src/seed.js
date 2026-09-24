// Reset ScenePass events, bookings and demo customers: npm run seed
// Only ever touches the "scenepass" database (the Atlas cluster is shared with other projects).
import mongoose from "mongoose";
import { config } from "./config.js";
import { seedDatabase } from "./services/seeder.js";

if (!config.mongoUri) {
  console.error("Set MONGODB_URI to seed a persistent database.");
  process.exit(1);
}
await mongoose.connect(config.mongoUri);
try {
  const result = await seedDatabase({ reset: true });
  console.log(`Seeded ${result.events} events, ${result.customers} demo customers, ${result.orders} bookings`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
