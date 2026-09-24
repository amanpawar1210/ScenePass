import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CalendarPlus, ChevronDown, Download, ExternalLink, LucideAngularModule, Mail, MapPin, Ticket, Wallet, XCircle } from 'lucide-angular';
import { downloadTicketImage, verifyUrl } from '../../shared/ticket-image';
import { ApiService, errorMessage } from '../../core/api.service';
import { downloadCalendarFile } from '../../core/calendar';
import { Order } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { fullDateTime, inr, posterStyle, relativeDay, shortDate, timeOf } from '../../core/format';
import { QrCode } from '../../shared/qr-code';
import { Stars } from '../../shared/stars';
import { PageHero } from '../../shared/page-hero';
import { FormsModule } from '@angular/forms';

type Tab = 'Upcoming' | 'Past' | 'Cancelled';
const CANCEL_CUTOFF_MS = 2 * 3_600_000;

@Component({
  selector: 'app-tickets',
  imports: [FormsModule, LucideAngularModule, QrCode, Stars, PageHero],
  template: `
    <section class="simple-page">
      <app-page-hero
        eyebrow="Your wallet"
        title="Every ticket,"
        highlight="ready at the door."
        subtitle="Scannable QR tickets, calendar reminders and free cancellation up to 2 hours before the show."
        [icon]="icons.Ticket"
      >
        <div class="hero-stat-cards">
          <div><span class="stat-ic"><lucide-icon [img]="icons.CalendarPlus" [size]="18" /></span><b>{{ groups().Upcoming.length }}</b><small>upcoming</small></div>
          <div><span class="stat-ic"><lucide-icon [img]="icons.Ticket" [size]="18" /></span><b>{{ ticketCount() }}</b><small>tickets held</small></div>
          <div><span class="stat-ic"><lucide-icon [img]="icons.Wallet" [size]="18" /></span><b>{{ price(spent()) }}</b><small>spent</small></div>
        </div>
        @if (nextUp(); as n) {
          <button aside class="next-up" (click)="openNext(n)">
            <div class="next-art art-wide" [class.custom-img]="!!n.event.imageUrl" [style]="posterLarge(n)"></div>
            <div class="next-body">
              <small class="eyebrow">Next up</small>
              <b>{{ n.event.title }}</b>
              <span>{{ date(n) }} · {{ time(n) }} · {{ n.event.venue }}</span>
              <div class="countdown">
                @for (u of countdownParts(); track u.label) {
                  <div><b>{{ u.value }}</b><small>{{ u.label }}</small></div>
                }
              </div>
            </div>
          </button>
        }
      </app-page-hero>

      <div class="tabs">
        @for (t of tabs; track t) {
          <button [class.active]="tab() === t" (click)="tab.set(t)">
            {{ t }} <i>{{ groups()[t].length }}</i>
          </button>
        }
      </div>

      @for (order of groups()[tab()]; track order.id) {
        <article [id]="'order-' + order.id" class="booking-card" [class.cancelled]="order.status === 'cancelled'" [class.highlight]="order.id === booked()">
          <button class="booking-summary" (click)="toggle(order.id)" [attr.aria-expanded]="isOpen(order)">
            <div class="booking-thumb art-square" [class.custom-img]="!!order.event.imageUrl" [style]="poster(order)"></div>
            <div class="booking-info">
              <small>
                {{ date(order) }} · {{ time(order) }}
                @if (soon(order)) { <i class="soon-pill">{{ soon(order) }}</i> }
                @if (order.status === 'cancelled') { <i class="status-pill cancelled">Cancelled</i> }
              </small>
              <h2>{{ order.event.title }}</h2>
              <p><lucide-icon [img]="icons.MapPin" [size]="14" /> {{ order.event.venue }}, {{ order.event.city }}</p>
              <p class="seats-line">Seats {{ order.seats.join(' · ') }}</p>
            </div>
            <div class="booking-total">
              <b>{{ price(order.total) }}</b>
              <small>{{ order.code }}</small>
              <span class="chev" [class.rotated]="isOpen(order)"><lucide-icon [img]="icons.ChevronDown" [size]="18" /></span>
            </div>
          </button>

          @if (isOpen(order)) {
            <div class="booking-details">
              @if (order.status === 'confirmed') {
                <div class="ticket-strip">
                  @for (t of ticketsOf(order); track t.code) {
                    <div class="mini-ticket" [class.used]="!!t.checkedInAt">
                      <app-qr-code [value]="verify(t.code)" [size]="130" />
                      <b>{{ t.seat }}</b>
                      <small>{{ t.tier }} · {{ price(t.price) }}</small>
                      <code>{{ t.code }}</code>
                      @if (t.checkedInAt) {
                        <em>Checked in</em>
                      }
                      <div class="mini-actions">
                        <button title="Download ticket image" (click)="download(order, t)"><lucide-icon [img]="icons.Download" [size]="14" /></button>
                        <a title="Open verification page" [href]="verify(t.code)" target="_blank" rel="noopener"><lucide-icon [img]="icons.ExternalLink" [size]="14" /></a>
                      </div>
                    </div>
                  }
                </div>
              }
              <div class="booking-meta">
                <span>Booked {{ fullDate(order.createdAt) }}</span>
                @if (order.discount) {
                  <span>Saved {{ price(order.discount) }} with {{ order.promoCode }}</span>
                }
                @if (order.cancelledAt) {
                  <span>Cancelled {{ fullDate(order.cancelledAt) }} · full refund issued</span>
                }
              </div>
              @if (order.payment?.label) {
                <div class="receipt">
                  <div><small>Paid with</small><b>{{ order.payment!.label }}</b></div>
                  <div><small>Transaction</small><b>{{ order.payment!.txnId }}</b></div>
                  <div><small>Amount</small><b>{{ price(order.total) }}</b></div>
                  <div><small>Status</small><b [class.refunded]="order.status === 'cancelled'">{{ order.status === 'cancelled' ? 'Refunded' : 'Paid' }}</b></div>
                </div>
              }
              @if (order.email?.previewUrl) {
                <a class="email-link" [href]="order.email!.previewUrl" target="_blank" rel="noopener"><lucide-icon [img]="icons.Mail" [size]="15" /> View the confirmation email we sent</a>
              }
              @if (tab() === 'Past' && order.status === 'confirmed') {
                @if (reviewed().includes(order.eventId)) {
                  <div class="banner success compact">Thanks! Your review helps others pick great nights out.</div>
                } @else {
                  <div class="review-form">
                    <b>How was {{ order.event.title }}?</b>
                    <app-stars [editable]="true" [size]="24" [value]="ratings()[order.id] || 0" (valueChange)="setRating(order.id, $event)" />
                    <textarea rows="2" [(ngModel)]="comments[order.id]" placeholder="Share a few words about the show or venue (optional)" maxlength="600"></textarea>
                    <button class="btn btn-primary" [disabled]="!ratings()[order.id] || posting() === order.id" (click)="submitReview(order)">Post review</button>
                  </div>
                }
              }
              @if (order.status === 'confirmed' && tab() === 'Upcoming') {
                <div class="booking-actions">
                  <button (click)="addToCalendar(order)"><lucide-icon [img]="icons.CalendarPlus" [size]="16" /> Add to calendar</button>
                  <a [href]="mapUrl(order)" target="_blank" rel="noopener"><lucide-icon [img]="icons.MapPin" [size]="16" /> Directions</a>
                  @if (canCancel(order)) {
                    <button class="danger" [disabled]="cancelling() === order.id" (click)="cancel(order)">
                      <lucide-icon [img]="icons.XCircle" [size]="16" /> Cancel booking
                    </button>
                  }
                </div>
              }
            </div>
          }
        </article>
      } @empty {
        <div class="empty-state">
          <lucide-icon [img]="icons.Ticket" [size]="42" />
          <h2>{{ tab() === 'Upcoming' ? 'No upcoming tickets' : 'Nothing here yet' }}</h2>
          <p>Your confirmed bookings and QR passes will live here.</p>
          <button (click)="router.navigateByUrl('/discover')">Discover events</button>
        </div>
      }
    </section>
  `,
})
export class TicketsPage {
  /** `?booked=<orderId>` after checkout, to open the new booking. */
  readonly booked = input<string>();

  protected store = inject(StoreService);
  protected router = inject(Router);
  private api = inject(ApiService);
  protected readonly icons = { CalendarPlus, ChevronDown, Download, ExternalLink, Mail, MapPin, Ticket, Wallet, XCircle };
  private readonly clock = signal(Date.now());
  protected readonly nextUp = computed(() => this.groups().Upcoming[0] ?? null);
  protected readonly ticketCount = computed(() => this.groups().Upcoming.reduce((n, o) => n + o.seats.length, 0));
  protected readonly spent = computed(() => this.store.orders().filter((o) => o.status === 'confirmed').reduce((n, o) => n + o.total, 0));
  protected readonly countdownParts = computed(() => {
    const n = this.nextUp();
    const ms = n ? Math.max(0, Date.parse(n.event.startsAt) - this.clock()) : 0;
    const s = Math.floor(ms / 1000);
    return [
      { value: Math.floor(s / 86400), label: 'days' },
      { value: Math.floor((s % 86400) / 3600), label: 'hrs' },
      { value: Math.floor((s % 3600) / 60), label: 'min' },
      { value: s % 60, label: 'sec' },
    ].map((u) => ({ ...u, value: String(u.value).padStart(2, '0') }));
  });
  protected posterLarge = (o: Order) => posterStyle(o.event, 520);

  protected openNext(order: Order): void {
    this.tab.set('Upcoming');
    if (!this.isOpen(order)) this.toggle(order.id);
    setTimeout(() => document.getElementById('order-' + order.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }
  protected verify = verifyUrl;

  constructor() {
    // Confirmation emails are sent in the background; refresh to pick up their links.
    const refresh = () => firstValueFrom(this.api.orders()).then((o) => this.store.orders.set(o)).catch(() => {});
    refresh();
    const timer = setTimeout(refresh, 10_000);
    const tick = setInterval(() => this.clock.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      clearInterval(tick);
    });
  }
  protected readonly tabs: Tab[] = ['Upcoming', 'Past', 'Cancelled'];
  protected readonly tab = signal<Tab>('Upcoming');
  private readonly openIds = signal<Set<string>>(new Set());
  protected readonly cancelling = signal<string | null>(null);
  protected readonly ratings = signal<Record<string, number>>({});
  protected readonly reviewed = signal<string[]>([]);
  protected readonly posting = signal<string | null>(null);
  protected comments: Record<string, string> = {};

  protected readonly groups = computed(() => {
    const now = Date.now();
    const groups: Record<Tab, Order[]> = { Upcoming: [], Past: [], Cancelled: [] };
    for (const order of this.store.orders()) {
      if (order.status === 'cancelled') groups.Cancelled.push(order);
      else if (Date.parse(order.event.startsAt) + (order.event.durationMins || 120) * 60_000 > now) groups.Upcoming.push(order);
      else groups.Past.push(order);
    }
    groups.Upcoming.sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt));
    return groups;
  });

  protected price = inr;
  protected date = (o: Order) => shortDate(o.event.startsAt);
  protected time = (o: Order) => timeOf(o.event.startsAt);
  protected soon = (o: Order) => (o.status === 'confirmed' ? relativeDay(o.event.startsAt) : '');
  protected fullDate = fullDateTime;
  protected poster = (o: Order) => posterStyle(o.event, 200);
  protected mapUrl = (o: Order) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.event.venue}, ${o.event.address ?? ''}, ${o.event.city}`)}`;

  /** Older bookings may predate per-ticket codes; fall back to the booking code. */
  protected ticketsOf(order: Order) {
    return order.tickets?.length
      ? order.tickets
      : order.seats.map((seat) => ({ code: `${order.code}-${seat}`, seat, tier: '', price: 0, checkedInAt: null }));
  }

  protected isOpen(order: Order): boolean {
    return this.openIds().has(order.id) || order.id === this.booked() || this.groups()[this.tab()].length === 1;
  }

  protected toggle(id: string): void {
    this.openIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected canCancel(order: Order): boolean {
    return (
      Date.parse(order.event.startsAt) - Date.now() > CANCEL_CUTOFF_MS &&
      !order.tickets?.some((t) => t.checkedInAt)
    );
  }

  protected setRating(orderId: string, value: number): void {
    this.ratings.update((r) => ({ ...r, [orderId]: value }));
  }

  protected async submitReview(order: Order): Promise<void> {
    this.posting.set(order.id);
    try {
      await firstValueFrom(this.api.addReview(order.eventId, this.ratings()[order.id], this.comments[order.id] ?? ''));
      this.reviewed.update((ids) => [...ids, order.eventId]);
      this.store.notify('Review posted, thank you!');
    } catch (err) {
      // Already reviewed counts as done.
      if (errorMessage(err).includes('already')) this.reviewed.update((ids) => [...ids, order.eventId]);
      this.store.notify(errorMessage(err));
    } finally {
      this.posting.set(null);
    }
  }

  protected async download(order: Order, ticket: Order['tickets'][number]): Promise<void> {
    await downloadTicketImage(order, ticket);
    this.store.notify(`Saved ${ticket.code}.png`);
  }

  protected addToCalendar(order: Order): void {
    downloadCalendarFile(order);
  }

  protected async cancel(order: Order): Promise<void> {
    if (!confirm(`Cancel ${order.seats.length} ticket(s) for ${order.event.title}? You'll get a full refund.`)) return;
    this.cancelling.set(order.id);
    try {
      this.store.replaceOrder(await firstValueFrom(this.api.cancelOrder(order.id)));
      this.store.refreshEvents();
      this.store.notify('Booking cancelled · seats released');
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.cancelling.set(null);
    }
  }
}
