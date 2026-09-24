import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ArrowUp, CircleCheck, CreditCard, LucideAngularModule, Mail, MapPin, QrCode, Send, ShieldCheck, Ticket } from 'lucide-angular';
import { errorMessage } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { StoreService } from '../core/store.service';
import { Logo } from './logo';

const CATEGORIES = ['Music', 'Comedy', 'Theatre', 'Sport', 'Movies', 'Food', 'Dance', 'Art'];

/** Site-wide footer: newsletter signup, navigation columns and legal bar. */
@Component({
  selector: 'app-site-footer',
  imports: [FormsModule, LucideAngularModule, Logo],
  template: `
    <footer class="site-footer2">
      <div class="container">
        @if (!auth.isAdmin()) {
          <section class="newsletter">
            <div>
              <span class="eyebrow"><lucide-icon [img]="icons.Mail" [size]="14" /> Weekly picks</span>
              <h2>The best shows in your inbox, every Friday.</h2>
              <p>New lineups, early-bird drops and member-only promo codes. No spam, unsubscribe any time.</p>
            </div>
            @if (done(); as d) {
              <div class="newsletter-done">
                <lucide-icon [img]="icons.CircleCheck" [size]="22" />
                <div><b>{{ d.message }}</b>
                  @if (d.previewUrl) { <a [href]="d.previewUrl" target="_blank" rel="noopener">View the welcome email</a> }
                </div>
              </div>
            } @else {
              <form class="newsletter-form" (submit)="$event.preventDefault(); subscribe()">
                <input [ngModel]="email()" (ngModelChange)="email.set($event)" name="email" type="email" placeholder="you@example.com" aria-label="Email address" />
                <button class="btn btn-primary" [disabled]="busy()"><lucide-icon [img]="icons.Send" [size]="16" /> {{ busy() ? 'Subscribing…' : 'Subscribe' }}</button>
              </form>
            }
          </section>
        }

        <div class="footer-grid">
          <div class="footer-brand">
            <app-logo />
            <p>Discover live events, pick your exact seat, book with friends and walk in with a QR ticket.</p>
            <ul class="footer-badges">
              <li><lucide-icon [img]="icons.QrCode" [size]="15" /> Scannable QR tickets</li>
              <li><lucide-icon [img]="icons.ShieldCheck" [size]="15" /> Free cancellation up to 2 hrs before</li>
              <li><lucide-icon [img]="icons.CreditCard" [size]="15" /> Demo payments only</li>
            </ul>
          </div>
          @if (auth.isAdmin()) {
            <nav class="footer-col">
              <h4>Studio</h4>
              <button (click)="go('/studio')">Dashboard</button>
              <button (click)="go('/profile')">Profile</button>
            </nav>
          } @else {
            <nav class="footer-col">
              <h4>Explore</h4>
              <button (click)="go('/discover')">Discover events</button>
              <button (click)="go('/venues')">Venues</button>
              <button (click)="go('/rooms')">Group booking</button>
              <button (click)="go('/tickets')">My tickets</button>
              <button (click)="go('/profile')">Saved & profile</button>
            </nav>
            <nav class="footer-col">
              <h4>Categories</h4>
              @for (c of categories; track c) {
                <button (click)="category(c)">{{ c }}</button>
              }
            </nav>
            <nav class="footer-col">
              <h4>Cities</h4>
              @for (c of store.cities(); track c) {
                <button (click)="city(c)"><lucide-icon [img]="icons.MapPin" [size]="13" /> {{ c }} <small>{{ countIn(c) }}</small></button>
              }
            </nav>
          }
          <nav class="footer-col">
            <h4>Help</h4>
            <button (click)="go('/rooms')">How group booking works</button>
            <button (click)="go('/tickets')">Find my QR tickets</button>
            <button (click)="store.paletteOpen.set(true)">Search <kbd>Ctrl K</kbd></button>
            <a href="mailto:support@scenepass.app">support&#64;scenepass.app</a>
          </nav>
        </div>

        <div class="footer-bottom">
          <span>© {{ year }} ScenePass · A demo project built with Angular, Node.js, Express & MongoDB</span>
          <span class="muted">Photos: Unsplash · Payments are simulated</span>
          <button class="to-top-inline" (click)="top()"><lucide-icon [img]="icons.ArrowUp" [size]="15" /> Back to top</button>
        </div>
      </div>
    </footer>
  `,
})
export class SiteFooter {
  protected auth = inject(AuthService);
  protected store = inject(StoreService);
  private router = inject(Router);
  private http = inject(HttpClient);
  protected readonly icons = { ArrowUp, CircleCheck, CreditCard, Mail, MapPin, QrCode, Send, ShieldCheck, Ticket };
  protected readonly categories = CATEGORIES;
  protected readonly year = new Date().getFullYear();
  protected readonly email = signal(this.auth.user()?.email ?? '');
  protected readonly busy = signal(false);
  protected readonly done = signal<{ message: string; previewUrl?: string | null } | null>(null);
  private readonly counts = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.store.liveEvents()) map.set(e.city, (map.get(e.city) ?? 0) + 1);
    return map;
  });
  protected countIn = (city: string) => this.counts().get(city) ?? 0;

  protected go(path: string): void {
    this.router.navigateByUrl(path);
  }

  protected category(label: string): void {
    this.store.category.set(label);
    this.router.navigateByUrl('/discover');
    scrollTo({ top: 0 });
  }

  protected city(city: string): void {
    this.store.city.set(city);
    this.router.navigateByUrl('/discover');
    scrollTo({ top: 0 });
  }

  protected top(): void {
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected async subscribe(): Promise<void> {
    const email = this.email().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.store.notify('Enter a valid email address');
      return;
    }
    this.busy.set(true);
    try {
      this.done.set(await firstValueFrom(this.http.post<{ message: string; previewUrl?: string | null }>('/api/newsletter', { email, city: this.store.city() })));
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
