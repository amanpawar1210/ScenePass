import { Router } from "express";
import { Event } from "../models/event.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

export const favouritesRouter = Router();
favouritesRouter.use(requireAuth);

favouritesRouter.get("/", (req, res) => {
  res.json(req.user.favourites.map(String));
});

// Toggle an event in the current user's saved list.
favouritesRouter.put("/:eventId", async (req, res) => {
  const { eventId } = req.params;
  if (!(await Event.exists({ _id: eventId }))) throw new HttpError(404, "Event not found");

  const saved = req.user.favourites.some((id) => id.equals(eventId));
  if (saved) req.user.favourites.pull(eventId);
  else req.user.favourites.addToSet(eventId);
  await req.user.save();
  res.json(req.user.favourites.map(String));
});
