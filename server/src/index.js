import { config } from "./config.js";
import { connectDb, disconnectDb } from "./db.js";
import { createApp } from "./app.js";

await connectDb();
const server = createApp().listen(config.port, () => {
  console.log(`ScenePass API listening on http://localhost:${config.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  });
}
