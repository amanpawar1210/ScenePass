import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule, Zap } from 'lucide-angular';
import { timeAgo } from '../core/format';

interface Activity {
  name: string;
  city: string;
  event: string;
  eventId: string;
  seats: number;
  at: string;
}

/** Rotating "X just booked Y" feed built from real recent bookings. */
@Component({
  selector: 'app-activity-ticker',
  imports: [LucideAngularModule],
  template: `
    @if (current(); as a) {
      <div class="ticker">
        <span class="ticker-live"><i class="pulse-dot"></i> Live</span>
        @for (item of [a]; track item.at + item.name) {
          <button class="ticker-text slide-up" (click)="router.navigate(['/events', a.eventId])">
            <lucide-icon [img]="Zap" [size]="15" />
            <b>{{ a.name }}</b>&nbsp;from {{ a.city }} booked {{ a.seats }} {{ a.seats === 1 ? 'seat' : 'seats' }} for&nbsp;<b>{{ a.event }}</b>
            <small>&nbsp;· {{ ago(a.at) }}</small>
          </button>
        }
      </div>
    }
  `,
})
export class ActivityTicker {
  private http = inject(HttpClient);
  protected router = inject(Router);
  protected readonly Zap = Zap;
  private readonly items = signal<Activity[]>([]);
  private readonly index = signal(0);
  protected readonly current = computed(() => {
    const list = this.items();
    return list.length ? list[this.index() % list.length] : null;
  });
  protected ago = (iso: string) => timeAgo(iso);

  constructor() {
    this.load();
    const rotate = setInterval(() => this.index.update((i) => i + 1), 4500);
    const refresh = setInterval(() => this.load(), 60_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(rotate);
      clearInterval(refresh);
    });
  }

  private async load(): Promise<void> {
    try {
      this.items.set(await firstValueFrom(this.http.get<Activity[]>('/api/activity')));
    } catch {
      // Decorative; ignore failures.
    }
  }
}
