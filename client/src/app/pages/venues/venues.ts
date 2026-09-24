import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Building2, CalendarDays, LucideAngularModule, MapPin, Search, Star } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { Venue } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { categoryLabel, posterStyle, shortDate } from '../../core/format';

type VenueSort = 'Most events' | 'Top rated' | 'A–Z';

@Component({
  selector: 'app-venues',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="container page">
      <header class="page-head">
        <div>
          <small class="eyebrow">Venues</small>
          <h1>Explore venues</h1>
          <p class="lead">Arenas, theatres, clubs and open-air lawns, with ratings from people who've been.</p>
        </div>
      </header>

      <section class="toolbar">
        <div class="search-field grow">
          <lucide-icon [img]="icons.Search" [size]="18" />
          <input [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Search venues or areas" />
        </div>
        <label class="select-field">
          <span class="muted">Sort</span>
          <select [ngModel]="sort()" (ngModelChange)="sort.set($event)">
            <option>Most events</option>
            <option>Top rated</option>
            <option>A–Z</option>
          </select>
        </label>
      </section>

      @if (loading()) {
        <div class="skeleton-block"></div>
      } @else {
        <p class="muted results-note">{{ filtered().length }} venues {{ store.city() === 'All cities' ? 'across India' : 'in ' + store.city() }}</p>
        <div class="venue-grid">
          @for (v of filtered(); track v.slug) {
            <article class="venue-card" role="link" tabindex="0" (click)="open(v)" (keydown.enter)="open(v)">
              <div class="venue-art art-wide" [class.custom-img]="!!v.imageUrl" [style]="poster(v)"></div>
              <div class="venue-body">
                <div class="venue-title">
                  <h3>{{ v.name }}</h3>
                  @if (v.rating.count) {
                    <span class="rating"><lucide-icon [img]="icons.Star" [size]="14" /> {{ v.rating.avg.toFixed(1) }} <small>({{ v.rating.count }})</small></span>
                  }
                </div>
                <p class="muted"><lucide-icon [img]="icons.MapPin" [size]="14" /> {{ v.address }}, {{ v.city }}</p>
                <div class="chip-row">
                  @for (c of v.categories.slice(0, 3); track c) {
                    <span class="chip">{{ label(c) }}</span>
                  }
                </div>
                <footer>
                  <span><lucide-icon [img]="icons.CalendarDays" [size]="14" /> {{ v.upcoming }} upcoming</span>
                  @if (v.nextEvent) {
                    <small class="muted">Next: {{ v.nextEvent.title }} · {{ date(v.nextEvent.startsAt) }}</small>
                  }
                </footer>
              </div>
            </article>
          } @empty {
            <div class="empty-block">
              <lucide-icon [img]="icons.Building2" [size]="30" />
              <h3>No venues found</h3>
              <p class="muted">Try another city or search term.</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class VenuesPage implements OnInit {
  protected store = inject(StoreService);
  private api = inject(ApiService);
  private router = inject(Router);
  protected readonly icons = { Building2, CalendarDays, MapPin, Search, Star };
  protected readonly venues = signal<Venue[]>([]);
  protected readonly loading = signal(true);
  protected readonly query = signal('');
  protected readonly sort = signal<VenueSort>('Most events');

  protected readonly filtered = computed(() => {
    const city = this.store.city();
    const q = this.query().trim().toLowerCase();
    const list = this.venues().filter(
      (v) => (city === 'All cities' || v.city === city) && (!q || `${v.name} ${v.address} ${v.city}`.toLowerCase().includes(q)),
    );
    const sorters: Record<VenueSort, (a: Venue, b: Venue) => number> = {
      'Most events': (a, b) => b.upcoming - a.upcoming,
      'Top rated': (a, b) => b.rating.avg - a.rating.avg,
      'A–Z': (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(sorters[this.sort()]);
  });

  async ngOnInit(): Promise<void> {
    try {
      this.venues.set(await firstValueFrom(this.api.venues()));
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected open(v: Venue): void {
    this.router.navigate(['/venues', v.slug]);
  }
  protected poster = posterStyle;
  protected label = categoryLabel;
  protected date = shortDate;
}
