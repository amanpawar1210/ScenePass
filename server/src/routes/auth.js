import { Router } from "express";
import { User } from "../models/user.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { CITIES } from "../catalog.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const authRouter = Router();

// Demo sign-in: no password, the visitor picks their role. Replace with real
// credentials (or an identity provider) before using this beyond a demo.
authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const role = req.body?.role === "admin" ? "admin" : "customer";
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address");
  const name = String(req.body?.name || "").trim().slice(0, 60) || email.split("@")[0];

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

authRouter.patch("/me", requireAuth, async (req, res) => {
  const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
  const city = req.body?.city;
  if (name !== undefined) {
    if (name.length < 2 || name.length > 60) throw new HttpError(400, "Name must be 2–60 characters");
    req.user.name = name;
  }
  if (city !== undefined) {
    if (!CITIES.includes(city)) throw new HttpError(400, "Choose a supported city");
    req.user.city = city;
  }
  await req.user.save();
  res.json({ user: req.user });
});
