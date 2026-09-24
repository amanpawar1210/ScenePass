import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Building2, CalendarDays, LucideAngularModule, MapPin, Search, Star } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { Venue } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { categoryLabel, posterStyle, shortDate } from '../../core/format';
import { PageHero } from '../../shared/page-hero';
import { Reveal } from '../../shared/reveal';

type VenueSort = 'Most events' | 'Top rated' | 'A–Z';

@Component({
  selector: 'app-venues',
  imports: [FormsModule, LucideAngularModule, PageHero, Reveal],
  template: `
    <div class="container page">
      <app-page-hero
        eyebrow="Venues"
        title="Explore the places"
        highlight="that make the night."
        subtitle="Arenas, theatres, clubs and open-air lawns, rated by people who've actually been."
        [icon]="icons.Building2"
      >
        <div class="hero-stat-cards">
          <div><span class="stat-ic"><lucide-icon [img]="icons.Building2" [size]="18" /></span><b>{{ venues().length }}</b><small>venues</small></div>
          <div><span class="stat-ic"><lucide-icon [img]="icons.MapPin" [size]="18" /></span><b>{{ cityCount() }}</b><small>cities</small></div>
          <div><span class="stat-ic"><lucide-icon [img]="icons.Star" [size]="18" /></span><b>{{ avgRating() }}</b><small>avg. rating</small></div>
        </div>
        <div aside class="collage">
          @for (v of collage(); track v.slug; let i = $index) {
            <button [class]="'collage-item c' + i" (click)="open(v)" [title]="v.name">
              <span class="art-wide" [class.custom-img]="!!v.imageUrl" [style]="poster(v, 420)"></span>
              <b>{{ v.name }}</b>
            </button>
          }
        </div>
      </app-page-hero>

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
            <article class="venue-card" [appReveal]="$index" role="link" tabindex="0" (click)="open(v)" (keydown.enter)="open(v)">
              <div class="venue-media">
                <div class="venue-art art-wide" [class.custom-img]="!!v.imageUrl" [style]="poster(v, 600)"></div>
                <span class="venue-city"><lucide-icon [img]="icons.MapPin" [size]="12" /> {{ v.city }}</span>
                @if (v.rating.count) {
                  <span class="venue-rating"><lucide-icon [img]="icons.Star" [size]="12" /> {{ v.rating.avg.toFixed(1) }}</span>
                }
                <span class="venue-upcoming">{{ v.upcoming }} upcoming</span>
              </div>
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

  protected readonly cityCount = computed(() => new Set(this.venues().map((v) => v.city)).size);
  protected readonly avgRating = computed(() => {
    const rated = this.venues().filter((v) => v.rating.count);
    return rated.length ? (rated.reduce((n, v) => n + v.rating.avg, 0) / rated.length).toFixed(1) : '–';
  });
  protected readonly collage = computed(() => [...this.venues()].filter((v) => v.imageUrl).sort((a, b) => b.rating.avg - a.rating.avg).slice(0, 3));
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
