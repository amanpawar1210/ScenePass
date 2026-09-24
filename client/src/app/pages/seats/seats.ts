import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ArrowLeft, Check, ChevronRight, LucideAngularModule, Sparkles, Timer, Users, X } from 'lucide-angular';
import { celebrate } from '../../shared/confetti';
import { RealtimeService } from '../../core/realtime.service';
import { ApiService, errorMessage } from '../../core/api.service';
import { Order, Seat, SeatMap } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { inr, posterStyle, shortDate, timeOf } from '../../core/format';
import { CheckoutModal } from '../../shared/checkout-modal';
import { SeatMapView } from '../../shared/seat-map';

// Live updates arrive over SSE; polling is only a slow safety net.
const POLL_MS = 45_000;

@Component({
  selector: 'app-seats',
  imports: [LucideAngularModule, SeatMapView, CheckoutModal],
  template: `
    @if (event(); as event) {
      <div class="container page">
        <header class="page-head with-back event-strip">
          <button class="icon-btn-round" aria-label="Back to event" (click)="router.navigate(['/events', event.id])">
            <lucide-icon [img]="icons.ArrowLeft" [size]="18" />
          </button>
          <span class="strip-art art-square" [class.custom-img]="!!event.imageUrl" [style]="poster(event)"></span>
          <div>
            <small class="eyebrow">{{ date() }} · {{ time() }} · {{ event.venue }}</small>
            <h1>{{ event.title }}</h1>
          </div>
          <button class="btn btn-outline" [disabled]="creatingRoom()" (click)="bookWithFriends()">
            <lucide-icon [img]="icons.Users" [size]="17" /> Book with friends
          </button>
        </header>

        <div class="seat-layout">
          <section class="card seat-card">
            @if (map(); as m) {
              <app-seat-map [map]="m" [selected]="selected()" (toggle)="toggleSeat($event)" />
            } @else {
              <div class="skeleton-block"></div>
            }
          </section>

          <aside class="card summary-card">
            <h2>Your seats</h2>
            <div class="best-picker">
              <span class="muted">Quick pick</span>
              <div class="stepper">
                <button type="button" aria-label="Fewer seats" [disabled]="bestCount() <= 1" (click)="bestCount.set(bestCount() - 1)">−</button>
                <b>{{ bestCount() }}</b>
                <button type="button" aria-label="More seats" [disabled]="bestCount() >= store.maxSeats()" (click)="bestCount.set(bestCount() + 1)">+</button>
              </div>
              <button class="btn btn-outline" (click)="pickBest()"><lucide-icon [img]="icons.Sparkles" [size]="16" /> Best available</button>
            </div>
            <div class="timer" [class.urgent]="remaining() !== null && remaining()! < 60">
              <lucide-icon [img]="icons.Timer" [size]="18" />
              @if (remaining() !== null) {
                <div><b>Held for {{ countdown() }}</b><small>Nobody else can book them until then</small></div>
              } @else {
                <div><b>Pick up to {{ store.maxSeats() }} seats</b><small>We hold them for {{ holdMinutes() }} minutes while you pay</small></div>
              }
            </div>
            <div class="selection-list">
              @for (seat of selectedSeats(); track seat.id) {
                <div class="selection-item">
                  <span class="seat-pill">{{ seat.id }}</span>
                  <span class="grow">{{ seat.tier }}</span>
                  <b>{{ price(seat.price) }}</b>
                  <button class="icon-btn-round xs" [attr.aria-label]="'Remove ' + seat.id" (click)="toggleSeat(seat)"><lucide-icon [img]="icons.X" [size]="14" /></button>
                </div>
              } @empty {
                <p class="muted empty-note">Tap seats on the map to add them.</p>
              }
            </div>
            <div class="summary-total"><span>Total</span><b>{{ price(total()) }}</b></div>
            <button class="btn btn-primary btn-lg block" [disabled]="!selected().length || syncing()" (click)="openCheckout()">
              Continue to payment <lucide-icon [img]="icons.ChevronRight" [size]="18" />
            </button>
            <small class="fine-print"><lucide-icon [img]="icons.Check" [size]="13" /> No booking fee · free cancellation up to 2 hours before</small>
          </aside>
        </div>
      </div>

      @if (checkout()) {
        <app-checkout-modal
          [eventId]="event.id"
          [seats]="selectedSeats()"
          [subtitle]="event.title + ' · ' + date()"
          [countdown]="remaining() !== null ? countdown() : ''"
          (closed)="checkout.set(false); loadMap()"
          (booked)="onBooked($event)"
        />
      }
    } @else if (store.loaded()) {
      <div class="container page">
        <div class="empty-block">
          <h3>Event not found</h3>
          <button class="btn btn-primary" (click)="router.navigateByUrl('/discover')">Back to Discover</button>
        </div>
      </div>
    }
  `,
})
export class SeatsPage {
  /** Route param `:id`, bound via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected store = inject(StoreService);
  protected router = inject(Router);
  private api = inject(ApiService);
  protected readonly icons = { ArrowLeft, Check, ChevronRight, Sparkles, Timer, Users, X };
  protected readonly bestCount = signal(2);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  private stopLive: () => void = () => {};

  protected readonly map = signal<SeatMap | null>(null);
  protected readonly expiresAt = signal<number | null>(null);
  protected readonly now = signal(Date.now());
  protected readonly syncing = signal(false);
  protected readonly checkout = signal(false);
  protected readonly creatingRoom = signal(false);
  private holdQueue: Promise<void> = Promise.resolve();

  protected readonly event = computed(() => this.store.events().find((e) => e.id === this.id()) ?? null);
  protected readonly selected = this.store.selectedSeats;
  protected readonly holdMinutes = computed(() => this.store.meta()?.holdMinutes ?? 8);
  protected readonly date = computed(() => shortDate(this.event()!.startsAt));
  protected readonly time = computed(() => timeOf(this.event()!.startsAt));

  private readonly seatById = computed(() => new Map((this.map()?.seats ?? []).map((s) => [s.id, s])));
  protected readonly selectedSeats = computed(() =>
    this.selected().map((id) => this.seatById().get(id)).filter((s): s is Seat => !!s),
  );
  protected readonly total = computed(() => this.selectedSeats().reduce((sum, s) => sum + s.price, 0));
  protected readonly remaining = computed(() => {
    const expires = this.expiresAt();
    return expires && this.selected().length ? Math.max(0, Math.floor((expires - this.now()) / 1000)) : null;
  });
  protected readonly countdown = computed(() => {
    const s = this.remaining() ?? 0;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (this.store.selectedEventId() !== id) {
          this.store.selectedEventId.set(id);
          this.store.selectedSeats.set([]);
        }
        this.loadMap(true);
        this.stopLive();
        this.stopLive = this.realtime.listen([`event:${id}`], () => !this.syncing() && !this.checkout() && this.loadMap(), this.destroyRef);
      });
    });

    // Expire the hold on the client at the same moment the server does.
    effect(() => {
      if (this.remaining() === 0) {
        untracked(() => {
          this.selected.set([]);
          this.expiresAt.set(null);
          this.checkout.set(false);
          this.store.notify('Your seat hold expired. Pick your seats again.');
          this.loadMap();
        });
      }
    });

    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    const poll = setInterval(() => !this.syncing() && !this.checkout() && this.loadMap(), POLL_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      clearInterval(poll);
    });
  }

  protected price = inr;
  protected poster = (e: { art: number; imageUrl: string }) => posterStyle(e, 160);

  protected toggleSeat(seat: Seat): void {
    const current = this.selected();
    let next: string[];
    if (current.includes(seat.id)) next = current.filter((x) => x !== seat.id);
    else if (current.length < this.store.maxSeats()) next = [...current, seat.id];
    else {
      this.store.notify(`Maximum ${this.store.maxSeats()} seats per booking`);
      return;
    }
    this.selected.set(next);
    this.syncHold(next);
  }

  /** Sends hold changes one at a time so responses can't arrive out of order. */
  private syncHold(seats: string[]): void {
    this.syncing.set(true);
    this.holdQueue = this.holdQueue.then(async () => {
      try {
        const res = await firstValueFrom(this.api.hold(this.id(), seats));
        if (res.conflicts.length) {
          this.store.notify(`${res.conflicts.join(', ')} ${res.conflicts.length === 1 ? 'was' : 'were'} just taken by someone else`);
          this.selected.set(res.seats);
          await this.loadMap();
        }
        this.expiresAt.set(res.expiresAt ? Date.parse(res.expiresAt) : null);
      } catch (err) {
        this.store.notify(errorMessage(err));
        await this.loadMap();
      } finally {
        this.syncing.set(false);
      }
    });
  }

  protected async loadMap(initial = false): Promise<void> {
    try {
      const map = await firstValueFrom(this.api.seats(this.id()));
      this.map.set(map);
      // The server is the source of truth for which seats you hold; skip while a hold update is in flight.
      if (!this.syncing()) {
        this.selected.set(map.hold?.seats ?? []);
        this.expiresAt.set(map.hold ? Date.parse(map.hold.expiresAt) : null);
      }
    } catch (err) {
      if (initial) this.store.notify(errorMessage(err));
    }
  }

  protected async openCheckout(): Promise<void> {
    await this.holdQueue;
    if (this.selected().length) this.checkout.set(true);
  }

  /** Picks the front-most, most central block of adjacent free seats. */
  protected pickBest(): void {
    const map = this.map();
    if (!map) return;
    const n = this.bestCount();
    const free = (s: Seat) => s.status === 'available' || s.status === 'mine';
    const half = Math.ceil(map.layout.seatsPerRow / 2);
    const center = (map.layout.seatsPerRow + 1) / 2;
    const rows = [...new Set(map.seats.map((s) => s.row))];
    let best: { ids: string[]; score: number } | null = null;
    rows.forEach((row, r) => {
      const seats = map.seats.filter((s) => s.row === row);
      for (let i = 0; i + n <= seats.length; i++) {
        const block = seats.slice(i, i + n);
        // Stay on one side of the aisle so the group sits together.
        const crossesAisle = block[0].number <= half && block[block.length - 1].number > half;
        if (crossesAisle || !block.every(free)) continue;
        const mid = (block[0].number + block[block.length - 1].number) / 2;
        const score = r * 3 + Math.abs(mid - center);
        if (!best || score < best.score) best = { ids: block.map((s) => s.id), score };
      }
    });
    if (!best) {
      this.store.notify(`No block of ${n} adjacent seats left. Try fewer seats.`);
      return;
    }
    const ids = (best as { ids: string[] }).ids;
    this.selected.set(ids);
    this.syncHold(ids);
    this.store.notify(`Picked ${ids.join(', ')} for you`);
  }

  protected onBooked(order: Order): void {
    celebrate();
    this.selected.set([]);
    this.expiresAt.set(null);
    this.checkout.set(false);
    this.router.navigate(['/tickets'], { queryParams: { booked: order.id } });
    this.store.notify('Booking confirmed · tickets ready');
  }

  protected async bookWithFriends(): Promise<void> {
    this.creatingRoom.set(true);
    try {
      const room = await firstValueFrom(this.api.createRoom(this.id()));
      this.router.navigate(['/rooms', room.code]);
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.creatingRoom.set(false);
    }
  }
}
