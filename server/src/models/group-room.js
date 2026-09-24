import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins.js";

// A shared booking room: friends join by invite code, pick seats together,
// and the host checks out. Seats are held under the host's account.
const groupRoomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    selection: [
      {
        _id: false,
        seat: { type: String, required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        byName: { type: String, required: true },
      },
    ],
    status: { type: String, enum: ["open", "booked"], default: "open" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: true },
);
groupRoomSchema.index({ "members.user": 1, updatedAt: -1 });
groupRoomSchema.plugin(toJSONPlugin);

export const GroupRoom = mongoose.model("GroupRoom", groupRoomSchema);
