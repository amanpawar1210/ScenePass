import QRCode from 'qrcode';
import { Order, Ticket } from '../core/models';
import { fullDateTime, inr, sizedImage } from '../core/format';

export const verifyUrl = (code: string) => `${location.origin}/verify/${code}`;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

/** Renders a phone-wallpaper-sized ticket (event photo + scannable QR) and downloads it as PNG. */
export async function downloadTicketImage(order: Order, ticket: Ticket): Promise<void> {
  const W = 720;
  const H = 1240;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eceff3';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(30, 30, W - 60, H - 60, 32);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(30, 30, W - 60, H - 60);

  // Event photo header.
  const photo = order.event.imageUrl ? await loadImage(sizedImage(order.event.imageUrl, 700)) : null;
  if (photo) {
    const scale = Math.max((W - 60) / photo.width, 380 / photo.height);
    const w = photo.width * scale;
    const h = photo.height * scale;
    ctx.drawImage(photo, 30 + (W - 60 - w) / 2, 30 + (380 - h) / 2, w, h);
  } else {
    ctx.fillStyle = '#059669';
    ctx.fillRect(30, 30, W - 60, 380);
  }
  const grad = ctx.createLinearGradient(0, 230, 0, 410);
  grad.addColorStop(0, 'rgba(15,23,42,0)');
  grad.addColorStop(1, 'rgba(15,23,42,0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(30, 230, W - 60, 180);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px Inter, Arial, sans-serif';
  ctx.fillText('ScenePass', 64, 80);
  ctx.font = '800 40px "Plus Jakarta Sans", Inter, Arial, sans-serif';
  wrap(ctx, order.event.title, W - 130).forEach((l, i, arr) => ctx.fillText(l, 64, 392 - (arr.length - 1 - i) * 46));

  // Details.
  ctx.fillStyle = '#065f46';
  ctx.font = '700 22px Inter, Arial, sans-serif';
  ctx.fillText(fullDateTime(order.event.startsAt), 64, 460);
  ctx.fillStyle = '#334155';
  ctx.font = '500 22px Inter, Arial, sans-serif';
  ctx.fillText(`${order.event.venue}, ${order.event.city}`, 64, 496);

  ctx.fillStyle = '#f5f7f9';
  ctx.beginPath();
  ctx.roundRect(64, 530, W - 128, 110, 18);
  ctx.fill();
  const cols = [
    ['SEAT', ticket.seat],
    ['TIER', ticket.tier],
    ['PRICE', inr(ticket.price)],
  ];
  cols.forEach(([label, value], i) => {
    const x = 90 + i * ((W - 180) / 3);
    ctx.fillStyle = '#64748b';
    ctx.font = '700 16px Inter, Arial, sans-serif';
    ctx.fillText(label, x, 572);
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 32px "Plus Jakarta Sans", Inter, Arial, sans-serif';
    ctx.fillText(value, x, 614);
  });

  // Perforation.
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 680);
  ctx.lineTo(W - 64, 680);
  ctx.stroke();
  ctx.setLineDash([]);

  // QR code (encodes the public verification URL).
  const qr = await loadImage(await QRCode.toDataURL(verifyUrl(ticket.code), { width: 360, margin: 1, errorCorrectionLevel: 'M' }));
  if (qr) ctx.drawImage(qr, (W - 360) / 2, 710, 360, 360);
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 28px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(ticket.code, W / 2, 1110);
  ctx.fillStyle = '#64748b';
  ctx.font = '500 18px Inter, Arial, sans-serif';
  ctx.fillText(`Booking ${order.code} · scan at the entrance`, W / 2, 1146);
  ctx.restore();

  const link = document.createElement('a');
  link.download = `${ticket.code}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
