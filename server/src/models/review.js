import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";

// Reviews are written for an event a customer attended and roll up to its venue.
const reviewSchema = new mongoose.Schema(
  {
    venue: { type: String, required: true, index: true },
    city: { type: String, required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
    eventTitle: { type: String, default: "" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 600, default: "" },
  },
  { timestamps: true },
);
reviewSchema.index({ user: 1, eventId: 1 }, { unique: true, partialFilterExpression: { eventId: { $type: "objectId" } } });
reviewSchema.plugin(toJSONPlugin);

export const Review = mongoose.model("Review", reviewSchema);
