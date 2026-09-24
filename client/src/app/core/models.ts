export type Role = 'customer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  city: string;
}

export interface Tier {
  name: string;
  price: number;
  rows: string[];
}

export interface EventItem {
  id: string;
  seq: number;
  type: string;
  title: string;
  sub: string;
  description: string;
  tags: string[];
  lineup: { name: string; role: string }[];
  startsAt: string;
  endsAt: string;
  durationMins: number;
  venue: string;
  address: string;
  city: string;
  language: string;
  ageLimit: string;
  layout: { rows: number; seatsPerRow: number };
  tiers: Tier[];
  price: number;
  color: 'coral' | 'wine' | 'copper';
  art: number;
  imageUrl: string;
  featured: boolean;
  status: 'published' | 'draft';
  capacity: number;
  sold: number;
  seatsLeft: number;
  venueSlug: string;
  rating: Rating;
  /** Only present on single-event responses. */
  waitlisted?: boolean;
  waitlistCount?: number;
}

/** Fields an organizer edits in the studio form. */
export interface EventInput {
  title: string;
  sub: string;
  description: string;
  type: string;
  startsAt: string;
  durationMins: number;
  venue: string;
  address: string;
  city: string;
  language: string;
  ageLimit: string;
  prices: number[];
  lineup: string;
  tags: string;
  imageUrl: string;
  featured: boolean;
  status: 'published' | 'draft';
  rows?: number;
  seatsPerRow?: number;
}

export type SeatStatus = 'available' | 'blocked' | 'booked' | 'held' | 'mine';

export interface Seat {
  id: string;
  row: string;
  number: number;
  tier: string;
  price: number;
  status: SeatStatus;
}

export interface SeatMap {
  layout: { rows: number; seatsPerRow: number };
  tiers: Tier[];
  seats: Seat[];
  hold: { seats: string[]; expiresAt: string } | null;
}

export interface HoldResult {
  seats: string[];
  expiresAt: string | null;
  conflicts: string[];
}

export interface Promo {
  code: string;
  description: string;
}

export interface Quote {
  subtotal: number;
  discount: number;
  total: number;
  promo: Promo | null;
  promoError: string | null;
}

export interface Ticket {
  code: string;
  seat: string;
  tier: string;
  price: number;
  checkedInAt: string | null;
}

/** Event details copied onto an order at booking time. */
export type EventSnapshot = Pick<
  EventItem,
  'title' | 'type' | 'startsAt' | 'durationMins' | 'venue' | 'address' | 'city' | 'art' | 'imageUrl'
>;

export interface Order {
  id: string;
  code: string;
  eventId: string;
  event: EventSnapshot;
  seats: string[];
  tickets: Ticket[];
  subtotal: number;
  discount: number;
  promoCode: string | null;
  total: number;
  status: 'confirmed' | 'cancelled';
  cancelledAt: string | null;
  createdAt: string;
  /** Populated with name/email for organizers. */
  user?: { name: string; email: string } | string;
}

export interface Meta {
  cities: string[];
  categories: string[];
  maxSeats: number;
  holdMinutes: number;
  promos: Promo[];
}

export interface AdminStats {
  revenue: number;
  orders: number;
  tickets: number;
  discounts: number;
  checkedIn: number;
  cancelled: number;
  upcomingEvents: number;
  drafts: number;
  avgOccupancy: number;
  revenueByDay: { date: string; revenue: number; tickets: number }[];
  topEvents: { id: string; title: string; city: string; startsAt: string; revenue: number; tickets: number; occupancy: number }[];
  byCategory: { category: string; revenue: number; tickets: number }[];
}

export interface CheckinResult {
  message: string;
  ticket: {
    code: string;
    seat: string;
    tier: string;
    event: string;
    startsAt: string;
    holder: string;
    checkedInAt: string;
  };
}

export const FALLBACK_CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai'];
export const MAX_SEATS = 6;

export interface Rating {
  avg: number;
  count: number;
}

export interface Review {
  id: string;
  venue: string;
  eventId: string | null;
  eventTitle: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewSummary {
  venue: string;
  avg: number;
  count: number;
  breakdown: { stars: number; count: number }[];
  reviews: Review[];
  canReview: boolean;
  myReview: Review | null;
}

export interface Venue {
  slug: string;
  name: string;
  address: string;
  city: string;
  art: number;
  imageUrl: string;
  categories: string[];
  upcoming: number;
  nextEvent: { id: string; title: string; startsAt: string } | null;
  rating: Rating;
}

export interface VenueDetail extends Omit<Venue, 'categories' | 'upcoming' | 'nextEvent'> {
  layout: { rows: number; seatsPerRow: number };
  events: EventItem[];
  reviews: Review[];
}

export interface GroupRoom {
  id: string;
  code: string;
  eventId: string;
  event: EventItem | null;
  host: string;
  members: { user: string; name: string; joinedAt: string }[];
  selection: { seat: string; by: string; byName: string }[];
  status: 'open' | 'booked';
  orderId: string | null;
  hold: { seats: string[]; expiresAt: string } | null;
  isHost: boolean;
  isMember: boolean;
  conflicts?: string[];
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: 'booking' | 'cancelled' | 'waitlist' | 'room' | 'reminder' | 'review';
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}
