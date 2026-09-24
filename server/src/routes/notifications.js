import { Router } from "express";
import { Notification } from "../models/notification.js";
import { Order } from "../models/order.js";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../services/notify.js";
import { timeLabel } from "../services/format.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// Reminders are created lazily for bookings starting within the next 48 hours.
async function ensureReminders(user) {
  const now = new Date();
  const soon = await Order.find({
    user: user._id,
    status: "confirmed",
    "event.startsAt": { $gt: now, $lte: new Date(now.getTime() + 48 * 3_600_000) },
  });
  await Promise.all(
    soon.map((o) =>
      notify(user._id, {
        type: "reminder",
        title: `${o.event.title} is coming up`,
        body: `${timeLabel(o.event.startsAt)} at ${o.event.venue}. Your QR tickets are in your wallet.`,
        link: `/tickets?booked=${o.id}`,
        key: `reminder:${o.id}`,
      }),
    ),
  );
}

notificationsRouter.get("/", async (req, res) => {
  await ensureReminders(req.user);
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ items, unread });
});

notificationsRouter.post("/read-all", async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.status(204).end();
});

notificationsRouter.post("/:id/read", async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { read: true } });
  res.status(204).end();
});
