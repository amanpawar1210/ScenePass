import { Router } from "express";
import { Event } from "../models/event.js";
import { GroupRoom } from "../models/group-room.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { eventWithAvailability } from "../services/availability.js";
import { randomCode } from "../services/codes.js";
import { currentHold, setHolds } from "../services/holds.js";
import { notify } from "../services/notify.js";

const MAX_MEMBERS = 8;
export const roomsRouter = Router();
roomsRouter.use(requireAuth);

const isMember = (room, user) => room.members.some((m) => m.user.equals(user._id));

async function roomView(room, user) {
  const event = await Event.findById(room.eventId);
  return {
    ...room.toJSON(),
    event: event ? await eventWithAvailability(event) : null,
    hold: room.status === "open" && event ? await currentHold(event._id, room.host) : null,
    isHost: room.host.equals(user._id),
    isMember: isMember(room, user),
  };
}

async function findRoom(code) {
  const room = await GroupRoom.findOne({ code: String(code).toUpperCase() });
  if (!room) throw new HttpError(404, "This group room doesn't exist");
  return room;
}

// Rooms you're in, newest first.
roomsRouter.get("/", async (req, res) => {
  const rooms = await GroupRoom.find({ "members.user": req.user._id }).sort({ updatedAt: -1 }).limit(20);
  res.json(await Promise.all(rooms.map((r) => roomView(r, req.user))));
});

// Opens a room for an event (or returns your open one), with you as host.
roomsRouter.post("/", async (req, res) => {
  const event = await Event.findById(req.body?.eventId);
  if (!event || event.status !== "published") throw new HttpError(404, "Event not found");
  if (event.startsAt <= new Date()) throw new HttpError(400, "This event has already started");

  let room = await GroupRoom.findOne({ eventId: event._id, host: req.user._id, status: "open" });
  if (!room) {
    room = await GroupRoom.create({
      code: randomCode("GR", 6).slice(3),
      eventId: event._id,
      host: req.user._id,
      members: [{ user: req.user._id, name: req.user.name }],
    });
  }
  res.status(201).json(await roomView(room, req.user));
});

roomsRouter.get("/:code", async (req, res) => {
  res.json(await roomView(await findRoom(req.params.code), req.user));
});

roomsRouter.post("/:code/join", async (req, res) => {
  const room = await findRoom(req.params.code);
  if (!isMember(room, req.user)) {
    if (room.status !== "open") throw new HttpError(400, "This group has already booked");
    if (room.members.length >= MAX_MEMBERS) throw new HttpError(400, `Rooms are limited to ${MAX_MEMBERS} people`);
    room.members.push({ user: req.user._id, name: req.user.name });
    await room.save();
    await notify(room.host, {
      type: "room",
      title: `${req.user.name} joined your group`,
      body: "Pick seats together in your group room.",
      link: `/rooms/${room.code}`,
    });
  }
  res.json(await roomView(room, req.user));
});

roomsRouter.post("/:code/leave", async (req, res) => {
  const room = await findRoom(req.params.code);
  if (room.host.equals(req.user._id)) throw new HttpError(400, "The host can't leave their own room");
  room.members = room.members.filter((m) => !m.user.equals(req.user._id));
  room.selection = room.selection.filter((s) => !s.by.equals(req.user._id));
  if (room.status === "open") {
    const event = await Event.findById(room.eventId);
    if (event) await setHolds(event, room.host, room.selection.map((s) => s.seat));
  }
  await room.save();
  res.status(204).end();
});

// Any member can change the shared selection; seats are held under the host's account.
roomsRouter.put("/:code/seats", async (req, res) => {
  const room = await findRoom(req.params.code);
  if (!isMember(room, req.user)) throw new HttpError(403, "Join the room to pick seats");
  if (room.status !== "open") throw new HttpError(400, "This group has already booked");
  const event = await Event.findById(room.eventId);
  if (!event) throw new HttpError(404, "Event not found");

  const result = await setHolds(event, room.host, req.body?.seats);
  const previous = new Map(room.selection.map((s) => [s.seat, s]));
  room.selection = result.seats.map(
    (seat) => previous.get(seat) ?? { seat, by: req.user._id, byName: req.user.name },
  );
  await room.save();
  res.json({ ...(await roomView(room, req.user)), conflicts: result.conflicts });
});
