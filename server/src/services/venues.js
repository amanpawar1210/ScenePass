import { Review } from "../models/review.js";

export function venueSlug(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Map of venue name → { avg, count } across all reviews. */
export async function venueRatings(venues) {
  const match = venues ? { venue: { $in: venues } } : {};
  const rows = await Review.aggregate([
    { $match: match },
    { $group: { _id: "$venue", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, { avg: Math.round(r.avg * 10) / 10, count: r.count }]));
}
