import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";
import { CITIES } from "../catalog.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    city: { type: String, enum: CITIES, default: "Bengaluru" },
    favourites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    // Seeded demo shoppers, so reseeding can replace them without touching real accounts.
    demo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
userSchema.plugin(toJSONPlugin);

export const User = mongoose.model("User", userSchema);
