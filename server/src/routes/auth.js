import { Router } from "express";
import { User } from "../models/user.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const authRouter = Router();

// Demo sign-in: no password, the visitor picks their role. Replace with real
// credentials (or an identity provider) before using this beyond a demo.
authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const role = req.body?.role === "admin" ? "admin" : "customer";
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address");
  const name = String(req.body?.name || "").trim() || email.split("@")[0];

  const user = await User.findOneAndUpdate(
    { email },
    { $set: { name, role } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  res.json({ token: signToken(user), user });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
