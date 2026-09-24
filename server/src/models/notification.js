import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["booking", "cancelled", "waitlist", "room", "reminder", "review"], required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
    // Optional de-duplication key, e.g. one reminder per booking.
    key: { type: String, default: null },
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, key: 1 }, { unique: true, partialFilterExpression: { key: { $type: "string" } } });
notificationSchema.plugin(toJSONPlugin);

export const Notification = mongoose.model("Notification", notificationSchema);
