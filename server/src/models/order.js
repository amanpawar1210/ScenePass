import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";

const ticketSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    seat: { type: String, required: true },
    tier: { type: String, required: true },
    price: { type: Number, required: true },
    checkedInAt: { type: Date, default: null },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    // Snapshot so tickets survive later event edits or deletion.
    event: {
      title: String,
      type: { type: String },
      startsAt: Date,
      durationMins: Number,
      venue: String,
      address: String,
      city: String,
      art: Number,
      imageUrl: String,
    },
    seats: { type: [String], required: true },
    tickets: { type: [ticketSchema], default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    promoCode: { type: String, default: null },
    total: { type: Number, required: true },
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed", index: true },
    // Simulated payment details (never real card data: only brand and last 4 digits).
    payment: {
      method: { type: String, default: null },
      label: { type: String, default: null },
      txnId: { type: String, default: null },
      paidAt: { type: Date, default: null },
      refundedAt: { type: Date, default: null },
    },
    email: {
      status: { type: String, default: null },
      previewUrl: { type: String, default: null },
    },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);
orderSchema.index({ "tickets.code": 1 }, { unique: true, sparse: true });
orderSchema.plugin(toJSONPlugin);

export const Order = mongoose.model("Order", orderSchema);
