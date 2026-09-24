import QRCode from "qrcode";
import { config } from "../config.js";
import { sendMail } from "./mailer.js";
import { timeLabel } from "./format.js";

const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const verifyUrl = (code) => `${config.appUrl}/verify/${code}`;

function layout(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#eceff3;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:28px 16px">
    <div style="font-weight:800;font-size:20px;margin-bottom:16px"><span style="display:inline-block;background:#059669;color:#fff;border-radius:8px;padding:2px 8px;margin-right:6px">🎟</span>ScenePass</div>
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e5e7eb">
      <h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1>
      ${body}
    </div>
    <p style="color:#64748b;font-size:12px;margin-top:16px">This is a demo app. Payments are simulated.</p>
  </div></body></html>`;
}

const button = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${esc(label)}</a>`;

/** Booking confirmation with one scannable QR code per ticket. */
export async function sendBookingEmail({ to, name, order }) {
  const attachments = await Promise.all(
    order.tickets.map(async (t) => ({
      filename: `${t.code}.png`,
      content: await QRCode.toBuffer(verifyUrl(t.code), { width: 320, margin: 1 }),
      cid: `qr-${t.code}`,
    })),
  );
  const tickets = order.tickets
    .map(
      (t) => `<td style="padding:6px;text-align:center;vertical-align:top">
        <img src="cid:qr-${t.code}" width="140" height="140" alt="QR ${t.code}" style="display:block;margin:0 auto"/>
        <div style="font-weight:800;margin-top:6px">Seat ${esc(t.seat)}</div>
        <div style="color:#64748b;font-size:12px">${esc(t.tier)} · ${inr(t.price)}</div>
        <div style="font-family:monospace;font-size:12px;color:#065f46">${t.code}</div></td>`,
    )
    .join("");
  const body = `
    <p>Hi ${esc(name)}, you're going to <b>${esc(order.event.title)}</b>!</p>
    <p style="color:#334155">${timeLabel(order.event.startsAt)}<br/>${esc(order.event.venue)}, ${esc(order.event.city)}</p>
    <table role="presentation" style="width:100%;margin:12px 0"><tr>${tickets}</tr></table>
    <p style="color:#334155">Show these QR codes at the entrance. Booking <b>${order.code}</b> · paid ${inr(order.total)}
      ${order.payment?.method ? `via ${esc(order.payment.label)}` : ""}.</p>
    <p>${button(`${config.appUrl}/tickets?booked=${order.id}`, "View tickets")}</p>`;
  return sendMail({
    to,
    subject: `Your tickets for ${order.event.title} (${order.code})`,
    html: layout("Booking confirmed", body),
    text: `You're going to ${order.event.title}. Booking ${order.code}. Tickets: ${order.tickets.map((t) => `${t.seat} ${verifyUrl(t.code)}`).join(", ")}`,
    attachments,
  });
}

/** Invitation to a group booking room. */
export async function sendInviteEmail({ to, fromName, room, event }) {
  const link = `${config.appUrl}/rooms/${room.code}`;
  const body = `
    <p><b>${esc(fromName)}</b> invited you to book seats together for <b>${esc(event.title)}</b>.</p>
    <p style="color:#334155">${timeLabel(event.startsAt)}<br/>${esc(event.venue)}, ${esc(event.city)}</p>
    <p>Pick your seats on the shared live map. The host checks out and the cost is split between the group.</p>
    <p>${button(link, "Join the group")}</p>
    <p style="color:#64748b;font-size:13px">Or use room code <b>${room.code}</b> at ${esc(config.appUrl)}/rooms</p>`;
  return sendMail({
    to,
    subject: `${fromName} invited you to ${event.title}`,
    html: layout("You're invited!", body),
    text: `${fromName} invited you to book ${event.title} together: ${link}`,
  });
}

/** Welcome email for newsletter subscribers. */
export async function sendWelcomeEmail({ to }) {
  const body = `
    <p>Thanks for subscribing! Every Friday we'll send you the best shows, new drops and exclusive promo codes.</p>
    <p>To start, here's <b>SCENE10</b>: 10% off your next booking.</p>
    <p>${button(`${config.appUrl}/discover`, "Find something to do")}</p>`;
  return sendMail({ to, subject: "Welcome to ScenePass weekly picks", html: layout("You're on the list 🎉", body), text: "Thanks for subscribing to ScenePass. Use SCENE10 for 10% off." });
}
