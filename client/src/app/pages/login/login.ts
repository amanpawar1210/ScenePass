import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ArrowRight,
  AtSign,
  BellRing,
  CalendarDays,
  CircleCheck,
  LucideAngularModule,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
} from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EventItem, Role } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { dayParts, inr, posterStyle } from '../../core/format';
import { Logo } from '../../shared/logo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Seeded demo shopper with real bookings, and a demo organizer account.
const DEMO = {
  customer: { name: 'Nina Kapoor', email: 'nina@scenepass.demo' },
  admin: { name: 'Studio Demo', email: 'organizer@scenepass.demo' },
} as const;

@Component({
  selector: 'app-login',
  imports: [FormsModule, LucideAngularModule, Logo],
  template: `
    <main class="auth">
      <section class="auth-intro">
        <app-logo />
        <div class="auth-copy">
          <span class="chip chip-brand"><lucide-icon [img]="icons.CircleCheck" [size]="14" /> {{ events().length || 30 }}+ events this month</span>
          <h1>Book live events you'll actually remember.</h1>
          <p>Concerts, comedy, theatre and sport across {{ cityCount() }} cities. Pick your exact seat, book with friends and keep every ticket on your phone.</p>
          <ul class="auth-points">
            <li><lucide-icon [img]="icons.Ticket" [size]="18" /> Choose exact seats on a live seat map</li>
            <li><lucide-icon [img]="icons.Users" [size]="18" /> Group rooms to pick seats together</li>
            <li><lucide-icon [img]="icons.BellRing" [size]="18" /> Waitlists that alert you when seats free up</li>
          </ul>
        </div>
        <div class="poster-stack">
          @for (e of showcase(); track e.id; let i = $index) {
            <article class="mini-event" [style.--i]="i">
              <div class="mini-art art-square" [class.custom-img]="!!e.imageUrl" [style]="poster(e)"></div>
              <div>
                <small>{{ parts(e).weekday }}, {{ parts(e).day }} {{ parts(e).month }} · {{ e.city }}</small>
                <b>{{ e.title }}</b>
                <span>from {{ price(e.price) }}</span>
              </div>
            </article>
          }
        </div>
      </section>

      <section class="auth-panel">
        <div class="auth-card">
          <h2>Welcome</h2>
          <p class="muted">Sign in or create an account in one step.</p>

          <div class="segmented" role="tablist">
            <button role="tab" [class.active]="role() === 'customer'" (click)="role.set('customer')">
              <lucide-icon [img]="icons.Ticket" [size]="17" /> I'm booking
            </button>
            <button role="tab" [class.active]="role() === 'admin'" (click)="role.set('admin')">
              <lucide-icon [img]="icons.ShieldCheck" [size]="17" /> I'm an organizer
            </button>
          </div>

          <label class="field">
            <span>Full name</span>
            <div class="input-icon"><lucide-icon [img]="icons.UserRound" [size]="17" /><input [(ngModel)]="name" placeholder="Aditya Sharma" autocomplete="name" /></div>
          </label>
          <label class="field">
            <span>Email address</span>
            <div class="input-icon">
              <lucide-icon [img]="icons.AtSign" [size]="17" />
              <input [(ngModel)]="email" (keydown.enter)="signIn()" placeholder="you@example.com" type="email" autocomplete="email" />
            </div>
          </label>

          <button class="btn btn-primary btn-lg block" [disabled]="busy()" (click)="signIn()">
            {{ busy() ? 'Signing in…' : 'Continue' }} <lucide-icon [img]="icons.ArrowRight" [size]="18" />
          </button>

          <div class="divider"><span>or try a demo account</span></div>
          <div class="demo-row">
            <button class="demo-tile" [disabled]="busy()" (click)="demo('customer')">
              <span class="demo-icon"><lucide-icon [img]="icons.Users" [size]="18" /></span>
              <span><b>Demo customer</b><small>Has tickets & saved events</small></span>
            </button>
            <button class="demo-tile" [disabled]="busy()" (click)="demo('admin')">
              <span class="demo-icon"><lucide-icon [img]="icons.CalendarDays" [size]="18" /></span>
              <span><b>Demo organizer</b><small>Analytics & check-in</small></span>
            </button>
          </div>
          <small class="fine-print">Demo sign-in, no password needed. Payments are simulated.</small>
        </div>
      </section>
    </main>
  `,
})
export class LoginPage implements OnInit {
  private auth = inject(AuthService);
  private store = inject(StoreService);
  private api = inject(ApiService);
  private router = inject(Router);
  protected readonly icons = { ArrowRight, AtSign, BellRing, CalendarDays, CircleCheck, ShieldCheck, Ticket, UserRound, Users };
  protected readonly role = signal<Role>('customer');
  protected readonly busy = signal(false);
  protected readonly events = signal<EventItem[]>([]);
  protected name = '';
  protected email = '';

  protected readonly showcase = computed(() => {
    const list = this.events();
    const featured = list.filter((e) => e.featured);
    return (featured.length >= 3 ? featured : list).slice(0, 3);
  });
  protected readonly cityCount = computed(() => new Set(this.events().map((e) => e.city)).size || 6);

  protected poster = posterStyle;
  protected parts = (e: EventItem) => dayParts(e.startsAt);
  protected price = inr;

  async ngOnInit(): Promise<void> {
    try {
      this.events.set(await firstValueFrom(this.api.events()));
    } catch {
      // The showcase is decorative; sign-in still works without it.
    }
  }

  protected demo(role: Role): void {
    this.role.set(role);
    this.name = DEMO[role].name;
    this.email = DEMO[role].email;
    this.signIn();
  }

  protected async signIn(): Promise<void> {
    if (!EMAIL_RE.test(this.email.trim())) {
      this.store.notify('Enter a valid email address');
      return;
    }
    this.busy.set(true);
    try {
      const user = await this.auth.signIn(this.name.trim(), this.email.trim(), this.role());
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
