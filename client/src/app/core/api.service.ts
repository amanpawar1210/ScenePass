import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AdminStats,
  AppNotification,
  Invite,
  PaymentAuthorization,
  PaymentDetails,
  TicketVerification,
  GroupRoom,
  ReviewSummary,
  Review,
  Venue,
  VenueDetail,
  CheckinResult,
  EventInput,
  EventItem,
  HoldResult,
  Meta,
  Order,
  Quote,
  Role,
  SeatMap,
  User,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  meta() {
    return this.http.get<Meta>('/api/meta');
  }

  login(body: { name: string; email: string; role: Role }) {
    return this.http.post<{ token: string; user: User }>('/api/auth/login', body);
  }
  me() {
    return this.http.get<{ user: User }>('/api/auth/me');
  }
  updateMe(body: Partial<Pick<User, 'name' | 'city'>>) {
    return this.http.patch<{ user: User }>('/api/auth/me', body);
  }

  events(all = false) {
    return this.http.get<EventItem[]>('/api/events', { params: all ? { scope: 'all' } : {} });
  }
  event(id: string) {
    return this.http.get<EventItem>(`/api/events/${id}`);
  }
  seats(eventId: string) {
    return this.http.get<SeatMap>(`/api/events/${eventId}/seats`);
  }
  hold(eventId: string, seats: string[]) {
    return this.http.put<HoldResult>(`/api/events/${eventId}/hold`, { seats });
  }
  createEvent(body: EventInput) {
    return this.http.post<EventItem>('/api/events', body);
  }
  updateEvent(id: string, body: EventInput) {
    return this.http.put<EventItem>(`/api/events/${id}`, body);
  }
  deleteEvent(id: string) {
    return this.http.delete<void>(`/api/events/${id}`);
  }

  orders() {
    return this.http.get<Order[]>('/api/orders');
  }
  quote(eventId: string, seats: string[], promoCode: string) {
    return this.http.post<Quote>('/api/orders/quote', { eventId, seats, promoCode });
  }
  paymentMethods() {
    return this.http.get<{ banks: string[]; otpHint: string; testCards: { success: string; declined: string } }>('/api/payments/methods');
  }
  authorizePayment(body: { eventId: string; seats: string[]; promoCode: string | null; roomCode?: string } & PaymentDetails) {
    return this.http.post<PaymentAuthorization>('/api/payments/authorize', body);
  }
  createOrder(body: { eventId: string; seats: string[]; promoCode: string | null; roomCode?: string; authId: string; otp?: string }) {
    return this.http.post<Order>('/api/orders', body);
  }
  verifyTicket(code: string) {
    return this.http.get<TicketVerification>(`/api/tickets/${encodeURIComponent(code)}/verify`);
  }
  cancelOrder(id: string) {
    return this.http.post<Order>(`/api/orders/${id}/cancel`, {});
  }

  favourites() {
    return this.http.get<string[]>('/api/favourites');
  }
  toggleFavourite(eventId: string) {
    return this.http.put<string[]>(`/api/favourites/${eventId}`, {});
  }

  reviews(eventId: string) {
    return this.http.get<ReviewSummary>(`/api/events/${eventId}/reviews`);
  }
  addReview(eventId: string, rating: number, comment: string) {
    return this.http.post<Review>(`/api/events/${eventId}/reviews`, { rating, comment });
  }

  waitlist() {
    return this.http.get<string[]>('/api/waitlist');
  }
  joinWaitlist(eventId: string) {
    return this.http.post<{ waitlisted: boolean; waitlistCount: number }>(`/api/events/${eventId}/waitlist`, {});
  }
  leaveWaitlist(eventId: string) {
    return this.http.delete<{ waitlisted: boolean; waitlistCount: number }>(`/api/events/${eventId}/waitlist`);
  }

  venues() {
    return this.http.get<Venue[]>('/api/venues');
  }
  venue(slug: string) {
    return this.http.get<VenueDetail>(`/api/venues/${slug}`);
  }

  rooms() {
    return this.http.get<GroupRoom[]>('/api/rooms');
  }
  room(code: string) {
    return this.http.get<GroupRoom>(`/api/rooms/${code}`);
  }
  createRoom(eventId: string) {
    return this.http.post<GroupRoom>('/api/rooms', { eventId });
  }
  joinRoom(code: string) {
    return this.http.post<GroupRoom>(`/api/rooms/${code}/join`, {});
  }
  leaveRoom(code: string) {
    return this.http.post<void>(`/api/rooms/${code}/leave`, {});
  }
  inviteToRoom(code: string, emails: string[]) {
    return this.http.post<Invite[]>(`/api/rooms/${code}/invite`, { emails });
  }
  setRoomSeats(code: string, seats: string[]) {
    return this.http.put<GroupRoom>(`/api/rooms/${code}/seats`, { seats });
  }

  notifications() {
    return this.http.get<{ items: AppNotification[]; unread: number }>('/api/notifications');
  }
  readAllNotifications() {
    return this.http.post<void>('/api/notifications/read-all', {});
  }
  readNotification(id: string) {
    return this.http.post<void>(`/api/notifications/${id}/read`, {});
  }

  stats() {
    return this.http.get<AdminStats>('/api/admin/stats');
  }
  checkin(code: string) {
    return this.http.post<CheckinResult>('/api/admin/checkin', { code });
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0 || err.status === 502 || err.status === 504) return 'Cannot reach the ScenePass server';
    return err.error?.message ?? 'Something went wrong';
  }
  return 'Something went wrong';
}
