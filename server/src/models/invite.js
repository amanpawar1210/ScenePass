import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";

// An email invitation to a group booking room.
const inviteSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "GroupRoom", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["sent", "failed", "joined"], default: "sent" },
    previewUrl: { type: String, default: null },
    inApp: { type: Boolean, default: false },
  },
  { timestamps: true },
);
inviteSchema.index({ room: 1, email: 1 }, { unique: true });
inviteSchema.plugin(toJSONPlugin);

export const Invite = mongoose.model("Invite", inviteSchema);
