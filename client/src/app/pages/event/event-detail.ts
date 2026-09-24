import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ArrowLeft,
  BellRing,
  CalendarDays,
  Clock,
  Heart,
  Languages,
  LucideAngularModule,
  MapPin,
  Share2,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { EventItem, ReviewSummary, SeatMap } from '../../core/models';
import { StoreService } from '../../core/store.service';
import {
  availability,
  categoryLabel,
  durationLabel,
  initialsOf,
  inr,
  longDate,
  posterStyle,
  relativeDay,
  shortDate,
  timeOf,
} from '../../core/format';
import { EventCard } from '../../shared/event-card';
import { Stars } from '../../shared/stars';

@Component({
  selector: 'app-event-detail',
  imports: [LucideAngularModule, EventCard, Stars],
  template: `
    @if (event(); as e) {
      <div class="container page detail-page">
        <button class="back-link" (click)="router.navigateByUrl('/discover')">
          <lucide-icon [img]="icons.ArrowLeft" [size]="16" /> All events
        </button>

        <section class="detail-hero">
          <div class="art-frame"><div class="detail-art art-wide" [class.custom-img]="!!e.imageUrl" [style]="poster()"></div></div>
          <div class="detail-head">
            <div class="chip-row">
              <span class="chip chip-brand">{{ category() }}</span>
              @if (soon()) {
                <span class="chip">{{ soon() }}</span>
              }
              @if (badge(); as b) {
                <span [class]="'chip avail-chip ' + b.tone">{{ b.label }}</span>
              }
            </div>
            <h1>{{ e.title }}</h1>
            <p class="lead">{{ e.sub }}</p>
            <div class="detail-actions">
              <button class="btn btn-outline" [class.saved]="saved()" (click)="store.toggleFavourite(e.id)">
                <lucide-icon [img]="icons.Heart" [size]="17" /> {{ saved() ? 'Saved' : 'Save' }}
              </button>
              <button class="btn btn-outline" (click)="share()"><lucide-icon [img]="icons.Share2" [size]="17" /> Share</button>
            </div>
          </div>
        </section>

        <div class="detail-layout">
          <div class="detail-main">
            <section class="card facts">
              <div><lucide-icon [img]="icons.CalendarDays" [size]="20" /><span><b>{{ date() }}</b><small>{{ time() }} onwards</small></span></div>
              <div><lucide-icon [img]="icons.Clock" [size]="20" /><span><b>{{ duration() }}</b><small>Gates open 45 min before</small></span></div>
              <div>
                <lucide-icon [img]="icons.MapPin" [size]="20" />
                <span>
                  <b><a class="link" (click)="router.navigate(['/venues', e.venueSlug])">{{ e.venue }}</a></b>
                  <small>{{ e.address ? e.address + ', ' : '' }}{{ e.city }} · <a class="link" [href]="mapUrl()" target="_blank" rel="noopener">Directions</a></small>
                </span>
              </div>
              <div><lucide-icon [img]="icons.Languages" [size]="20" /><span><b>{{ e.language }}</b><small>{{ e.ageLimit }}</small></span></div>
            </section>

            <section class="card">
              <h2>About</h2>
              <p class="prose">{{ e.description || e.sub }}</p>
              @if (e.tags.length) {
                <div class="chip-row">
                  @for (tag of e.tags; track tag) {
                    <span class="chip">{{ tag }}</span>
                  }
                </div>
              }
            </section>

            @if (e.lineup.length) {
              <section class="card">
                <h2>Lineup</h2>
                <div class="lineup">
                  @for (person of e.lineup; track person.name) {
                    <div class="person">
                      <span class="avatar-sm">{{ initials(person.name) }}</span>
                      <span><b>{{ person.name }}</b>@if (person.role) {<small>{{ person.role }}</small>}</span>
                    </div>
                  }
                </div>
              </section>
            }

            <section class="card">
              <div class="card-head">
                <h2>Reviews of {{ e.venue }}</h2>
                <a class="link" (click)="router.navigate(['/venues', e.venueSlug])">View venue</a>
              </div>
              @if (reviews(); as r) {
                @if (r.count) {
                  <div class="rating-summary">
                    <div class="rating-big">
                      <b>{{ r.avg.toFixed(1) }}</b>
                      <app-stars [value]="r.avg" [size]="17" />
                      <small class="muted">{{ r.count }} reviews</small>
                    </div>
                    <div class="rating-bars">
                      @for (row of r.breakdown; track row.stars) {
                        <div><span>{{ row.stars }}★</span><i><em [style.width.%]="(row.count / r.count) * 100"></em></i><small>{{ row.count }}</small></div>
                      }
                    </div>
                  </div>
                  <div class="review-list">
                    @for (rev of r.reviews.slice(0, showAllReviews() ? 20 : 4); track rev.id) {
                      <article class="review">
                        <span class="avatar-sm">{{ initials(rev.userName) }}</span>
                        <div>
                          <div class="review-head"><b>{{ rev.userName }}</b><app-stars [value]="rev.rating" [size]="13" /><small class="muted">{{ shortDate(rev.createdAt) }}</small></div>
                          @if (rev.eventTitle) {
                            <small class="muted">Attended {{ rev.eventTitle }}</small>
                          }
                          @if (rev.comment) {
                            <p>{{ rev.comment }}</p>
                          }
                        </div>
                      </article>
                    }
                  </div>
                  @if (r.reviews.length > 4 && !showAllReviews()) {
                    <button class="btn btn-outline" (click)="showAllReviews.set(true)">Show all {{ r.reviews.length }} reviews</button>
                  }
                } @else {
                  <p class="muted">No reviews for this venue yet. Attend a show and be the first.</p>
                }
              } @else {
                <div class="skeleton-line"></div>
              }
            </section>

            <section class="card">
              <h2>Good to know</h2>
              <ul class="check-list">
                <li><lucide-icon [img]="icons.ShieldCheck" [size]="17" /> Free cancellation up to 2 hours before the show</li>
                <li><lucide-icon [img]="icons.Ticket" [size]="17" /> Mobile QR tickets, one per seat</li>
                <li><lucide-icon [img]="icons.Users" [size]="17" /> Book with friends in a group room and split the cost</li>
              </ul>
            </section>
          </div>

          <aside class="buy-card">
            <div class="booking-price"><small class="muted">Tickets from</small><b>{{ price(e.price) }}</b></div>
            @for (tier of tierStats(); track tier.name) {
              <div class="tier" [class.sold-out]="!tier.left">
                <div><b>{{ tier.name }}</b><small>Rows {{ tier.rows }}</small></div>
                <div><b>{{ price(tier.price) }}</b><small [class.warn-text]="tier.left > 0 && tier.left <= 10">{{ tier.left ? tier.left + ' left' : 'Sold out' }}</small></div>
              </div>
            }
            <div class="progress"><i [style.width.%]="soldPct()"></i></div>
            <small class="muted">{{ e.sold }} of {{ e.capacity }} seats booked</small>

            @if (ended()) {
              <button class="btn btn-lg block" disabled>This event has started</button>
            } @else if (e.seatsLeft <= 0) {
              @if (waitlisted()) {
                <button class="btn btn-outline btn-lg block" (click)="toggleWaitlist()">
                  <lucide-icon [img]="icons.BellRing" [size]="18" /> On the waitlist · leave
                </button>
                <small class="muted center">We'll notify you the moment seats open up.</small>
              } @else {
                <button class="btn btn-primary btn-lg block" (click)="toggleWaitlist()">
                  <lucide-icon [img]="icons.BellRing" [size]="18" /> Join the waitlist
                </button>
                <small class="muted center">{{ waitlistCount() }} {{ waitlistCount() === 1 ? 'person is' : 'people are' }} waiting</small>
              }
            } @else {
              <button class="btn btn-primary btn-lg block" (click)="bookSeats()">Select seats</button>
              <button class="btn btn-outline btn-lg block" [disabled]="creatingRoom()" (click)="bookWithFriends()">
                <lucide-icon [img]="icons.Users" [size]="18" /> Book with friends
              </button>
            }
          </aside>
        </div>

        @if (similar().length) {
          <section class="section">
            <header class="section-head"><div><h2>You might also like</h2></div></header>
            <div class="event-grid">
              @for (s of similar(); track s.id) {
                <app-event-card [event]="s" />
              }
            </div>
          </section>
        }
      </div>
    } @else if (notFound()) {
      <div class="container page">
        <div class="empty-block">
          <h3>Event not found</h3>
          <p class="muted">It may have been unpublished by the organizer.</p>
          <button class="btn btn-primary" (click)="router.navigateByUrl('/discover')">Back to Discover</button>
        </div>
      </div>
    } @else {
      <div class="container page"><div class="skeleton-block"></div></div>
    }
  `,
})
export class EventDetailPage {
  /** Route param `:id`. */
  readonly id = input.required<string>();

  protected store = inject(StoreService);
  protected router = inject(Router);
  private api = inject(ApiService);
  protected readonly icons = { ArrowLeft, BellRing, CalendarDays, Clock, Heart, Languages, MapPin, Share2, ShieldCheck, Ticket, Users };

  private readonly fetched = signal<EventItem | null>(null);
  protected readonly notFound = signal(false);
  private readonly seatMap = signal<SeatMap | null>(null);
  protected readonly reviews = signal<ReviewSummary | null>(null);
  protected readonly showAllReviews = signal(false);
  protected readonly waitlisted = signal(false);
  protected readonly waitlistCount = signal(0);
  protected readonly creatingRoom = signal(false);

  protected readonly event = computed(() => {
    // Ignore the previously fetched event while navigating to another one.
    const fetched = this.fetched();
    return (fetched?.id === this.id() ? fetched : null) ?? this.store.events().find((e) => e.id === this.id()) ?? null;
  });
  protected readonly saved = computed(() => this.store.favourites().includes(this.id()));
  protected readonly poster = computed(() => posterStyle(this.event()!));
  protected readonly badge = computed(() => availability(this.event()!));
  protected readonly category = computed(() => categoryLabel(this.event()!.type));
  protected readonly soon = computed(() => relativeDay(this.event()!.startsAt));
  protected readonly date = computed(() => longDate(this.event()!.startsAt));
  protected readonly time = computed(() => timeOf(this.event()!.startsAt));
  protected readonly duration = computed(() => durationLabel(this.event()!.durationMins));
  protected readonly ended = computed(() => Date.parse(this.event()!.startsAt) <= Date.now());
  protected readonly soldPct = computed(() => (this.event()!.sold / this.event()!.capacity) * 100);
  protected readonly mapUrl = computed(() => {
    const e = this.event()!;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venue}, ${e.address}, ${e.city}`)}`;
  });

  protected readonly tierStats = computed(() => {
    const map = this.seatMap();
    const e = this.event();
    if (!map) return (e?.tiers ?? []).map((t) => ({ name: t.name, price: t.price, rows: t.rows.join(''), left: 1 }));
    return map.tiers.map((t) => ({
      name: t.name,
      price: t.price,
      rows: t.rows.length > 1 ? `${t.rows[0]}–${t.rows[t.rows.length - 1]}` : t.rows[0],
      left: map.seats.filter((s) => s.tier === t.name && (s.status === 'available' || s.status === 'mine')).length,
    }));
  });

  protected readonly similar = computed(() => {
    const e = this.event();
    if (!e) return [];
    return this.store
      .liveEvents()
      .filter((o) => o.id !== e.id)
      .map((o) => ({ o, score: (o.type === e.type ? 2 : 0) + (o.city === e.city ? 1 : 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || Date.parse(a.o.startsAt) - Date.parse(b.o.startsAt))
      .slice(0, 4)
      .map((x) => x.o);
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.notFound.set(false);
    this.seatMap.set(null);
    this.reviews.set(null);
    this.showAllReviews.set(false);
    this.store.markViewed(id);
    try {
      const [event, seats] = await Promise.all([firstValueFrom(this.api.event(id)), firstValueFrom(this.api.seats(id))]);
      this.fetched.set(event);
      this.store.upsertEvent(event);
      this.seatMap.set(seats);
      this.waitlisted.set(!!event.waitlisted);
      this.waitlistCount.set(event.waitlistCount ?? 0);
    } catch {
      if (!this.event()) this.notFound.set(true);
    }
    try {
      this.reviews.set(await firstValueFrom(this.api.reviews(id)));
    } catch {
      // Reviews are optional on this page.
    }
  }

  protected price = inr;
  protected shortDate = shortDate;
  protected initials = initialsOf;

  protected bookSeats(): void {
    const id = this.id();
    if (this.store.selectedEventId() !== id) this.store.selectedSeats.set([]);
    this.store.selectedEventId.set(id);
    this.router.navigate(['/events', id, 'seats']);
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

  protected async toggleWaitlist(): Promise<void> {
    const id = this.id();
    try {
      const res = await firstValueFrom(this.waitlisted() ? this.api.leaveWaitlist(id) : this.api.joinWaitlist(id));
      this.waitlisted.set(res.waitlisted);
      this.waitlistCount.set(res.waitlistCount);
      this.store.waitlist.update((ids) => (res.waitlisted ? [...ids, id] : ids.filter((x) => x !== id)));
      this.store.notify(res.waitlisted ? "You're on the waitlist. We'll notify you." : 'Removed from the waitlist');
    } catch (err) {
      this.store.notify(errorMessage(err));
    }
  }

  protected async share(): Promise<void> {
    const url = `${location.origin}/events/${this.id()}`;
    const title = this.event()?.title ?? 'ScenePass';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Fall back to copying if the share sheet is dismissed or unavailable.
      }
    }
    await navigator.clipboard?.writeText(url);
    this.store.notify('Event link copied');
  }
}
