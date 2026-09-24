import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, errorMessage } from './api.service';
import { AuthService } from './auth.service';
import { EventItem, FALLBACK_CITIES, MAX_SEATS, Meta, Order } from './models';

const RECENT_KEY = 'scenepass_recent';
function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** App-wide state shared between the shell and its pages. */
@Injectable({ providedIn: 'root' })
export class StoreService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly meta = signal<Meta | null>(null);
  readonly events = signal<EventItem[]>([]);
  readonly favourites = signal<string[]>([]);
  readonly waitlist = signal<string[]>([]);
  readonly recentlyViewed = signal<string[]>(readRecent());
  readonly orders = signal<Order[]>([]);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly city = signal('All cities');
  readonly category = signal('All scenes');
  readonly toast = signal('');

  readonly cities = computed(() => this.meta()?.cities ?? FALLBACK_CITIES);
  readonly maxSeats = computed(() => this.meta()?.maxSeats ?? MAX_SEATS);
  readonly promos = computed(() => this.meta()?.promos ?? []);

  /** Events customers can browse (organizers also load drafts and past events). */
  readonly liveEvents = computed(() => {
    const now = Date.now();
    return this.events().filter((e) => e.status === 'published' && new Date(e.endsAt).getTime() > now);
  });

  // Current booking in progress, shared by the seat map and group room.
  readonly selectedEventId = signal<string | null>(null);
  readonly selectedSeats = signal<string[]>([]);
  readonly selectedEvent = computed(
    () =>
      this.liveEvents().find((e) => e.id === this.selectedEventId()) ??
      this.liveEvents().find((e) => e.featured) ??
      this.liveEvents()[0] ??
      null,
  );

  async load(): Promise<void> {
    this.loadError.set(null);
    try {
      const [meta, events, favourites, orders, waitlist] = await Promise.all([
        firstValueFrom(this.api.meta()),
        firstValueFrom(this.api.events(this.auth.isAdmin())),
        firstValueFrom(this.api.favourites()),
        firstValueFrom(this.api.orders()),
        firstValueFrom(this.api.waitlist()),
      ]);
      this.waitlist.set(waitlist);
      this.meta.set(meta);
      this.events.set(events);
      this.favourites.set(favourites);
      this.orders.set(orders);
      this.loaded.set(true);
    } catch (err) {
      this.loadError.set(errorMessage(err));
    }
  }

  async refreshEvents(): Promise<void> {
    try {
      this.events.set(await firstValueFrom(this.api.events(this.auth.isAdmin())));
    } catch {
      // Keep showing the last known list.
    }
  }

  upsertEvent(event: EventItem): void {
    this.events.update((events) =>
      events.some((e) => e.id === event.id) ? events.map((e) => (e.id === event.id ? event : e)) : [...events, event],
    );
  }

  replaceOrder(order: Order): void {
    this.orders.update((orders) => orders.map((o) => (o.id === order.id ? order : o)));
  }

  async toggleFavourite(eventId: string): Promise<void> {
    const wasSaved = this.favourites().includes(eventId);
    try {
      this.favourites.set(await firstValueFrom(this.api.toggleFavourite(eventId)));
      this.notify(wasSaved ? 'Removed from saved' : 'Saved for later');
    } catch (err) {
      this.notify(errorMessage(err));
    }
  }

  /** Remembers the last few events opened, for the "Recently viewed" rail. */
  markViewed(eventId: string): void {
    this.recentlyViewed.update((ids) => [eventId, ...ids.filter((id) => id !== eventId)].slice(0, 8));
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.recentlyViewed()));
    } catch {}
  }

  notify(text: string): void {
    clearTimeout(this.toastTimer);
    this.toast.set(text);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2600);
  }

  reset(): void {
    this.events.set([]);
    this.favourites.set([]);
    this.waitlist.set([]);
    this.orders.set([]);
    this.loaded.set(false);
    this.loadError.set(null);
    this.selectedEventId.set(null);
    this.selectedSeats.set([]);
    this.category.set('All scenes');
    this.city.set('All cities');
  }

  signOut(): void {
    this.auth.clear();
    this.reset();
  }
}
