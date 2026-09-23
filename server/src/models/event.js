import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";

const eventSchema = new mongoose.Schema(
  {
    // Display order for "Featured" sorting and poster artwork selection.
    seq: { type: Number, required: true, unique: true },
    type: { type: String, required: true, default: "LIVE MUSIC" },
    title: { type: String, required: true, trim: true, minlength: 3 },
    sub: { type: String, default: "A new ScenePass live experience" },
    date: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true, minlength: 3 },
    city: { type: String, required: true },
    price: { type: Number, required: true, min: 1 },
    color: { type: String, enum: ["coral", "wine", "copper"], default: "wine" },
  },
  { timestamps: true },
);
eventSchema.plugin(toJSONPlugin);

export const Event = mongoose.model("Event", eventSchema);
