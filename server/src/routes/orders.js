import { Router } from "express";
import { Event } from "../models/event.js";
import { Order } from "../models/order.js";
import { SeatHold } from "../models/seat-hold.js";
import { GroupRoom } from "../models/group-room.js";
import { Waitlist } from "../models/waitlist.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { CANCEL_CUTOFF_HOURS } from "../catalog.js";
import { bookedSeats } from "../services/availability.js";
import { randomCode } from "../services/codes.js";
import { quote } from "../services/pricing.js";
import { snapshot } from "../services/seeder.js";
import { notify } from "../services/notify.js";
import { timeLabel } from "../services/format.js";
import { PaymentAuth } from "../models/payment-auth.js";
import { OTP } from "./payments.js";
import { publish } from "../services/bus.js";
import { sendBookingEmail } from "../services/emails.js";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

// Customers see their own bookings; organizers see the 200 most recent across everyone.
ordersRouter.get("/", async (req, res) => {
  if (req.user.role === "admin") {
    res.json(await Order.find().sort({ createdAt: -1 }).limit(200).populate("user", "name email"));
  } else {
    res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 }));
  }
});

async function bookableEvent(eventId) {
  const event = await Event.findById(eventId);
  if (!event || event.status !== "published") throw new HttpError(404, "Event not found");
  if (event.startsAt <= new Date()) throw new HttpError(400, "This event has already started");
  return event;
}

ordersRouter.post("/quote", async (req, res) => {
  const event = await bookableEvent(req.body?.eventId);
  const q = await quote({ event, seatIds: req.body?.seats, promoCode: req.body?.promoCode, user: req.user });
  res.json({ subtotal: q.subtotal, discount: q.discount, total: q.total, promo: q.promo, promoError: q.promoError });
});

ordersRouter.post("/", async (req, res) => {
  const event = await bookableEvent(req.body?.eventId);
  // Group checkout: only the host pays, for the room's shared selection.
  const room = req.body?.roomCode ? await GroupRoom.findOne({ code: String(req.body.roomCode).toUpperCase() }) : null;
  if (req.body?.roomCode) {
    if (!room || !room.eventId.equals(event._id)) throw new HttpError(404, "Group room not found");
    if (!room.host.equals(req.user._id)) throw new HttpError(403, "Only the room host can check out");
    if (room.status !== "open") throw new HttpError(409, "This group has already booked");
  }
  const q = await quote({ event, seatIds: req.body?.seats, promoCode: req.body?.promoCode, user: req.user });
  if (q.promoError) throw new HttpError(400, q.promoError);
  const ids = q.seats.map((s) => s.id);

  // Only seats this user currently holds can be booked; the unique hold index
  // is what stops two people buying the same seat.
  // Step 2 of the dummy payment: the authorisation must match this exact booking.
  const auth = await PaymentAuth.findById(req.body?.authId).catch(() => null);
  if (!auth || !auth.user.equals(req.user._id) || auth.used) throw new HttpError(402, "Payment session expired. Please pay again.");
  if (!auth.eventId.equals(event._id) || auth.amount !== q.total || [...auth.seats].sort().join() !== [...ids].sort().join()) {
    throw new HttpError(409, "Your booking changed. Please review and pay again.");
  }
  if (auth.otpRequired && String(req.body?.otp ?? "") !== OTP) {
    auth.attempts += 1;
    if (auth.attempts >= 3) auth.used = true;
    await auth.save();
    throw new HttpError(400, auth.used ? "Too many wrong OTPs. Payment cancelled." : "Incorrect OTP. Please try again.");
  }

  const holds = await SeatHold.countDocuments({
    eventId: event._id,
    user: req.user._id,
    seat: { $in: ids },
    expiresAt: { $gt: new Date() },
  });
  if (holds !== ids.length) throw new HttpError(409, "Your seat hold expired. Please pick your seats again.");
  const booked = await bookedSeats(event._id);
  if (ids.some((id) => booked.has(id))) throw new HttpError(409, "Some of those seats were just booked. Pick others.");

  const order = await Order.create({
    code: randomCode("SP"),
    user: req.user._id,
    eventId: event._id,
    event: snapshot(event),
    seats: ids,
    tickets: q.seats.map((s) => ({ code: randomCode("TK"), seat: s.id, tier: s.tier, price: s.price })),
    subtotal: q.subtotal,
    discount: q.discount,
    promoCode: q.promo?.code ?? null,
    total: q.total,
    payment: { method: auth.method, label: auth.label, txnId: randomCode("TXN", 10), paidAt: new Date() },
  });
  auth.used = true;
  await auth.save();
  publish(`event:${event._id}`, { type: "seats" });
  await SeatHold.deleteMany({ eventId: event._id, user: req.user._id });

  await notify(req.user._id, {
    type: "booking",
    title: `You're going to ${event.title}!`,
    body: `${ids.length} ${ids.length === 1 ? "ticket" : "tickets"} · ${timeLabel(event.startsAt)} · ${event.venue}`,
    link: `/tickets?booked=${order.id}`,
  });
  if (room) {
    room.status = "booked";
    room.orderId = order._id;
    await room.save();
    publish(`room:${room.code}`, { type: "room" });
    await notify(room.members.map((m) => m.user).filter((u) => !u.equals(req.user._id)), {
      type: "room",
      title: `${req.user.name} booked your group's seats`,
      body: `${event.title} · seats ${ids.join(", ")}`,
      link: `/rooms/${room.code}`,
    });
  }
  res.status(201).json(order);

  // Confirmation email with QR tickets, sent after responding so checkout stays fast.
  sendBookingEmail({ to: req.user.email, name: req.user.name, order })
    .then((email) => Order.updateOne({ _id: order._id }, { $set: { email } }))
    .catch(() => {});
});

ordersRouter.post("/:id/cancel", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order || (!order.user.equals(req.user._id) && req.user.role !== "admin")) throw new HttpError(404, "Booking not found");
  if (order.status === "cancelled") throw new HttpError(409, "This booking is already cancelled");
  const cutoff = new Date(order.event.startsAt.getTime() - CANCEL_CUTOFF_HOURS * 3_600_000);
  if (new Date() > cutoff) {
    throw new HttpError(400, `Bookings can be cancelled up to ${CANCEL_CUTOFF_HOURS} hours before the show`);
  }
  if (order.tickets.some((t) => t.checkedInAt)) throw new HttpError(400, "Checked-in tickets can't be cancelled");

  order.status = "cancelled";
  order.cancelledAt = new Date();
  if (order.payment?.method) order.payment.refundedAt = new Date();
  await order.save();
  publish(`event:${order.eventId}`, { type: "seats" });

  await notify(order.user, {
    type: "cancelled",
    title: `Booking cancelled: ${order.event.title}`,
    body: `A full refund of ₹${order.total.toLocaleString("en-IN")} is on its way.`,
    link: "/tickets",
  });
  // Let the waitlist know seats just opened up.
  const waiting = await Waitlist.find({ eventId: order.eventId, user: { $ne: order.user } });
  await notify(waiting.map((w) => w.user), {
    type: "waitlist",
    title: `Seats just opened up for ${order.event.title}`,
    body: `${order.seats.length} ${order.seats.length === 1 ? "seat is" : "seats are"} available again. Grab them before they go.`,
    link: `/events/${order.eventId}`,
  });
  res.json(order);
});
