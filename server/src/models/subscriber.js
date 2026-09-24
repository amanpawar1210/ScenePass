import mongoose from "mongoose";

// Newsletter subscribers (footer signup).
const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    city: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Subscriber = mongoose.model("Subscriber", subscriberSchema);
