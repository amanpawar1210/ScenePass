import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";
import { CATEGORIES, CITIES, COLORS } from "../catalog.js";

const tierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 1 },
    rows: { type: [String], required: true },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    // Display order for "Featured" sorting.
    seq: { type: Number, required: true, unique: true },
    type: { type: String, required: true, enum: CATEGORIES },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    sub: { type: String, trim: true, maxlength: 140, default: "A new ScenePass live experience" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    tags: { type: [String], default: [] },
    lineup: { type: [{ name: String, role: String, _id: false }], default: [] },
    startsAt: { type: Date, required: true, index: true },
    durationMins: { type: Number, min: 15, max: 1440, default: 120 },
    venue: { type: String, required: true, trim: true, minlength: 3 },
    address: { type: String, trim: true, default: "" },
    city: { type: String, required: true, enum: CITIES },
    language: { type: String, default: "English" },
    ageLimit: { type: String, default: "All ages" },
    layout: {
      rows: { type: Number, required: true, min: 2, max: 20 },
      seatsPerRow: { type: Number, required: true, min: 4, max: 24 },
    },
    tiers: { type: [tierSchema], validate: (v) => v.length >= 1 && v.length <= 3 },
    blocked: { type: [String], default: [] },
    // Lowest tier price, kept in sync for sorting and cards.
    price: { type: Number, min: 1 },
    color: { type: String, enum: COLORS, default: "wine" },
    art: { type: Number, min: 0, max: 11, default: 0 },
    imageUrl: { type: String, default: "" },
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ["published", "draft"], default: "published", index: true },
  },
  { timestamps: true },
);

eventSchema.pre("validate", function () {
  if (this.tiers?.length) this.price = Math.min(...this.tiers.map((t) => t.price));
});

eventSchema.virtual("endsAt").get(function () {
  return new Date(this.startsAt.getTime() + this.durationMins * 60_000);
});

eventSchema.plugin(toJSONPlugin);

export const Event = mongoose.model("Event", eventSchema);
