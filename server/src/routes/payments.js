import { Router } from "express";
import { Event } from "../models/event.js";
import { GroupRoom } from "../models/group-room.js";
import { PaymentAuth } from "../models/payment-auth.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { quote } from "../services/pricing.js";

// A dummy payment gateway: realistic validation and flows, but no money moves.
// Test data: any valid card number works (OTP 123456); 4000 0000 0000 0002 is
// declined, 4000 0000 0000 9995 has insufficient funds; UPI IDs starting "fail" fail.
export const OTP = "123456";
export const BANKS = ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank"];

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

function luhn(num) {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function cardBrand(num) {
  if (/^4/.test(num)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "Amex";
  if (/^(60|65|81|82|508)/.test(num)) return "RuPay";
  return "Card";
}

function checkCard(card) {
  const number = String(card?.number ?? "").replace(/\D/g, "");
  const brand = cardBrand(number);
  if (number.length < 13 || number.length > 19 || !luhn(number)) throw new HttpError(400, "That card number isn't valid");
  const [mm, yy] = String(card?.expiry ?? "").split("/").map((p) => Number(p.trim()));
  if (!(mm >= 1 && mm <= 12) || !(yy >= 0)) throw new HttpError(400, "Enter the expiry as MM/YY");
  const now = new Date();
  const expiry = new Date(2000 + yy, mm, 0, 23, 59);
  if (expiry < now) throw new HttpError(400, "This card has expired");
  const cvvLength = brand === "Amex" ? 4 : 3;
  if (!new RegExp(`^\\d{${cvvLength}}$`).test(String(card?.cvv ?? ""))) throw new HttpError(400, `CVV must be ${cvvLength} digits`);
  if (String(card?.name ?? "").trim().length < 2) throw new HttpError(400, "Enter the name on the card");
  if (number === "4000000000000002") throw new HttpError(402, "Your bank declined this card. Try another payment method.");
  if (number === "4000000000009995") throw new HttpError(402, "Insufficient funds on this card");
  return { brand, last4: number.slice(-4) };
}

paymentsRouter.get("/methods", (_req, res) => {
  res.json({ banks: BANKS, otpHint: OTP, testCards: { success: "4242 4242 4242 4242", declined: "4000 0000 0000 0002" } });
});

/** Step 1: validate payment details for the exact amount the server calculates. */
paymentsRouter.post("/authorize", async (req, res) => {
  const event = await Event.findById(req.body?.eventId);
  if (!event || event.status !== "published") throw new HttpError(404, "Event not found");
  if (req.body?.roomCode) {
    const room = await GroupRoom.findOne({ code: String(req.body.roomCode).toUpperCase() });
    if (!room || !room.host.equals(req.user._id)) throw new HttpError(403, "Only the room host can pay");
  }
  const q = await quote({ event, seatIds: req.body?.seats, promoCode: req.body?.promoCode, user: req.user });
  if (q.promoError) throw new HttpError(400, q.promoError);

  const method = req.body?.method;
  let details;
  if (method === "card") {
    const { brand, last4 } = checkCard(req.body.card);
    details = { brand, last4, label: `${brand} •••• ${last4}`, otpRequired: true };
  } else if (method === "upi") {
    const upiId = String(req.body?.upiId ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,}@[a-z]{2,}$/.test(upiId)) throw new HttpError(400, "Enter a valid UPI ID, like name@okbank");
    if (upiId.startsWith("fail")) throw new HttpError(402, "The UPI request was declined in the app");
    details = { upiId, label: `UPI · ${upiId}`, otpRequired: false };
  } else if (method === "netbanking") {
    const bank = String(req.body?.bank ?? "");
    if (!BANKS.includes(bank)) throw new HttpError(400, "Choose your bank");
    details = { bank, label: `Net banking · ${bank}`, otpRequired: true };
  } else {
    throw new HttpError(400, "Choose a payment method");
  }

  const auth = await PaymentAuth.create({
    user: req.user._id,
    eventId: event._id,
    seats: q.seats.map((s) => s.id),
    amount: q.total,
    method,
    ...details,
  });
  res.json({ authId: auth.id, amount: q.total, label: details.label, otpRequired: details.otpRequired, otpHint: OTP });
});
