import mongoose from "mongoose";

// A simulated payment authorisation (dummy gateway). The booking step consumes it,
// after an OTP check for card and net-banking payments.
const paymentAuthSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  seats: { type: [String], required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ["card", "upi", "netbanking"], required: true },
  label: { type: String, required: true },
  brand: { type: String, default: "" },
  last4: { type: String, default: "" },
  upiId: { type: String, default: "" },
  bank: { type: String, default: "" },
  otpRequired: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 900 },
});

export const PaymentAuth = mongoose.model("PaymentAuth", paymentAuthSchema);
