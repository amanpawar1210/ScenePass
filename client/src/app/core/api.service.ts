import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EventInput, EventItem, Order, Role, Seat, User } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  login(body: { name: string; email: string; role: Role }) {
    return this.http.post<{ token: string; user: User }>('/api/auth/login', body);
  }
  me() {
    return this.http.get<{ user: User }>('/api/auth/me');
  }

  events() {
    return this.http.get<EventItem[]>('/api/events');
  }
  seats(eventId: string) {
    return this.http.get<Seat[]>(`/api/events/${eventId}/seats`);
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
  createOrder(eventId: string, seats: string[]) {
    return this.http.post<Order>('/api/orders', { eventId, seats });
  }

  favourites() {
    return this.http.get<string[]>('/api/favourites');
  }
  toggleFavourite(eventId: string) {
    return this.http.put<string[]>(`/api/favourites/${eventId}`, {});
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the ScenePass server';
    return err.error?.message ?? 'Something went wrong';
  }
  return 'Something went wrong';
}
