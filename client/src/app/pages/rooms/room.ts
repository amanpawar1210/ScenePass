import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ArrowLeft, CircleCheck, Copy, Crown, LogOut, LucideAngularModule, Share2, Timer, Users, X } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { GroupRoom, Order, Seat, SeatMap } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { initialsOf, inr, shortDate, timeOf } from '../../core/format';
import { CheckoutModal } from '../../shared/checkout-modal';
import { SeatMapView, SeatTags } from '../../shared/seat-map';

const POLL_MS = 4_000;

@Component({
  selector: 'app-room',
  imports: [LucideAngularModule, SeatMapView, CheckoutModal],
  template: `
    <div class="container page">
      @if (room(); as r) {
        @let e = r.event;
        <header class="page-head with-back">
          <button class="icon-btn-round" aria-label="All rooms" (click)="router.navigateByUrl('/rooms')"><lucide-icon [img]="icons.ArrowLeft" [size]="18" /></button>
          <div>
            <small class="eyebrow">Group room · {{ r.code }}</small>
            <h1>{{ e?.title ?? 'Event' }}</h1>
            @if (e) {
              <p class="muted">{{ date(e.startsAt) }} · {{ time(e.startsAt) }} · {{ e.venue }}, {{ e.city }}</p>
            }
          </div>
          @if (r.isMember && !r.isHost && r.status === 'open') {
            <button class="btn btn-outline" (click)="leave()"><lucide-icon [img]="icons.LogOut" [size]="16" /> Leave</button>
          }
        </header>

        @if (r.status === 'booked') {
          <div class="banner success">
            <lucide-icon [img]="icons.CircleCheck" [size]="20" />
            <div>
              <b>This group is booked!</b>
              <span>{{ hostName() }} booked seats {{ bookedSeats() }}.
                @if (r.isHost) { Your tickets are in your wallet. } @else { Ask {{ hostName() }} to share the QR tickets. }</span>
            </div>
            @if (r.isHost) {
              <button class="btn btn-primary" (click)="router.navigate(['/tickets'], { queryParams: { booked: r.orderId } })">View tickets</button>
            }
          </div>
        } @else if (!r.isMember) {
          <div class="banner">
            <lucide-icon [img]="icons.Users" [size]="20" />
            <div><b>{{ hostName() }} invited you to book together</b><span>Join to pick seats on the shared map.</span></div>
            <button class="btn btn-primary" [disabled]="busy()" (click)="join()">Join room</button>
          </div>
        }

        <div class="seat-layout">
          <section class="card seat-card">
            @if (map(); as m) {
              <app-seat-map [map]="m" [selected]="selection()" [tags]="tags()" (toggle)="toggle($event)" />
            } @else {
              <div class="skeleton-block"></div>
            }
          </section>

          <aside class="side-stack">
            <section class="card">
              <div class="card-head">
                <h2>People <small class="muted">{{ r.members.length }}/8</small></h2>
              </div>
              <div class="member-list">
                @for (m of r.members; track m.user; let i = $index) {
                  <div class="member">
                    <span class="avatar-sm" [attr.data-tone]="i % 6">{{ initials(m.name) }}</span>
                    <span class="grow"><b>{{ m.name }}@if (m.user === myId()) { <small class="muted">(you)</small> }</b>
                      <small class="muted">{{ picksBy(m.user) }} {{ picksBy(m.user) === 1 ? 'seat' : 'seats' }} picked</small></span>
                    @if (m.user === r.host) {
                      <span class="chip chip-brand"><lucide-icon [img]="icons.Crown" [size]="12" /> Host</span>
                    }
                  </div>
                }
              </div>
              @if (r.status === 'open') {
                <div class="invite-box">
                  <small class="muted">Invite link</small>
                  <div class="invite-row">
                    <code>{{ inviteUrl() }}</code>
                    <button class="icon-btn-round sm" aria-label="Copy invite link" (click)="copyInvite()"><lucide-icon [img]="icons.Copy" [size]="15" /></button>
                    <button class="icon-btn-round sm" aria-label="Share invite" (click)="shareInvite()"><lucide-icon [img]="icons.Share2" [size]="15" /></button>
                  </div>
                </div>
              }
            </section>

            <section class="card">
              <h2>Group seats</h2>
              @if (r.status === 'open' && remaining() !== null) {
                <div class="timer" [class.urgent]="remaining()! < 60">
                  <lucide-icon [img]="icons.Timer" [size]="18" />
                  <div><b>Held for {{ countdown() }}</b><small>Seats are held under {{ hostName() }}'s account</small></div>
                </div>
              }
              <div class="selection-list">
                @for (s of selectedSeats(); track s.seat.id) {
                  <div class="selection-item">
                    <span class="seat-pill" [attr.data-tone]="s.tone">{{ s.seat.id }}</span>
                    <span class="grow">{{ s.seat.tier }} <small class="muted">· {{ s.byName }}</small></span>
                    <b>{{ price(s.seat.price) }}</b>
                    @if (r.isMember && r.status === 'open') {
                      <button class="icon-btn-round xs" [attr.aria-label]="'Remove ' + s.seat.id" (click)="toggle(s.seat)"><lucide-icon [img]="icons.X" [size]="14" /></button>
                    }
                  </div>
                } @empty {
                  <p class="muted empty-note">{{ r.isMember ? 'Tap seats on the map. Up to ' + store.maxSeats() + ' for the group.' : 'Join the room to start picking.' }}</p>
                }
              </div>
              <div class="summary-total"><span>Total</span><b>{{ price(total()) }}</b></div>
              @if (r.members.length > 1 && total()) {
                <div class="split-row"><span>Split {{ r.members.length }} ways</span><b>{{ price(total() / r.members.length) }} each</b></div>
              }
              @if (r.status === 'open') {
                @if (r.isHost) {
                  <button class="btn btn-primary btn-lg block" [disabled]="!selection().length || busy()" (click)="checkout.set(true)">Check out for the group</button>
                } @else if (r.isMember) {
                  <small class="muted center">Only {{ hostName() }} (the host) can check out.</small>
                }
              }
            </section>
          </aside>
        </div>

        @if (checkout() && e) {
          <app-checkout-modal
            [eventId]="e.id"
            [seats]="checkoutSeats()"
            title="Book for your group"
            [subtitle]="e.title + ' · ' + r.members.length + ' people'"
            [roomCode]="r.code"
            [splitWays]="r.members.length"
            [countdown]="remaining() !== null ? countdown() : ''"
            (closed)="checkout.set(false); refresh()"
            (booked)="onBooked($event)"
          />
        }
      } @else if (error()) {
        <div class="empty-block">
          <lucide-icon [img]="icons.Users" [size]="30" />
          <h3>{{ error() }}</h3>
          <button class="btn btn-primary" (click)="router.navigateByUrl('/rooms')">Back to group booking</button>
        </div>
      } @else {
        <div class="skeleton-block"></div>
      }
    </div>
  `,
})
export class RoomPage {
  /** Route param `:code`. */
  readonly code = input.required<string>();

  protected store = inject(StoreService);
  protected router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  protected readonly icons = { ArrowLeft, CircleCheck, Copy, Crown, LogOut, Share2, Timer, Users, X };

  protected readonly room = signal<GroupRoom | null>(null);
  protected readonly map = signal<SeatMap | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly checkout = signal(false);
  protected readonly now = signal(Date.now());
  private updating = false;

  protected readonly myId = computed(() => this.auth.user()?.id ?? '');
  protected readonly selection = computed(() => this.room()?.selection.map((s) => s.seat) ?? []);
  private readonly toneOf = computed(() => new Map((this.room()?.members ?? []).map((m, i) => [m.user, i % 6])));
  protected readonly tags = computed<SeatTags>(() =>
    Object.fromEntries((this.room()?.selection ?? []).map((s) => [s.seat, { initials: initialsOf(s.byName), tone: this.toneOf().get(s.by) ?? 0 }])),
  );
  private readonly seatById = computed(() => new Map((this.map()?.seats ?? []).map((s) => [s.id, s])));
  protected readonly selectedSeats = computed(() =>
    (this.room()?.selection ?? [])
      .map((s) => ({ seat: this.seatById().get(s.seat), byName: s.byName, tone: this.toneOf().get(s.by) ?? 0 }))
      .filter((x): x is { seat: Seat; byName: string; tone: number } => !!x.seat),
  );
  protected readonly checkoutSeats = computed(() => this.selectedSeats().map((s) => s.seat));
  protected readonly total = computed(() => this.selectedSeats().reduce((sum, s) => sum + s.seat.price, 0));
  protected readonly hostName = computed(() => {
    const r = this.room();
    return r?.members.find((m) => m.user === r.host)?.name ?? 'The host';
  });
  protected readonly bookedSeats = computed(() => this.selection().join(', '));
  protected readonly inviteUrl = computed(() => `${location.origin}/rooms/${this.room()?.code ?? ''}`);
  protected readonly remaining = computed(() => {
    const hold = this.room()?.hold;
    return hold && this.selection().length ? Math.max(0, Math.floor((Date.parse(hold.expiresAt) - this.now()) / 1000)) : null;
  });
  protected readonly countdown = computed(() => {
    const s = this.remaining() ?? 0;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    effect(() => {
      const code = this.code();
      untracked(() => this.refresh(code));
    });
    const poll = setInterval(() => !this.updating && !this.checkout() && this.refresh(), POLL_MS);
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(poll);
      clearInterval(tick);
    });
  }

  protected price = inr;
  protected date = shortDate;
  protected time = timeOf;
  protected initials = initialsOf;
  protected picksBy = (userId: string) => (this.room()?.selection ?? []).filter((s) => s.by === userId).length;

  async refresh(code = this.code()): Promise<void> {
    try {
      const room = await firstValueFrom(this.api.room(code));
      this.room.set(room);
      if (room.event) this.map.set(await firstValueFrom(this.api.seats(room.event.id)));
      this.error.set('');
    } catch (err) {
      if (!this.room()) this.error.set(errorMessage(err));
    }
  }

  protected async join(): Promise<void> {
    this.busy.set(true);
    try {
      this.room.set(await firstValueFrom(this.api.joinRoom(this.code())));
      this.store.notify("You're in! Pick seats together.");
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async leave(): Promise<void> {
    if (!confirm('Leave this group room? Your seat picks will be removed.')) return;
    try {
      await firstValueFrom(this.api.leaveRoom(this.code()));
      this.router.navigateByUrl('/rooms');
    } catch (err) {
      this.store.notify(errorMessage(err));
    }
  }

  protected async toggle(seat: Seat): Promise<void> {
    const r = this.room();
    if (!r || r.status !== 'open') return;
    if (!r.isMember) {
      this.store.notify('Join the room to pick seats');
      return;
    }
    const current = this.selection();
    let next: string[];
    if (current.includes(seat.id)) next = current.filter((s) => s !== seat.id);
    else if (current.length < this.store.maxSeats()) next = [...current, seat.id];
    else {
      this.store.notify(`Groups can hold up to ${this.store.maxSeats()} seats`);
      return;
    }
    this.updating = true;
    try {
      const updated = await firstValueFrom(this.api.setRoomSeats(r.code, next));
      if (updated.conflicts?.length) this.store.notify(`${updated.conflicts.join(', ')} just got taken`);
      this.room.set(updated);
      if (updated.event) this.map.set(await firstValueFrom(this.api.seats(updated.event.id)));
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.updating = false;
    }
  }

  protected copyInvite(): void {
    navigator.clipboard?.writeText(this.inviteUrl());
    this.store.notify('Invite link copied');
  }

  protected async shareInvite(): Promise<void> {
    const url = this.inviteUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join me for ${this.room()?.event?.title ?? 'a show'}`, url });
        return;
      } catch {}
    }
    this.copyInvite();
  }

  protected onBooked(order: Order): void {
    this.checkout.set(false);
    this.store.notify('Group booking confirmed!');
    this.router.navigate(['/tickets'], { queryParams: { booked: order.id } });
  }
}
