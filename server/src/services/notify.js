import { Notification } from "../models/notification.js";

/**
 * Sends an in-app notification to one or more users. With a `key`, each user
 * receives it at most once (later calls are ignored).
 */
export async function notify(userIds, { type, title, body = "", link = "", key = null }) {
  const ids = [...new Set([].concat(userIds).filter(Boolean).map(String))];
  await Promise.all(
    ids.map((user) =>
      key
        ? Notification.updateOne({ user, key }, { $setOnInsert: { user, key, type, title, body, link } }, { upsert: true })
        : Notification.create({ user, type, title, body, link }),
    ),
  );
}
