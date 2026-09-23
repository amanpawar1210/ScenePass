export type Role = 'customer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface EventItem {
  id: string;
  seq: number;
  type: string;
  title: string;
  sub: string;
  date: string;
  venue: string;
  city: string;
  price: number;
  color: 'coral' | 'wine' | 'copper';
}

export type EventInput = Pick<EventItem, 'title' | 'venue' | 'date' | 'city' | 'price'>;

export interface Seat {
  id: string;
  price: number;
  tier: string;
  blocked: boolean;
  taken: boolean;
}

export interface Order {
  id: string;
  code: string;
  eventId: string;
  event: Pick<EventItem, 'title' | 'type' | 'date' | 'venue' | 'city'>;
  seats: string[];
  total: number;
  createdAt: string;
}

export const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad'];
export const MAX_SEATS = 6;
