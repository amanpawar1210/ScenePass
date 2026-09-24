import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Bell, BellRing, CalendarClock, LucideAngularModule, LucideIconData, Ticket, Users, XCircle } from 'lucide-angular';
import { ApiService } from '../core/api.service';
import { AppNotification } from '../core/models';

const POLL_MS = 30_000;
const ICONS: Record<AppNotification['type'], LucideIconData> = {
  booking: Ticket,
  cancelled: XCircle,
  waitlist: BellRing,
  room: Users,
  reminder: CalendarClock,
  review: Ticket,
};

/** Bell with unread count and a dropdown of recent notifications; polls every 30s. */
@Component({
  selector: 'app-notification-bell',
  imports: [LucideAngularModule],
  host: { class: 'bell-wrap' },
  template: `
    <button class="icon-btn-round" [class.active]="open()" aria-label="Notifications" (click)="toggle()">
      <lucide-icon [img]="Bell" [size]="18" />
      @if (unread()) {
        <i class="badge-dot">{{ unread() > 9 ? '9+' : unread() }}</i>
      }
    </button>
    @if (open()) {
      <div class="dropdown notif-panel">
        <header>
          <b>Notifications</b>
          @if (unread()) {
            <button (click)="readAll()">Mark all read</button>
          }
        </header>
        @for (n of items(); track n.id) {
          <button class="notif" [class.unread]="!n.read" (click)="openItem(n)">
            <span [class]="'notif-icon ' + n.type"><lucide-icon [img]="icon(n)" [size]="16" /></span>
            <span class="notif-text">
              <b>{{ n.title }}</b>
              @if (n.body) {
                <small>{{ n.body }}</small>
              }
              <em>{{ ago(n.createdAt) }}</em>
            </span>
          </button>
        } @empty {
          <p class="empty-note">You're all caught up.</p>
        }
      </div>
    }
  `,
})
export class NotificationBell {
  private api = inject(ApiService);
  private router = inject(Router);
  protected readonly Bell = Bell;
  protected readonly open = signal(false);
  protected readonly items = signal<AppNotification[]>([]);
  protected readonly unread = signal(0);

  constructor() {
    this.load();
    const timer = setInterval(() => this.load(), POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private async load(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.notifications());
      this.items.set(res.items);
      this.unread.set(res.unread);
    } catch {
      // Notifications are non-critical; try again on the next poll.
    }
  }

  protected toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) this.load();
  }

  protected async readAll(): Promise<void> {
    await firstValueFrom(this.api.readAllNotifications());
    this.items.update((items) => items.map((n) => ({ ...n, read: true })));
    this.unread.set(0);
  }

  protected async openItem(n: AppNotification): Promise<void> {
    this.open.set(false);
    if (!n.read) {
      this.items.update((items) => items.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      this.unread.update((u) => Math.max(0, u - 1));
      firstValueFrom(this.api.readNotification(n.id)).catch(() => {});
    }
    if (n.link) this.router.navigateByUrl(n.link);
  }

  protected icon = (n: AppNotification) => ICONS[n.type] ?? Bell;

  protected ago(iso: string): string {
    const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}
