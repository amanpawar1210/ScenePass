import { Router } from "express";
import { Subscriber } from "../models/subscriber.js";
import { HttpError } from "../middleware/errors.js";
import { sendWelcomeEmail } from "../services/emails.js";

export const newsletterRouter = Router();

newsletterRouter.post("/", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
  const existing = await Subscriber.findOne({ email });
  if (existing) return res.json({ status: "already", message: "You're already subscribed" });
  await Subscriber.create({ email, city: String(req.body?.city ?? "") });
  const mail = await sendWelcomeEmail({ to: email });
  res.status(201).json({ status: "subscribed", message: "You're in! Check your inbox.", previewUrl: mail.previewUrl });
});
