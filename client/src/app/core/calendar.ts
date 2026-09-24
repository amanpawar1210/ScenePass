import { Order } from './models';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escape = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** Downloads an .ics file so a booking can be added to any calendar app. */
export function downloadCalendarFile(order: Order): void {
  const start = new Date(order.event.startsAt);
  const end = new Date(start.getTime() + (order.event.durationMins || 120) * 60_000);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScenePass//Tickets//EN',
    'BEGIN:VEVENT',
    `UID:${order.code}@scenepass`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(order.event.title)}`,
    `LOCATION:${escape([order.event.venue, order.event.address, order.event.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escape(`Booking ${order.code} · Seats ${order.seats.join(', ')}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `${order.code}.ics` });
  link.click();
  URL.revokeObjectURL(url);
}
