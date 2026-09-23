import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    favourites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
  },
  { timestamps: true },
);
userSchema.plugin(toJSONPlugin);

export const User = mongoose.model("User", userSchema);
