import { TIME_ZONE } from "../catalog.js";

const fmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "Sat, 28 Sep, 8:00 pm" in India time, for notification text. */
export const timeLabel = (date) => fmt.format(new Date(date));
