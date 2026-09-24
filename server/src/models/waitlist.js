import mongoose from "mongoose";

// Customers waiting for seats on a sold-out event; they're notified when seats free up.
const waitlistSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
waitlistSchema.index({ eventId: 1, user: 1 }, { unique: true });

export const Waitlist = mongoose.model("Waitlist", waitlistSchema);
