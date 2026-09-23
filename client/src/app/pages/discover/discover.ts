import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChevronRight, Heart, LucideAngularModule, MapPin, Search, Users } from 'lucide-angular';
import { EventItem } from '../../core/models';
import { StoreService } from '../../core/store.service';

const CATEGORIES = ['All scenes', 'Music', 'Movies', 'Theatre', 'Comedy', 'Sport', 'Food', 'Workshop', 'Dance', 'Art', 'Saved'];

@Component({
  selector: 'app-discover',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <section class="discover">
      <div class="hero">
        <img src="/scene-hero.png" alt="Singer performing beneath a circular light installation" />
        <div class="hero-shade"></div>
        <div class="hero-copy">
          <span><i></i> SCENEPASS ORIGINAL · ONE NIGHT ONLY</span>
          <h1>Hear the light.<br /><em>Feel the room.</em></h1>
          <p>Afterlight transforms Nova Arena into a living field of sound, movement and light.</p>
          <div>
            <button [disabled]="!store.events().length" (click)="chooseEvent(store.events()[0])">
              Choose your seats <lucide-icon [img]="icons.ChevronRight" [size]="17" />
            </button>
            <button class="ghost" (click)="router.navigateByUrl('/room')">
              <lucide-icon [img]="icons.Users" [size]="17" /> Start a group room
            </button>
          </div>
        </div>
        <div class="hero-date"><b>28</b><span>SEP<br />SAT · 8 PM</span></div>
      </div>

      <div class="discover-bar">
        <div class="search">
          <lucide-icon [img]="icons.Search" [size]="18" />
          <input [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Search events, artists or venues" />
        </div>
        <label class="sort-control">
          Sort
          <select [ngModel]="sort()" (ngModelChange)="sort.set($event)">
            <option>Featured</option>
            <option>Price: low</option>
            <option>Price: high</option>
          </select>
        </label>
      </div>

      <div class="chips discover-chips">
        @for (item of categories; track item) {
          <button [class.active]="store.category() === item" (click)="store.category.set(item)">{{ item }}</button>
        }
      </div>

      <section class="event-section">
        <header>
          <div><span>EXPLORE THE LINEUP</span><h2>Find your next story.</h2></div>
          <p>{{ filtered().length }} experiences {{ store.city() === 'All cities' ? 'across India' : 'in ' + store.city() }}</p>
        </header>
        <div class="event-grid">
          @for (event of filtered(); track event.id) {
            <article
              [class]="'event-card ' + event.color"
              role="button"
              tabindex="0"
              (keydown.enter)="chooseEvent(event)"
              (click)="chooseEvent(event)"
            >
              <div class="poster" [style.backgroundPosition]="posterPosition(event)">
                <span>{{ event.type }}</span>
                <button
                  [attr.aria-label]="'Save ' + event.title"
                  [class.saved]="store.favourites().includes(event.id)"
                  (click)="$event.stopPropagation(); store.toggleFavourite(event.id)"
                >
                  <lucide-icon [img]="icons.Heart" [size]="18" />
                </button>
              </div>
              <div class="event-copy">
                <small>{{ event.date }} · {{ event.city }}</small>
                <h3>{{ event.title }}</h3>
                <p>{{ event.sub }}</p>
                <footer>
                  <span><lucide-icon [img]="icons.MapPin" [size]="14" />{{ event.venue }}</span>
                  <b>₹{{ event.price.toLocaleString('en-IN') }} <lucide-icon [img]="icons.ChevronRight" [size]="15" /></b>
                </footer>
              </div>
            </article>
          }
        </div>
        @if (!filtered().length) {
          <div class="browse-empty">
            <lucide-icon [img]="icons.Search" [size]="28" />
            <h3>No experiences found</h3>
            <p>Try another city, category or search term.</p>
            <button (click)="clearFilters()">Clear filters</button>
          </div>
        }
      </section>
    </section>
  `,
})
export class DiscoverPage {
  protected store = inject(StoreService);
  protected router = inject(Router);
  protected readonly icons = { ChevronRight, Heart, MapPin, Search, Users };
  protected readonly categories = CATEGORIES;
  protected readonly query = signal('');
  protected readonly sort = signal('Featured');

  protected readonly filtered = computed(() => {
    const category = this.store.category();
    const city = this.store.city();
    const query = this.query().toLowerCase();
    const favourites = this.store.favourites();
    const typeNeedle = category.toUpperCase().replace('MUSIC', 'LIVE MUSIC').replace('MOVIES', 'MOVIE');

    return this.store
      .events()
      .filter(
        (e) =>
          (category === 'All scenes' ||
            (category === 'Saved' ? favourites.includes(e.id) : e.type.includes(typeNeedle))) &&
          (city === 'All cities' || e.city === city) &&
          (e.title + e.type + e.venue + e.city).toLowerCase().includes(query),
      )
      .sort((a, b) =>
        this.sort() === 'Price: low' ? a.price - b.price : this.sort() === 'Price: high' ? b.price - a.price : a.seq - b.seq,
      );
  });

  // The poster atlas is a 4×3 grid; cycle through it by event order.
  protected posterPosition(event: EventItem): string {
    const art = (event.seq - 1) % 12;
    return `${(art % 4) * 33.333}% ${Math.floor(art / 4) * 50}%`;
  }

  protected chooseEvent(event: EventItem): void {
    if (this.store.selectedEventId() !== event.id) this.store.selectedSeats.set([]);
    this.store.selectedEventId.set(event.id);
    this.router.navigate(['/events', event.id, 'seats']);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.store.category.set('All scenes');
    this.store.city.set('All cities');
  }
}
