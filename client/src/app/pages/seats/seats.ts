import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  LucideAngularModule,
  Plus,
  Users,
  X,
  Zap,
} from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { MAX_SEATS, Seat } from '../../core/models';
import { StoreService } from '../../core/store.service';

// Seats shown as "held by a friend" in the group-room preview.
const DEMO_HELD = [19, 38];

@Component({
  selector: 'app-seats',
  imports: [LucideAngularModule],
  template: `
    @if (event(); as event) {
      <section class="seat-page">
        <header class="seat-head">
          <button (click)="router.navigateByUrl('/discover')"><lucide-icon [img]="icons.ArrowLeft" [size]="18" /></button>
          <div>
            <small>{{ event.type }} · {{ event.date }}</small>
            <h1>{{ event.title }}</h1>
            <p>{{ event.venue }}</p>
          </div>
          <div class="room-people">
            <span>YOU</span><span>NK</span><span>JM</span>
            <button (click)="router.navigateByUrl('/room')"><lucide-icon [img]="icons.Plus" [size]="14" /></button>
          </div>
        </header>
        <div class="seat-layout">
          <section class="seat-map">
            <div class="screen"><span>STAGE</span></div>
            <div class="seat-legend">
              <span><i class="available"></i>Available</span>
              <span><i class="selected"></i>Your seats</span>
              <span><i class="held"></i>Held by friend</span>
              <span><i class="blocked"></i>Unavailable</span>
            </div>
            <div class="seat-grid">
              @for (seat of seats(); track seat.id; let i = $index) {
                <button
                  [disabled]="seat.blocked || seat.taken"
                  [title]="seat.id + ' · ₹' + seat.price"
                  [class.selected]="selected().includes(seat.id)"
                  [class.held]="isHeld(i)"
                  (click)="toggleSeat(seat.id)"
                >
                  <span>{{ seat.id }}</span>
                </button>
              }
            </div>
            <div class="tiers"><span>PLATINUM · ₹2,499</span><span>GOLD · ₹1,899</span><span>SILVER · ₹1,499</span></div>
          </section>
          <aside class="booking-panel">
            <span>LIVE SEAT ROOM</span>
            <h2>Build your perfect row.</h2>
            <div class="timer">
              <lucide-icon [img]="icons.Zap" [size]="17" />
              <div><b>Seats lock for 06:42</b><small>Synced across everyone in your room</small></div>
            </div>
            <div class="selection">
              <header><span>YOUR SELECTION</span><b>{{ selected().length }}/{{ maxSeats }}</b></header>
              @for (seat of selectedSeats(); track seat.id) {
                <div>
                  <span><b>{{ seat.id }}</b><small>{{ seat.tier }}</small></span>
                  <strong>₹{{ seat.price }}</strong>
                  <button (click)="toggleSeat(seat.id)"><lucide-icon [img]="icons.X" [size]="14" /></button>
                </div>
              } @empty {
                <p>Select seats from the map to continue.</p>
              }
            </div>
            <div class="price"><span>Total</span><b>₹{{ total().toLocaleString('en-IN') }}</b></div>
            <button class="continue" [disabled]="!selected().length" (click)="checkout.set(true)">
              Continue to payment <lucide-icon [img]="icons.ChevronRight" [size]="17" />
            </button>
            <small class="safe"><lucide-icon [img]="icons.Check" [size]="13" /> No convenience fee in this demo</small>
          </aside>
        </div>
      </section>

      @if (checkout()) {
        <div class="modal">
          <section>
            <button class="close" aria-label="Close" (click)="checkout.set(false)"><lucide-icon [img]="icons.X" /></button>
            <span>DUMMY CHECKOUT · NO REAL CHARGE</span>
            <h2>One step from the scene.</h2>
            <div class="pay-row">
              <lucide-icon [img]="icons.CreditCard" />
              <span><b>Demo card</b><small>4242 4242 4242 4242</small></span>
              <lucide-icon [img]="icons.Check" />
            </div>
            <div class="split">
              <lucide-icon [img]="icons.Users" />
              <span><b>Split with your group</b><small>Demo invite links only</small></span>
              <button (click)="store.notify('Demo split link created')"><lucide-icon [img]="icons.Plus" /></button>
            </div>
            <div class="modal-total"><span>{{ selected().length }} tickets</span><b>₹{{ total().toLocaleString('en-IN') }}</b></div>
            <button class="pay" [disabled]="paying()" (click)="completeBooking()">Complete dummy payment</button>
          </section>
        </div>
      }
    } @else if (store.loaded()) {
      <section class="simple-page empty-state">
        <h2>Event not found</h2>
        <p>It may have been unpublished by the organizer.</p>
        <button (click)="router.navigateByUrl('/discover')">Back to Discover</button>
      </section>
    }
  `,
})
export class SeatsPage {
  /** Route param `:id`, bound via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected store = inject(StoreService);
  protected router = inject(Router);
  private api = inject(ApiService);
  protected readonly icons = { ArrowLeft, Check, ChevronRight, CreditCard, Plus, Users, X, Zap };
  protected readonly maxSeats = MAX_SEATS;

  protected readonly seats = signal<Seat[]>([]);
  protected readonly checkout = signal(false);
  protected readonly paying = signal(false);

  protected readonly event = computed(() => this.store.events().find((e) => e.id === this.id()) ?? null);
  protected readonly selected = this.store.selectedSeats;
  protected readonly selectedSeats = computed(() =>
    this.selected()
      .map((id) => this.seats().find((s) => s.id === id))
      .filter((s): s is Seat => !!s),
  );
  protected readonly total = computed(() => this.selectedSeats().reduce((sum, s) => sum + s.price, 0));

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (this.store.selectedEventId() !== id) {
          this.store.selectedEventId.set(id);
          this.store.selectedSeats.set([]);
        }
        this.loadSeats(id);
      });
    });
  }

  protected isHeld(index: number): boolean {
    return DEMO_HELD.includes(index);
  }

  protected toggleSeat(id: string): void {
    const current = this.selected();
    if (current.includes(id)) this.selected.set(current.filter((x) => x !== id));
    else if (current.length < MAX_SEATS) this.selected.set([...current, id]);
    else this.store.notify(`Maximum ${MAX_SEATS} seats per booking`);
  }

  protected async completeBooking(): Promise<void> {
    this.paying.set(true);
    try {
      const order = await firstValueFrom(this.api.createOrder(this.id(), this.selected()));
      this.store.orders.update((orders) => [order, ...orders]);
      this.selected.set([]);
      this.checkout.set(false);
      this.router.navigateByUrl('/tickets');
      this.store.notify('Booking confirmed · tickets ready');
    } catch (err) {
      this.store.notify(errorMessage(err));
      this.checkout.set(false);
      this.loadSeats(this.id());
    } finally {
      this.paying.set(false);
    }
  }

  private async loadSeats(id: string): Promise<void> {
    try {
      const seats = await firstValueFrom(this.api.seats(id));
      this.seats.set(seats);
      // Drop any selections that someone else has booked in the meantime.
      const unavailable = new Set(seats.filter((s) => s.taken || s.blocked).map((s) => s.id));
      this.selected.update((current) => current.filter((x) => !unavailable.has(x)));
    } catch {
      this.seats.set([]);
    }
  }
}
