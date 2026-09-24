import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  BarChart3,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  LayoutDashboard,
  LucideAngularModule,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Star,
  Trash2,
} from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { AdminStats, CheckinResult, EventItem, Order } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { fullDateTime, inr, shortDate, timeOf } from '../../core/format';
import { EventForm, eventToInput } from './event-form';

type Tab = 'Overview' | 'Events' | 'Check-in' | 'Bookings';
type EventFilter = 'Upcoming' | 'Drafts' | 'Past' | 'All';

@Component({
  selector: 'app-studio',
  imports: [FormsModule, LucideAngularModule, EventForm],
  template: `
    <section class="simple-page studio">
      <div class="studio-heading">
        <div>
          <div class="page-kicker"><lucide-icon [img]="icons.LayoutDashboard" /> ORGANIZER STUDIO</div>
          <h1>Organizer overview.</h1>
        </div>
        <button (click)="openForm(null)"><lucide-icon [img]="icons.Plus" [size]="17" /> Create event</button>
      </div>

      <div class="tabs">
        @for (t of tabs; track t) {
          <button [class.active]="tab() === t" (click)="setTab(t)">{{ t }}</button>
        }
        <button class="tab-refresh" title="Refresh data" (click)="refresh()"><lucide-icon [img]="icons.RefreshCw" [size]="15" /></button>
      </div>

      @switch (tab()) {
        @case ('Overview') {
          @if (stats(); as s) {
            <div class="metrics four">
              <article><span>REVENUE</span><b>{{ price(s.revenue) }}</b><em>{{ s.orders }} bookings · {{ price(s.discounts) }} in promos</em></article>
              <article><span>TICKETS SOLD</span><b>{{ s.tickets.toLocaleString('en-IN') }}</b><em>{{ s.cancelled }} bookings cancelled</em></article>
              <article><span>CHECKED IN</span><b>{{ s.checkedIn.toLocaleString('en-IN') }}</b><em>{{ pct(s.checkedIn / (s.tickets || 1)) }} of tickets scanned</em></article>
              <article><span>AVG OCCUPANCY</span><b>{{ pct(s.avgOccupancy) }}</b><em>across {{ s.upcomingEvents }} upcoming events</em></article>
            </div>
            <div class="studio-grid">
              <section>
                <header><h2>Revenue · last 14 days</h2><span>{{ price(sum(s.revenueByDay)) }}</span></header>
                <div class="bars revenue-bars">
                  @for (d of s.revenueByDay; track d.date) {
                    <i [style.height.%]="barHeight(d.revenue)" [title]="d.date + ': ' + price(d.revenue) + ' · ' + d.tickets + ' tickets'">
                      <span>{{ d.date.slice(8) }}</span>
                    </i>
                  }
                </div>
              </section>
              <aside>
                <h2>Sales by category</h2>
                @for (c of s.byCategory; track c.category) {
                  <div class="share-row">
                    <span>{{ c.category }}</span>
                    <i><em [style.width.%]="(c.revenue / (s.revenue || 1)) * 100"></em></i>
                    <b>{{ price(c.revenue) }}</b>
                  </div>
                }
              </aside>
            </div>
            <div class="admin-events">
              <header><div><span>BEST SELLERS</span><h2>Top events by revenue</h2></div></header>
              @for (e of s.topEvents; track e.id) {
                <article>
                  <div><b>{{ e.title }}</b><small>{{ date(e.startsAt) }} · {{ e.city }} · {{ e.tickets }} tickets</small></div>
                  <div class="occupancy"><i><em [style.width.%]="e.occupancy * 100"></em></i><small>{{ pct(e.occupancy) }} full</small></div>
                  <em>{{ price(e.revenue) }}</em>
                </article>
              }
            </div>
          } @else if (statsError()) {
            <div class="empty-state"><h2>Couldn't load analytics</h2><p>{{ statsError() }}</p><button (click)="loadStats()">Try again</button></div>
          } @else {
            <div class="skeleton-block"></div>
          }
        }

        @case ('Events') {
          <div class="studio-toolbar">
            <div class="search">
              <lucide-icon [img]="icons.Search" [size]="16" />
              <input [ngModel]="eventQuery()" (ngModelChange)="eventQuery.set($event)" placeholder="Search events" />
            </div>
            <div class="chips">
              @for (f of eventFilters; track f) {
                <button [class.active]="eventFilter() === f" (click)="eventFilter.set(f)">{{ f }}</button>
              }
            </div>
          </div>
          <div class="admin-events">
            <header><div><span>EVENT INVENTORY</span><h2>{{ eventFilter() }} experiences</h2></div><b>{{ inventory().length }} shown</b></header>
            @for (e of inventory(); track e.id) {
              <article>
                <div>
                  <b>
                    {{ e.title }}
                    @if (e.featured) { <lucide-icon [img]="icons.Star" [size]="13" class="featured-star" /> }
                    @if (e.status === 'draft') { <i class="status-pill draft">Draft</i> }
                  </b>
                  <small>{{ date(e.startsAt) }} · {{ time(e.startsAt) }} · {{ e.venue }}, {{ e.city }}</small>
                </div>
                <div class="occupancy"><i><em [style.width.%]="(e.sold / e.capacity) * 100"></em></i><small>{{ e.sold }}/{{ e.capacity }} sold</small></div>
                <em>from {{ price(e.price) }}</em>
                <button [title]="'Edit ' + e.title" (click)="openForm(e)"><lucide-icon [img]="icons.Pencil" [size]="16" /></button>
                <button [title]="(e.status === 'draft' ? 'Publish ' : 'Unpublish ') + e.title" (click)="togglePublish(e)">
                  <lucide-icon [img]="e.status === 'draft' ? icons.Eye : icons.EyeOff" [size]="16" />
                </button>
                <button [title]="'Delete ' + e.title" (click)="removeEvent(e)"><lucide-icon [img]="icons.Trash2" [size]="16" /></button>
              </article>
            } @empty {
              <p class="muted-note">No events match.</p>
            }
          </div>
        }

        @case ('Check-in') {
          <div class="checkin-layout">
            <section class="checkin-card">
              <lucide-icon [img]="icons.ScanLine" [size]="30" />
              <h2>Door check-in</h2>
              <p>Type or scan the code printed under a ticket's QR code.</p>
              <div class="checkin-input">
                <input
                  [ngModel]="code()"
                  (ngModelChange)="code.set($event.toUpperCase())"
                  (keydown.enter)="checkIn()"
                  placeholder="TK-XXXXXXXX"
                  aria-label="Ticket code"
                  autocomplete="off"
                />
                <button [disabled]="!code().trim() || checking()" (click)="checkIn()">Verify</button>
              </div>
              @if (checkResult(); as r) {
                <div class="checkin-result" [class]="'checkin-result ' + r.tone">
                  <lucide-icon [img]="r.tone === 'ok' ? icons.CircleCheck : icons.CircleAlert" [size]="22" />
                  <div>
                    <b>{{ r.title }}</b>
                    @if (r.ticket; as t) {
                      <small>{{ t.holder }} · {{ t.event }} · Seat {{ t.seat }} ({{ t.tier }})</small>
                      <small>{{ r.tone === 'ok' ? 'Admitted' : 'First scanned' }} {{ full(t.checkedInAt) }}</small>
                    }
                  </div>
                </div>
              }
            </section>
            <aside class="checkin-log">
              <h2>This session</h2>
              @for (entry of checkLog(); track $index) {
                <div><span [class]="entry.tone">{{ entry.tone === 'ok' ? '✓' : '!' }}</span><b>{{ entry.code }}</b><small>{{ entry.title }}</small></div>
              } @empty {
                <p class="muted-note">Scanned tickets will appear here.</p>
              }
            </aside>
          </div>
        }

        @case ('Bookings') {
          <div class="admin-events bookings-table">
            <header><div><span>RECENT ACTIVITY</span><h2>Latest bookings</h2></div><b>{{ store.orders().length }} loaded</b></header>
            @for (o of store.orders().slice(0, 60); track o.id) {
              <article>
                <div>
                  <b>{{ customer(o) }}</b>
                  <small>{{ o.event.title }} · {{ o.seats.join(', ') }}</small>
                </div>
                <small class="booking-when">{{ full(o.createdAt) }}</small>
                @if (o.status === 'cancelled') {
                  <i class="status-pill cancelled">Cancelled</i>
                } @else if (o.promoCode) {
                  <i class="status-pill promo">{{ o.promoCode }}</i>
                }
                <em>{{ price(o.total) }}</em>
              </article>
            }
          </div>
        }
      }
    </section>

    @if (showForm()) {
      <app-event-form [event]="editing()" (saved)="onSaved($event)" (closed)="showForm.set(false)" />
    }
  `,
})
export class StudioPage implements OnInit {
  protected store = inject(StoreService);
  private api = inject(ApiService);
  protected router = inject(Router);
  protected readonly icons = {
    BarChart3, CircleAlert, CircleCheck, Eye, EyeOff, LayoutDashboard, Pencil, Plus, RefreshCw, ScanLine, Search, Star, Trash2,
  };
  protected readonly tabs: Tab[] = ['Overview', 'Events', 'Check-in', 'Bookings'];
  protected readonly eventFilters: EventFilter[] = ['Upcoming', 'Drafts', 'Past', 'All'];
  protected readonly tab = signal<Tab>('Overview');

  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly statsError = signal('');
  protected readonly eventFilter = signal<EventFilter>('Upcoming');
  protected readonly eventQuery = signal('');
  protected readonly showForm = signal(false);
  protected readonly editing = signal<EventItem | null>(null);

  protected readonly code = signal('');
  protected readonly checking = signal(false);
  protected readonly checkResult = signal<{ tone: 'ok' | 'warn' | 'error'; title: string; ticket?: CheckinResult['ticket'] } | null>(null);
  protected readonly checkLog = signal<{ tone: 'ok' | 'warn' | 'error'; code: string; title: string }[]>([]);

  protected readonly inventory = computed(() => {
    const now = Date.now();
    const q = this.eventQuery().trim().toLowerCase();
    const filter = this.eventFilter();
    return this.store
      .events()
      .filter((e) => {
        const past = Date.parse(e.endsAt) <= now;
        const match =
          filter === 'All' ||
          (filter === 'Drafts' && e.status === 'draft') ||
          (filter === 'Past' && past) ||
          (filter === 'Upcoming' && !past && e.status === 'published');
        return match && (!q || `${e.title} ${e.venue} ${e.city}`.toLowerCase().includes(q));
      })
      .sort((a, b) => (filter === 'Past' ? -1 : 1) * (Date.parse(a.startsAt) - Date.parse(b.startsAt)));
  });

  private readonly maxDaily = computed(() => Math.max(1, ...(this.stats()?.revenueByDay ?? []).map((d) => d.revenue)));

  ngOnInit(): void {
    this.loadStats();
  }

  protected price = inr;
  protected date = shortDate;
  protected time = timeOf;
  protected full = fullDateTime;
  protected pct = (n: number) => `${Math.round(n * 100)}%`;
  protected sum = (days: { revenue: number }[]) => days.reduce((s, d) => s + d.revenue, 0);
  protected barHeight = (revenue: number) => Math.max(3, (revenue / this.maxDaily()) * 100);
  protected customer = (o: Order) => (typeof o.user === 'object' && o.user ? o.user.name : 'Customer');

  protected setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'Overview') this.loadStats();
  }

  async loadStats(): Promise<void> {
    this.statsError.set('');
    try {
      this.stats.set(await firstValueFrom(this.api.stats()));
    } catch (err) {
      this.statsError.set(errorMessage(err));
    }
  }

  protected async refresh(): Promise<void> {
    await Promise.all([this.store.load(), this.loadStats()]);
    this.store.notify('Studio data refreshed');
  }

  protected openForm(event: EventItem | null): void {
    this.editing.set(event);
    this.showForm.set(true);
  }

  protected onSaved(event: EventItem): void {
    const isNew = !this.editing();
    this.store.upsertEvent(event);
    this.showForm.set(false);
    this.store.notify(isNew ? (event.status === 'draft' ? 'Draft saved' : 'Event published to Discover') : 'Event updated');
    this.loadStats();
  }

  protected async togglePublish(event: EventItem): Promise<void> {
    const status = event.status === 'draft' ? 'published' : 'draft';
    try {
      const updated = await firstValueFrom(this.api.updateEvent(event.id, { ...eventToInput(event), status }));
      this.store.upsertEvent(updated);
      this.store.notify(status === 'draft' ? 'Event unpublished' : 'Event published');
    } catch (err) {
      this.store.notify(errorMessage(err));
    }
  }

  protected async removeEvent(event: EventItem): Promise<void> {
    if (!confirm(`Delete "${event.title}" permanently?`)) return;
    try {
      await firstValueFrom(this.api.deleteEvent(event.id));
      this.store.events.update((events) => events.filter((e) => e.id !== event.id));
      this.store.notify('Event deleted');
      this.loadStats();
    } catch (err) {
      this.store.notify(errorMessage(err));
    }
  }

  protected async checkIn(): Promise<void> {
    const code = this.code().trim();
    if (!code) return;
    this.checking.set(true);
    try {
      const res = await firstValueFrom(this.api.checkin(code));
      this.recordCheck({ tone: 'ok', title: `Welcome, ${res.ticket.holder}!`, ticket: res.ticket }, code);
      this.code.set('');
    } catch (err: any) {
      const ticket = err?.error?.ticket as CheckinResult['ticket'] | undefined;
      this.recordCheck({ tone: ticket ? 'warn' : 'error', title: errorMessage(err), ticket }, code);
    } finally {
      this.checking.set(false);
    }
  }

  private recordCheck(result: { tone: 'ok' | 'warn' | 'error'; title: string; ticket?: CheckinResult['ticket'] }, code: string): void {
    this.checkResult.set(result);
    this.checkLog.update((log) => [{ tone: result.tone, code, title: result.title }, ...log].slice(0, 12));
  }
}
