import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";

const orderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    // Snapshot so tickets survive later event edits or unpublishing.
    event: {
      title: String,
      type: { type: String },
      date: String,
      venue: String,
      city: String,
    },
    seats: { type: [String], required: true },
    total: { type: Number, required: true },
  },
  { timestamps: true },
);
orderSchema.plugin(toJSONPlugin);

export const Order = mongoose.model("Order", orderSchema);
