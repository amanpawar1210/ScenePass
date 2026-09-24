import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  CalendarDays,
  CircleCheck,
  CreditCard,
  LucideAngularModule,
  QrCode,
  Quote,
  ShieldCheck,
  Star,
  Ticket,
  UserRound,
  Users,
  Zap,
} from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EventItem, Review, Role } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { initialsOf, posterStyle, shortDate, timeAgo } from '../../core/format';
import { Logo } from '../../shared/logo';
import { CountUp } from '../../shared/count-up';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Seeded demo shopper with real bookings, and a demo organizer account.
const DEMO = {
  customer: { name: 'Aman Pawar', email: 'aman@scenepass.demo' },
  admin: { name: 'Studio Demo', email: 'organizer@scenepass.demo' },
} as const;

interface Activity {
  name: string;
  city: string;
  event: string;
  seats: number;
  at: string;
}

@Component({
  selector: 'app-login',
  imports: [FormsModule, LucideAngularModule, Logo, CountUp],
  template: `
    <main class="auth2">
      <!-- Showcase -->
      <section class="auth-show">
        <span class="blob b1"></span><span class="blob b2"></span>
        <div class="auth-show-top">
          <app-logo />
          <span class="chip chip-live-soft"><i class="pulse-dot"></i> {{ events().length || 30 }}+ events live now</span>
        </div>

        <div class="auth-show-copy">
          <h1>Your next great night out <span class="hl">starts here.</span></h1>
          <p>Concerts, comedy, theatre and sport across {{ cityCount() }} cities. Pick your exact seat, book with friends and walk in with a QR ticket.</p>
          <div class="auth-kpis">
            <div><b [appCountUp]="events().length || 36"></b><small>live events</small></div>
            <div><b [appCountUp]="venueCount()"></b><small>venues</small></div>
            <div><b [appCountUp]="ticketsSold()"></b><small>tickets booked</small></div>
          </div>
        </div>

        <div class="photo-columns" aria-hidden="true">
          @for (col of columns(); track $index; let c = $index) {
            <div class="photo-col" [class.reverse]="c === 1" [style.--dur]="36 + c * 8 + 's'">
              <div class="photo-track">
                @for (e of col; track $index) {
                  <div class="photo-card">
                    <span class="photo-img art-wide" [class.custom-img]="!!e.imageUrl" [style]="poster(e)"></span>
                    <span class="photo-meta"><b>{{ e.title }}</b><small>{{ date(e) }} · {{ e.city }}</small></span>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <div class="auth-show-foot">
          @if (review(); as r) {
            @for (x of [r]; track x.id) {
              <figure class="quote-card fade-in">
                <lucide-icon [img]="icons.Quote" [size]="22" />
                <blockquote>{{ x.comment }}</blockquote>
                <figcaption>
                  <span class="avatar-sm">{{ initials(x.userName) }}</span>
                  <span><b>{{ x.userName }}</b><small>{{ x.eventTitle ? 'Attended ' + x.eventTitle : x.venue }}</small></span>
                  <span class="quote-stars">
                    @for (s of [1, 2, 3, 4, 5]; track s) {
                      <lucide-icon [img]="icons.Star" [size]="14" [class.dim]="s > x.rating" />
                    }
                  </span>
                </figcaption>
              </figure>
            }
          }
          @if (activity(); as a) {
            @for (x of [a]; track x.at + x.name) {
              <div class="live-line slide-up">
                <lucide-icon [img]="icons.Zap" [size]="14" />
                <span><b>{{ x.name }}</b> from {{ x.city }} booked {{ x.seats }} {{ x.seats === 1 ? 'seat' : 'seats' }} for <b>{{ x.event }}</b> · {{ ago(x.at) }}</span>
              </div>
            }
          }
        </div>
      </section>

      <!-- Sign-in -->
      <section class="auth-side">
        <div class="auth-box">
          <span class="logo-mark lg"><lucide-icon [img]="icons.Ticket" [size]="24" /></span>
          <h2>Welcome to ScenePass</h2>
          <p class="muted">Sign in or create your account in one step. No password needed.</p>

          <div class="segmented" role="tablist">
            <button role="tab" [class.active]="role() === 'customer'" (click)="role.set('customer')">
              <lucide-icon [img]="icons.Ticket" [size]="17" /> I'm booking
            </button>
            <button role="tab" [class.active]="role() === 'admin'" (click)="role.set('admin')">
              <lucide-icon [img]="icons.ShieldCheck" [size]="17" /> I'm an organizer
            </button>
          </div>

          <form (submit)="$event.preventDefault(); signIn()">
            <label class="field">
              <span>Email address</span>
              <div class="input-icon" [class.valid]="emailValid()" [class.invalid]="touched() && !emailValid()">
                <lucide-icon [img]="icons.AtSign" [size]="17" />
                <input
                  [ngModel]="email()"
                  (ngModelChange)="email.set($event)"
                  (blur)="touched.set(true)"
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                  autocomplete="email"
                  autofocus
                />
                @if (emailValid()) {
                  <lucide-icon class="ok-icon" [img]="icons.CircleCheck" [size]="18" />
                }
              </div>
              @if (touched() && email() && !emailValid()) {
                <small class="field-error">That doesn't look like an email address</small>
              }
            </label>
            <label class="field">
              <span>Your name <em class="muted">(for tickets)</em></span>
              <div class="input-icon" [class.valid]="name().trim().length > 1">
                <lucide-icon [img]="icons.UserRound" [size]="17" />
                <input [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" placeholder="Aman Pawar" autocomplete="name" />
              </div>
            </label>
            <button type="submit" class="btn btn-primary btn-lg block" [disabled]="busy()">
              @if (busy()) {
                <span class="btn-spinner"></span> Signing in…
              } @else {
                {{ role() === 'admin' ? 'Open organizer studio' : 'Continue' }} <lucide-icon [img]="icons.ArrowRight" [size]="18" />
              }
            </button>
          </form>

          <div class="divider"><span>or explore with a demo account</span></div>
          <div class="demo-cards">
            <button class="demo-card" [disabled]="busy()" (click)="demo('customer')">
              <span class="avatar-sm big" data-tone="0">AP</span>
              <span class="grow"><b>Aman Pawar</b><small>Customer · tickets, saved events & waitlist</small></span>
              <lucide-icon [img]="icons.ArrowRight" [size]="16" />
            </button>
            <button class="demo-card" [disabled]="busy()" (click)="demo('admin')">
              <span class="avatar-sm big" data-tone="1">SD</span>
              <span class="grow"><b>Studio Demo</b><small>Organizer · analytics & QR check-in</small></span>
              <lucide-icon [img]="icons.ArrowRight" [size]="16" />
            </button>
          </div>

          <ul class="trust-row">
            <li><lucide-icon [img]="icons.BadgeCheck" [size]="16" /> Passwordless demo sign-in</li>
            <li><lucide-icon [img]="icons.CreditCard" [size]="16" /> Dummy payments, no real charges</li>
            <li><lucide-icon [img]="icons.QrCode" [size]="16" /> Scannable QR tickets</li>
          </ul>
        </div>
        <small class="auth-legal">By continuing you agree this is a demo app for learning purposes.</small>
      </section>
    </main>
  `,
})
export class LoginPage implements OnInit {
  private auth = inject(AuthService);
  private store = inject(StoreService);
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private router = inject(Router);
  protected readonly icons = {
    ArrowRight, AtSign, BadgeCheck, CalendarDays, CircleCheck, CreditCard, QrCode, Quote, ShieldCheck, Star, Ticket, UserRound, Users, Zap,
  };
  protected readonly role = signal<Role>('customer');
  protected readonly busy = signal(false);
  protected readonly events = signal<EventItem[]>([]);
  protected readonly email = signal('');
  protected readonly name = signal('');
  protected readonly touched = signal(false);
  private readonly reviews = signal<Review[]>([]);
  private readonly activities = signal<Activity[]>([]);
  private readonly tick = signal(0);

  protected readonly emailValid = computed(() => EMAIL_RE.test(this.email().trim()));
  protected readonly cityCount = computed(() => new Set(this.events().map((e) => e.city)).size || 6);
  protected readonly venueCount = computed(() => new Set(this.events().map((e) => e.venue)).size || 28);
  protected readonly ticketsSold = computed(() => this.events().reduce((n, e) => n + e.sold, 0) || 1200);

  /** Three columns of event photos for the scrolling showcase (duplicated for a seamless loop). */
  protected readonly columns = computed(() => {
    const withPhotos = this.events().filter((e) => e.imageUrl);
    const cols: EventItem[][] = [[], [], []];
    withPhotos.slice(0, 18).forEach((e, i) => cols[i % 3].push(e));
    return cols.map((c) => [...c, ...c]);
  });
  protected readonly review = computed(() => {
    const list = this.reviews().filter((r) => r.comment && r.rating >= 4);
    return list.length ? list[this.tick() % list.length] : null;
  });
  protected readonly activity = computed(() => {
    const list = this.activities();
    return list.length ? list[this.tick() % list.length] : null;
  });

  protected poster = (e: EventItem) => posterStyle(e, 360);
  protected date = (e: EventItem) => shortDate(e.startsAt);
  protected initials = initialsOf;
  protected ago = (iso: string) => timeAgo(iso);

  constructor() {
    const timer = setInterval(() => this.tick.update((t) => t + 1), 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  async ngOnInit(): Promise<void> {
    // The showcase is decorative; sign-in works even if these fail.
    try {
      const events = await firstValueFrom(this.api.events());
      this.events.set(events);
      const top = events.filter((e) => e.rating.count).sort((a, b) => b.rating.avg - a.rating.avg).slice(0, 3);
      const summaries = await Promise.all(top.map((e) => firstValueFrom(this.api.reviews(e.id)).catch(() => null)));
      this.reviews.set(summaries.flatMap((s) => s?.reviews ?? []));
    } catch {}
    try {
      this.activities.set(await firstValueFrom(this.http.get<Activity[]>('/api/activity')));
    } catch {}
  }

  protected demo(role: Role): void {
    this.role.set(role);
    this.name.set(DEMO[role].name);
    this.email.set(DEMO[role].email);
    this.signIn();
  }

  protected async signIn(): Promise<void> {
    this.touched.set(true);
    if (!this.emailValid()) {
      this.store.notify('Enter a valid email address');
      return;
    }
    this.busy.set(true);
    try {
      const user = await this.auth.signIn(this.name().trim(), this.email().trim(), this.role());
      this.store.reset();
      const redirect = sessionStorage.getItem('scenepass_redirect');
      sessionStorage.removeItem('scenepass_redirect');
      this.router.navigateByUrl(redirect ?? (user.role === 'admin' ? '/studio' : '/discover'));
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
