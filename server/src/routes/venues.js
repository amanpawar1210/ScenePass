import { Router } from "express";
import { Event } from "../models/event.js";
import { Review } from "../models/review.js";
import { HttpError } from "../middleware/errors.js";
import { eventsWithAvailability } from "../services/availability.js";
import { venueRatings, venueSlug } from "../services/venues.js";

export const venuesRouter = Router();

// Every venue that hosts published events, with its rating and upcoming count.
venuesRouter.get("/", async (_req, res) => {
  const events = await Event.find({ status: "published" }).sort({ startsAt: 1 });
  const ratings = await venueRatings();
  const now = new Date();
  const venues = new Map();
  for (const e of events) {
    const slug = venueSlug(e.venue);
    const v = venues.get(slug) ?? {
      slug,
      name: e.venue,
      address: e.address,
      city: e.city,
      art: e.art,
      imageUrl: e.imageUrl,
      categories: [],
      upcoming: 0,
      nextEvent: null,
      rating: ratings.get(e.venue) ?? { avg: 0, count: 0 },
    };
    if (!v.categories.includes(e.type)) v.categories.push(e.type);
    if (e.startsAt > now) {
      v.upcoming += 1;
      v.nextEvent ??= { id: e.id, title: e.title, startsAt: e.startsAt };
    }
    venues.set(slug, v);
  }
  res.json([...venues.values()].sort((a, b) => b.upcoming - a.upcoming || b.rating.avg - a.rating.avg));
});

venuesRouter.get("/:slug", async (req, res) => {
  const all = await Event.find({ status: "published" }).sort({ startsAt: 1 });
  const atVenue = all.filter((e) => venueSlug(e.venue) === req.params.slug);
  if (!atVenue.length) throw new HttpError(404, "Venue not found");
  const first = atVenue[0];
  const [events, reviews, ratings] = await Promise.all([
    eventsWithAvailability(atVenue.filter((e) => e.startsAt > new Date())),
    Review.find({ venue: first.venue }).sort({ createdAt: -1 }).limit(30),
    venueRatings([first.venue]),
  ]);
  res.json({
    slug: req.params.slug,
    name: first.venue,
    address: first.address,
    city: first.city,
    art: first.art,
    imageUrl: first.imageUrl,
    layout: first.layout,
    rating: ratings.get(first.venue) ?? { avg: 0, count: 0 },
    events,
    reviews,
  });
});
