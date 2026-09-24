import mongoose from "mongoose";

// A temporary lock on one seat while a customer checks out. The unique index
// guarantees two people can never hold (and therefore book) the same seat.
const seatHoldSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  seat: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
});
seatHoldSchema.index({ eventId: 1, seat: 1 }, { unique: true });
seatHoldSchema.index({ user: 1, eventId: 1 });
// MongoDB removes expired holds in the background (roughly once a minute);
// queries still filter on expiresAt so expiry is exact.
seatHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SeatHold = mongoose.model("SeatHold", seatHoldSchema);
