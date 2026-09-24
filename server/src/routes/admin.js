import { Router } from "express";
import { Event } from "../models/event.js";
import { Order } from "../models/order.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { TIME_ZONE, capacityOf } from "../catalog.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const DAYS = 14;
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }); // YYYY-MM-DD

adminRouter.get("/stats", async (_req, res) => {
  const now = new Date();
  const since = new Date(now.getTime() - DAYS * 86_400_000);
  const confirmed = { status: "confirmed" };

  const [totals, checkedIn, cancelled, daily, byEvent, byCategory, events] = await Promise.all([
    Order.aggregate([
      { $match: confirmed },
      { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 }, tickets: { $sum: { $size: "$seats" } }, discounts: { $sum: "$discount" } } },
    ]),
    Order.aggregate([
      { $match: confirmed },
      { $unwind: "$tickets" },
      { $match: { "tickets.checkedInAt": { $ne: null } } },
      { $count: "n" },
    ]),
    Order.countDocuments({ status: "cancelled" }),
    Order.aggregate([
      { $match: { ...confirmed, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIME_ZONE } },
          revenue: { $sum: "$total" },
          tickets: { $sum: { $size: "$seats" } },
        },
      },
    ]),
    Order.aggregate([
      { $match: confirmed },
      { $group: { _id: "$eventId", revenue: { $sum: "$total" }, tickets: { $sum: { $size: "$seats" } } } },
    ]),
    Order.aggregate([
      { $match: confirmed },
      { $group: { _id: "$event.type", revenue: { $sum: "$total" }, tickets: { $sum: { $size: "$seats" } } } },
      { $sort: { revenue: -1 } },
    ]),
    Event.find(),
  ]);

  // Fill every day in the window so the chart has no gaps.
  const dailyMap = new Map(daily.map((d) => [d._id, d]));
  const revenueByDay = Array.from({ length: DAYS }, (_, i) => {
    const date = dayKey.format(new Date(now.getTime() - (DAYS - 1 - i) * 86_400_000));
    return { date, revenue: dailyMap.get(date)?.revenue ?? 0, tickets: dailyMap.get(date)?.tickets ?? 0 };
  });

  const eventById = new Map(events.map((e) => [String(e._id), e]));
  const topEvents = byEvent
    .filter((r) => eventById.has(String(r._id)))
    .map((r) => {
      const e = eventById.get(String(r._id));
      return {
        id: String(e._id),
        title: e.title,
        city: e.city,
        startsAt: e.startsAt,
        revenue: r.revenue,
        tickets: r.tickets,
        occupancy: r.tickets / capacityOf(e),
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const soldById = new Map(byEvent.map((r) => [String(r._id), r.tickets]));
  const upcoming = events.filter((e) => e.status === "published" && e.startsAt > now);
  const avgOccupancy = upcoming.length
    ? upcoming.reduce((sum, e) => sum + (soldById.get(String(e._id)) ?? 0) / capacityOf(e), 0) / upcoming.length
    : 0;

  const t = totals[0] ?? { revenue: 0, orders: 0, tickets: 0, discounts: 0 };
  res.json({
    revenue: t.revenue,
    orders: t.orders,
    tickets: t.tickets,
    discounts: t.discounts,
    checkedIn: checkedIn[0]?.n ?? 0,
    cancelled,
    upcomingEvents: upcoming.length,
    drafts: events.filter((e) => e.status === "draft").length,
    avgOccupancy,
    revenueByDay,
    topEvents,
    byCategory: byCategory.map((c) => ({ category: c._id, revenue: c.revenue, tickets: c.tickets })),
  });
});

// Door check-in: validates a ticket code and marks it used.
adminRouter.post("/checkin", async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!code) throw new HttpError(400, "Enter a ticket code");
  const order = await Order.findOne({ "tickets.code": code }).populate("user", "name email");
  if (!order) throw new HttpError(404, "No ticket found with that code");
  if (order.status === "cancelled") throw new HttpError(409, "This ticket belongs to a cancelled booking");

  const ticket = order.tickets.find((t) => t.code === code);
  const details = {
    code,
    seat: ticket.seat,
    tier: ticket.tier,
    event: order.event.title,
    startsAt: order.event.startsAt,
    holder: order.user?.name ?? "Guest",
  };
  if (ticket.checkedInAt) {
    return res.status(409).json({ message: "Already checked in", ticket: { ...details, checkedInAt: ticket.checkedInAt } });
  }
  ticket.checkedInAt = new Date();
  await order.save();
  res.json({ message: "Checked in", ticket: { ...details, checkedInAt: ticket.checkedInAt } });
});
