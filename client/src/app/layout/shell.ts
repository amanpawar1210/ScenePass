import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import {
  Building2,
  ChevronDown,
  Compass,
  LayoutDashboard,
  LogOut,
  LucideAngularModule,
  LucideIconData,
  MapPin,
  Ticket,
  UserRound,
  Users,
} from 'lucide-angular';
import { AuthService } from '../core/auth.service';
import { StoreService } from '../core/store.service';
import { Logo } from '../shared/logo';
import { NotificationBell } from '../shared/notification-bell';

interface NavItem {
  path: string;
  label: string;
  mobileLabel: string;
  icon: LucideIconData;
  /** Other URL prefixes that should highlight this item. */
  also?: string[];
}

const CUSTOMER_NAV: NavItem[] = [
  { path: '/discover', label: 'Discover', mobileLabel: 'Discover', icon: Compass, also: ['/events'] },
  { path: '/venues', label: 'Venues', mobileLabel: 'Venues', icon: Building2 },
  { path: '/rooms', label: 'Group booking', mobileLabel: 'Groups', icon: Users },
  { path: '/tickets', label: 'My tickets', mobileLabel: 'Tickets', icon: Ticket },
];
const ADMIN_NAV: NavItem[] = [
  { path: '/studio', label: 'Dashboard', mobileLabel: 'Studio', icon: LayoutDashboard },
];
const PROFILE_NAV: NavItem = { path: '/profile', label: 'Profile', mobileLabel: 'Profile', icon: UserRound };

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, LucideAngularModule, Logo, NotificationBell],
  template: `
    @if (store.loadError(); as error) {
      <main class="state-screen">
        <app-logo size="lg" [showName]="false" />
        <h1>We couldn't load ScenePass</h1>
        <p class="muted">{{ error }}. Check that the API server is running, then try again.</p>
        <div class="row-gap">
          <button class="btn btn-primary" (click)="store.load()">Try again</button>
          <button class="btn btn-outline" (click)="signOut()">Sign out</button>
        </div>
      </main>
    } @else if (!store.loaded()) {
      <main class="state-screen">
        <div class="spinner"></div>
        <p class="muted">Loading events near you…</p>
      </main>
    } @else {
      <div class="shell">
        <header class="topbar">
          <div class="container topbar-inner">
            <button class="brand-btn" (click)="router.navigateByUrl(home())" aria-label="ScenePass home"><app-logo /></button>
            <nav class="top-nav">
              @for (item of nav(); track item.path) {
                <button [class.active]="isActive(item)" (click)="router.navigateByUrl(item.path)">
                  <lucide-icon [img]="item.icon" [size]="17" />{{ item.label }}
                </button>
              }
            </nav>
            <div class="top-actions">
              <div class="menu-wrap">
                <button class="select-btn" [attr.aria-expanded]="cityOpen()" (click)="cityOpen.set(!cityOpen()); userOpen.set(false)">
                  <lucide-icon [img]="icons.MapPin" [size]="16" /><span>{{ store.city() }}</span><lucide-icon [img]="icons.ChevronDown" [size]="15" />
                </button>
                @if (cityOpen()) {
                  <div class="dropdown">
                    @for (option of cities(); track option) {
                      <button class="dropdown-item" [class.active]="store.city() === option" (click)="chooseCity(option)">{{ option }}</button>
                    }
                  </div>
                }
              </div>
              <app-notification-bell />
              <div class="menu-wrap">
                <button class="avatar" [attr.aria-expanded]="userOpen()" aria-label="Account menu" (click)="userOpen.set(!userOpen()); cityOpen.set(false)">
                  {{ initials() }}
                </button>
                @if (userOpen()) {
                  <div class="dropdown user-menu">
                    <div class="dropdown-head">
                      <b>{{ auth.user()?.name }}</b>
                      <small>{{ auth.user()?.email }}</small>
                    </div>
                    <button class="dropdown-item" (click)="go('/profile')"><lucide-icon [img]="icons.UserRound" [size]="16" /> Profile</button>
                    @if (!auth.isAdmin()) {
                      <button class="dropdown-item" (click)="go('/tickets')"><lucide-icon [img]="icons.Ticket" [size]="16" /> My tickets</button>
                    }
                    <button class="dropdown-item danger" (click)="signOut()"><lucide-icon [img]="icons.LogOut" [size]="16" /> Log out</button>
                  </div>
                }
              </div>
            </div>
          </div>
        </header>

        <main class="main" (click)="closeMenus()">
          <router-outlet />
        </main>

        <footer class="site-footer">
          <div class="container footer-inner">
            <app-logo />
            <span class="muted">Live seat availability across {{ store.cities().length }} cities · payments are simulated in this demo</span>
          </div>
        </footer>

        <nav class="mobile-nav">
          @for (item of mobileNav(); track item.path) {
            <button [class.active]="isActive(item)" (click)="router.navigateByUrl(item.path)">
              <lucide-icon [img]="item.icon" [size]="20" /><span>{{ item.mobileLabel }}</span>
            </button>
          }
        </nav>
      </div>
    }
  `,
})
export class Shell implements OnInit {
  protected auth = inject(AuthService);
  protected store = inject(StoreService);
  protected router = inject(Router);
  protected readonly icons = { ChevronDown, LogOut, MapPin, Ticket, UserRound };
  protected readonly cities = computed(() => ['All cities', ...this.store.cities()]);
  protected readonly cityOpen = signal(false);
  protected readonly userOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly nav = computed(() => (this.auth.isAdmin() ? ADMIN_NAV : CUSTOMER_NAV));
  protected readonly mobileNav = computed(() => [...this.nav(), PROFILE_NAV]);
  protected readonly home = computed(() => (this.auth.isAdmin() ? '/studio' : '/discover'));
  protected readonly initials = computed(() =>
    (this.auth.user()?.name ?? '')
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );

  ngOnInit(): void {
    if (!this.store.loaded()) this.store.load();
  }

  protected isActive(item: NavItem): boolean {
    const url = this.url();
    return [item.path, ...(item.also ?? [])].some((p) => url.startsWith(p));
  }

  protected closeMenus(): void {
    this.cityOpen.set(false);
    this.userOpen.set(false);
  }

  protected go(path: string): void {
    this.closeMenus();
    this.router.navigateByUrl(path);
  }

  protected chooseCity(option: string): void {
    this.store.city.set(option);
    this.cityOpen.set(false);
    if (!this.auth.isAdmin() && !this.url().startsWith('/venues')) this.router.navigateByUrl('/discover');
  }

  protected signOut(): void {
    this.closeMenus();
    this.store.signOut();
    this.router.navigateByUrl('/login');
  }
}
