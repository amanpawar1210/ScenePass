import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, errorMessage } from './api.service';
import { AuthService } from './auth.service';
import { EventItem, Order } from './models';

/** App-wide state shared between the shell and its pages. */
@Injectable({ providedIn: 'root' })
export class StoreService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly events = signal<EventItem[]>([]);
  readonly favourites = signal<string[]>([]);
  readonly orders = signal<Order[]>([]);
  readonly loaded = signal(false);

  readonly city = signal('All cities');
  readonly category = signal('All scenes');
  readonly toast = signal('');

  // Current booking in progress, shared by the seat map and group room.
  readonly selectedEventId = signal<string | null>(null);
  readonly selectedSeats = signal<string[]>([]);
  readonly selectedEvent = computed(
    () => this.events().find((e) => e.id === this.selectedEventId()) ?? this.events()[0] ?? null,
  );

  async load(): Promise<void> {
    try {
      const [events, favourites, orders] = await Promise.all([
        firstValueFrom(this.api.events()),
        firstValueFrom(this.api.favourites()),
        firstValueFrom(this.api.orders()),
      ]);
      this.events.set(events);
      this.favourites.set(favourites);
      this.orders.set(orders);
    } catch (err) {
      this.notify(errorMessage(err));
    } finally {
      this.loaded.set(true);
    }
  }

  async toggleFavourite(eventId: string): Promise<void> {
    try {
      this.favourites.set(await firstValueFrom(this.api.toggleFavourite(eventId)));
    } catch (err) {
      this.notify(errorMessage(err));
    }
  }

  notify(text: string): void {
    clearTimeout(this.toastTimer);
    this.toast.set(text);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2200);
  }

  reset(): void {
    this.events.set([]);
    this.favourites.set([]);
    this.orders.set([]);
    this.loaded.set(false);
    this.selectedEventId.set(null);
    this.selectedSeats.set([]);
    this.category.set('All scenes');
  }

  signOut(): void {
    this.auth.clear();
    this.reset();
  }
}
