import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import {
  ChevronRight,
  Clapperboard,
  LayoutDashboard,
  LogOut,
  LucideAngularModule,
  LucideIconData,
  MapPin,
  Sparkles,
  Ticket,
  UserRound,
  Users,
} from 'lucide-angular';
import { AuthService } from '../core/auth.service';
import { CITIES } from '../core/models';
import { StoreService } from '../core/store.service';

interface NavItem {
  path: string;
  label: string;
  mobileLabel: string;
  icon: LucideIconData;
}

const CUSTOMER_NAV: NavItem[] = [
  { path: '/discover', label: 'Discover', mobileLabel: 'Discover', icon: Clapperboard },
  { path: '/room', label: 'Group room', mobileLabel: 'Room', icon: Users },
  { path: '/tickets', label: 'My tickets', mobileLabel: 'Tickets', icon: Ticket },
];
const ADMIN_NAV: NavItem[] = [
  { path: '/studio', label: 'Dashboard', mobileLabel: 'Studio', icon: LayoutDashboard },
];
const PROFILE_NAV: NavItem = { path: '/profile', label: 'Profile', mobileLabel: 'Profile', icon: UserRound };

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, LucideAngularModule],
  template: `
    @if (!store.loaded()) {
      <main class="loading-screen"><span>SCENEPASS</span></main>
    } @else {
      <main class="shell">
        <header class="top">
          <button class="logo" (click)="router.navigateByUrl(home())"><span>S</span>SCENE<em>PASS</em></button>
          <nav>
            @for (item of nav(); track item.path) {
              <button [class.active]="isActive(item.path)" (click)="router.navigateByUrl(item.path)">{{ item.label }}</button>
            }
          </nav>
          <div class="top-actions">
            <div class="city-switcher">
              <button class="location" [attr.aria-expanded]="cityOpen()" (click)="cityOpen.set(!cityOpen())">
                <lucide-icon [img]="icons.MapPin" [size]="15" />{{ store.city() }}<lucide-icon [img]="icons.ChevronRight" [size]="13" />
              </button>
              @if (cityOpen()) {
                <div class="city-menu">
                  @for (option of cities; track option) {
                    <button (click)="chooseCity(option)">{{ option }}</button>
                  }
                </div>
              }
            </div>
            <button class="avatar" aria-label="Open profile" (click)="router.navigateByUrl('/profile')">{{ initials() }}</button>
            <button class="logout" title="Log out" (click)="signOut()"><lucide-icon [img]="icons.LogOut" [size]="17" /></button>
          </div>
        </header>
        <div class="demo-banner">
          <lucide-icon [img]="icons.Sparkles" [size]="14" /> Demo checkout · payments are simulated, no real charges are made
        </div>

        <router-outlet />

        <nav class="mobile-nav">
          @for (item of mobileNav(); track item.path) {
            <button [class.active]="isActive(item.path)" (click)="router.navigateByUrl(item.path)">
              <lucide-icon [img]="item.icon" [size]="18" /><span>{{ item.mobileLabel }}</span>
            </button>
          }
        </nav>
      </main>
    }
  `,
})
export class Shell implements OnInit {
  protected auth = inject(AuthService);
  protected store = inject(StoreService);
  protected router = inject(Router);
  protected readonly icons = { ChevronRight, LogOut, MapPin, Sparkles };
  protected readonly cities = ['All cities', ...CITIES];
  protected readonly cityOpen = signal(false);

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
  protected readonly initials = computed(() => this.auth.user()?.name.slice(0, 2).toUpperCase() ?? '');

  ngOnInit(): void {
    if (!this.store.loaded()) this.store.load();
  }

  protected isActive(path: string): boolean {
    return this.url().startsWith(path);
  }

  protected chooseCity(option: string): void {
    this.store.city.set(option);
    this.cityOpen.set(false);
    if (!this.auth.isAdmin()) this.router.navigateByUrl('/discover');
  }

  protected signOut(): void {
    this.store.signOut();
    this.router.navigateByUrl('/login');
  }
}
