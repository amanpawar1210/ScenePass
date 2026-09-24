import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  Copy,
  Drama,
  Flame,
  Footprints,
  Heart,
  Landmark,
  LayoutGrid,
  Laugh,
  LucideAngularModule,
  LucideIconData,
  MapPin,
  Music,
  Palette,
  PenTool,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  Trophy,
  UtensilsCrossed,
  X,
} from 'lucide-angular';
import { AuthService } from '../../core/auth.service';
import { EventItem } from '../../core/models';
import { StoreService } from '../../core/store.service';
import {
  DATE_FILTERS,
  DateFilter,
  categoryLabel,
  dayKey,
  inr,
  matchesDateFilter,
  posterStyle,
  shortDate,
  timeOf,
} from '../../core/format';
import { EventCard } from '../../shared/event-card';
import { ActivityTicker } from '../../shared/activity-ticker';
import { CountUp } from '../../shared/count-up';
import { Reveal } from '../../shared/reveal';

interface CategoryChip {
  label: string;
  type: string | null;
  icon: LucideIconData;
}
const CATEGORY_CHIPS: CategoryChip[] = [
  { label: 'All', type: null, icon: LayoutGrid },
  { label: 'Music', type: 'LIVE MUSIC', icon: Music },
  { label: 'Comedy', type: 'COMEDY', icon: Laugh },
  { label: 'Theatre', type: 'THEATRE', icon: Drama },
  { label: 'Sport', type: 'SPORT', icon: Trophy },
  { label: 'Movies', type: 'MOVIE', icon: Clapperboard },
  { label: 'Food', type: 'FOOD', icon: UtensilsCrossed },
  { label: 'Dance', type: 'DANCE', icon: Footprints },
  { label: 'Workshops', type: 'WORKSHOP', icon: PenTool },
  { label: 'Art', type: 'ART', icon: Palette },
  { label: 'Exhibitions', type: 'EXHIBITION', icon: Landmark },
  { label: 'Saved', type: null, icon: Heart },
];
const SORTS = ['Recommended', 'Soonest', 'Near me', 'Top rated', 'Selling fast', 'Price: low to high', 'Price: high to low'] as const;
type Sort = (typeof SORTS)[number];
const PRICE_PRESETS: [label: string, min: number | null, max: number | null][] = [
  ['Under ₹500', null, 499],
  ['₹500 – ₹1,000', 500, 1000],
  ['₹1,000 – ₹2,000', 1000, 2000],
  ['₹2,000+', 2000, null],
];

@Component({
  selector: 'app-discover',
  imports: [FormsModule, LucideAngularModule, EventCard, ActivityTicker, CountUp, Reveal],
  template: `
    <div class="container page">
      <section class="hero-split">
        <div class="hero-left hero-panel">
          <span class="blob b1"></span><span class="blob b2"></span>
          <span class="chip chip-live-soft"><i class="pulse-dot"></i> {{ store.liveEvents().length }} events live {{ store.city() === 'All cities' ? 'across India' : 'in ' + store.city() }}</span>
          <h1>
            Find
            @for (w of [rotatingWord()]; track w) {
              <span class="rotating-word">{{ w }}</span>
            }
            <br />near you this week.
          </h1>
          <p class="lead">Pick your exact seat on a live map, book with friends and walk in with a QR ticket.</p>
          <form class="hero-search" (submit)="$event.preventDefault(); scrollToResults()">
            <lucide-icon [img]="icons.Search" [size]="20" />
            <input [ngModel]="query()" (ngModelChange)="query.set($event)" name="q" placeholder="Search events, artists, venues or tags" />
            @if (query()) {
              <button type="button" class="clear-btn" aria-label="Clear search" (click)="query.set('')"><lucide-icon [img]="icons.X" [size]="16" /></button>
            }
            <button type="submit" class="btn btn-primary">Search</button>
          </form>
          <div class="trending">
            <span class="muted"><lucide-icon [img]="icons.Flame" [size]="14" /> Trending:</span>
            @for (t of trendingSearches(); track t) {
              <button type="button" (click)="query.set(t); scrollToResults()">{{ t }}</button>
            }
          </div>

          <div class="hero-stat-cards">
            <div><span class="stat-ic"><lucide-icon [img]="icons.CalendarDays" [size]="18" /></span><b [appCountUp]="store.liveEvents().length"></b><small>live events</small></div>
            <div><span class="stat-ic"><lucide-icon [img]="icons.MapPin" [size]="18" /></span><b [appCountUp]="venueCount()"></b><small>venues</small></div>
            <div><span class="stat-ic"><lucide-icon [img]="icons.Tag" [size]="18" /></span><b [appCountUp]="ticketsLeft()"></b><small>seats available</small></div>
          </div>

          <div class="social-proof">
            <div class="avatar-stack">
              @for (n of proofNames; track n; let i = $index) {
                <span class="avatar-sm" [attr.data-tone]="i % 6">{{ n }}</span>
              }
            </div>
            <span><b>{{ ticketsSold().toLocaleString('en-IN') }}+ tickets</b> booked · <lucide-icon [img]="icons.Star" [size]="13" /> <b>{{ avgRating() }}</b> avg. venue rating</span>
          </div>

          @if (thisWeek().length) {
            <div class="week-strip">
              <small class="eyebrow">Happening soon</small>
              <div class="week-items">
                @for (e of thisWeek(); track e.id) {
                  <button class="week-item" (click)="open(e)">
                    <span class="week-thumb art-square" [class.custom-img]="!!e.imageUrl" [style]="poster(e, 120)"></span>
                    <span class="week-text"><b>{{ e.title }}</b><small>{{ date(e) }}</small></span>
                  </button>
                }
              </div>
            </div>
          }
        </div>

        @if (slide(); as f) {
          <aside class="featured-card" (mouseenter)="paused.set(true)" (mouseleave)="paused.set(false)">
            @for (h of [f]; track h.id) {
              <div class="featured-media fade-in" (click)="!justSwiped && open(h)" (pointerdown)="swipeStart($event)" (pointerup)="swipeEnd($event)">
                <div class="featured-art art-wide" [class.custom-img]="!!h.imageUrl" [style]="poster(h, 1100)"></div>
                <span class="chip chip-white"><lucide-icon [img]="icons.Flame" [size]="13" /> Featured</span>
              </div>
              <div class="featured-body fade-in">
                <small class="eyebrow">{{ label(h.type) }} · {{ h.city }}</small>
                <h2 (click)="open(h)">{{ h.title }}</h2>
                <p class="muted">{{ h.sub }}</p>
                <div class="meta-row">
                  <span><lucide-icon [img]="icons.CalendarDays" [size]="15" /> {{ date(h) }} · {{ time(h) }}</span>
                  <span><lucide-icon [img]="icons.MapPin" [size]="15" /> {{ h.venue }}</span>
                </div>
                <div class="featured-foot">
                  <div><small class="muted">Tickets from</small><b>{{ price(h.price) }}</b></div>
                  <button class="btn btn-primary" (click)="open(h)">Book now <lucide-icon [img]="icons.ArrowRight" [size]="16" /></button>
                </div>
              </div>
            }
            @if (featured().length > 1) {
              @for (h of [f]; track h.id) {
                <div class="slide-progress"><i [class.paused]="paused()"></i></div>
              }
              <div class="featured-nav">
                <button class="icon-btn-round sm" aria-label="Previous" (click)="step(-1)"><lucide-icon [img]="icons.ChevronLeft" [size]="16" /></button>
                <div class="dots">
                  @for (x of featured(); track x.id; let i = $index) {
                    <button [class.active]="x.id === f.id" [attr.aria-label]="'Show ' + x.title" (click)="slideIndex.set(i)"></button>
                  }
                </div>
                <button class="icon-btn-round sm" aria-label="Next" (click)="step(1)"><lucide-icon [img]="icons.ChevronRight" [size]="16" /></button>
              </div>
            }
          </aside>
        }
      </section>

      <app-activity-ticker />

      <nav class="category-row" aria-label="Categories">
        @for (chip of categoryChips; track chip.label) {
          <button class="cat-chip" [class.active]="activeCategory() === chip.label" (click)="setCategory(chip.label)">
            <lucide-icon [img]="chip.icon" [size]="16" />
            {{ chip.label }}
            @if (chip.label === 'Saved' && store.favourites().length) {
              <i class="count">{{ store.favourites().length }}</i>
            }
          </button>
        }
      </nav>

      <section class="toolbar" id="results">
        <label class="select-field">
          <lucide-icon [img]="icons.CalendarDays" [size]="16" />
          <select [ngModel]="dateFilter()" (ngModelChange)="dateFilter.set($event); dateFrom.set(''); dateTo.set('')" aria-label="When">
            @for (d of dateFilters; track d) {
              <option [value]="d">{{ d }}</option>
            }
          </select>
        </label>
        <label class="select-field">
          <span class="muted">Sort</span>
          <select [ngModel]="sort()" (ngModelChange)="sort.set($event)" aria-label="Sort">
            @for (s of sorts; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </label>
        <button class="btn btn-outline" [class.on]="showFilters()" (click)="showFilters.set(!showFilters())">
          <lucide-icon [img]="icons.SlidersHorizontal" [size]="16" /> Filters
          @if (advancedCount()) {
            <i class="count">{{ advancedCount() }}</i>
          }
        </button>
      </section>

      @if (showFilters()) {
        <section class="filter-panel fade-in">
          <div class="filter-group">
            <h4>Price</h4>
            <div class="chip-row">
              @for (p of pricePresets; track p[0]) {
                <button class="chip-btn" [class.active]="priceMin() === p[1] && priceMax() === p[2]" (click)="setPrice(p[1], p[2])">{{ p[0] }}</button>
              }
            </div>
            <div class="range-inputs">
              <label><span>Min ₹</span><input type="number" min="0" [ngModel]="priceMin()" (ngModelChange)="priceMin.set($event === '' || $event === null ? null : +$event)" placeholder="0" /></label>
              <span>–</span>
              <label><span>Max ₹</span><input type="number" min="0" [ngModel]="priceMax()" (ngModelChange)="priceMax.set($event === '' || $event === null ? null : +$event)" placeholder="Any" /></label>
            </div>
          </div>
          <div class="filter-group">
            <h4>Dates</h4>
            <div class="range-inputs">
              <label><span>From</span><input type="date" [min]="today" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event); dateFilter.set('Any date')" /></label>
              <span>–</span>
              <label><span>To</span><input type="date" [min]="dateFrom() || today" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event); dateFilter.set('Any date')" /></label>
            </div>
          </div>
          <div class="filter-group">
            <h4>Venue rating</h4>
            <div class="chip-row">
              @for (r of [0, 3.5, 4, 4.5]; track r) {
                <button class="chip-btn" [class.active]="minRating() === r" (click)="minRating.set(r)">
                  @if (r) { <lucide-icon [img]="icons.Star" [size]="13" /> {{ r }}+ } @else { Any }
                </button>
              }
            </div>
          </div>
          <div class="filter-group">
            <h4>Availability</h4>
            <label class="switch-row"><input type="checkbox" [ngModel]="hideSoldOut()" (ngModelChange)="hideSoldOut.set($event)" /> Hide sold-out events</label>
            <label class="switch-row"><input type="checkbox" [ngModel]="onlyWeekend()" (ngModelChange)="onlyWeekend.set($event)" /> Weekends only</label>
          </div>
        </section>
      }

      @if (activeFilters().length) {
        <div class="active-filters">
          @for (f of activeFilters(); track f.label) {
            <button class="chip chip-removable" (click)="f.clear()">{{ f.label }} <lucide-icon [img]="icons.X" [size]="13" /></button>
          }
          <button class="link-btn" (click)="clearFilters()">Clear all</button>
        </div>
      }

      @if (showRails()) {
        @if (recent().length) {
          <section class="section">
            <header class="section-head"><div><h2><lucide-icon [img]="icons.Clock" [size]="20" /> Recently viewed</h2></div></header>
            <div class="rail">
              @for (event of recent(); track event.id) {
                <app-event-card [event]="event" [index]="$index" />
              }
            </div>
          </section>
        }
        <section class="section">
          <header class="section-head"><div><h2><lucide-icon [img]="icons.MapPin" [size]="20" /> Browse by city</h2></div></header>
          <div class="city-grid">
            @for (c of cityTiles(); track c.city; let i = $index) {
              <button class="city-tile" [appReveal]="i" [class.active]="store.city() === c.city" (click)="store.city.set(store.city() === c.city ? 'All cities' : c.city)">
                <span class="city-art art-square" [style]="poster(c.cover, 420)"></span>
                <span class="city-text"><b>{{ c.city }}</b><small>{{ c.count }} events · from {{ price(c.from) }}</small></span>
              </button>
            }
          </div>
        </section>
        @if (trending().length) {
          <section class="section">
            <header class="section-head">
              <div><h2><lucide-icon [img]="icons.Flame" [size]="20" /> Selling fast</h2><p class="muted">Grab these before they're gone</p></div>
            </header>
            <div class="rail">
              @for (event of trending(); track event.id) {
                <app-event-card [event]="event" [index]="$index" />
              }
            </div>
          </section>
        }
        @if (store.promos().length) {
          <section class="offer-row">
            @for (p of store.promos(); track p.code) {
              <button class="offer" (click)="copyCode(p.code)" [title]="'Copy ' + p.code">
                <span class="offer-icon"><lucide-icon [img]="icons.Tag" [size]="18" /></span>
                <span><b>{{ p.code }}</b><small>{{ p.description }}</small></span>
                <lucide-icon [img]="icons.Copy" [size]="15" />
              </button>
            }
          </section>
        }
      }

      <section class="section">
        <header class="section-head">
          <div>
            <h2>{{ heading() }}</h2>
            <p class="muted">{{ filtered().length }} {{ filtered().length === 1 ? 'event' : 'events' }} {{ store.city() === 'All cities' ? 'across India' : 'in ' + store.city() }}</p>
          </div>
        </header>
        <div class="event-grid">
          @for (event of filtered(); track event.id) {
            <app-event-card [event]="event" [index]="$index" />
          }
        </div>
        @if (!filtered().length) {
          <div class="empty-block">
            <lucide-icon [img]="icons.Search" [size]="30" />
            <h3>No events match</h3>
            <p class="muted">Try another city, date, price range or search term.</p>
            <button class="btn btn-primary" (click)="clearFilters()">Clear filters</button>
          </div>
        }
      </section>
    </div>
  `,
})
export class DiscoverPage {
  protected store = inject(StoreService);
  private auth = inject(AuthService);
  protected router = inject(Router);
  protected readonly icons = {
    ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock, Copy, Flame, MapPin, Search, SlidersHorizontal, Star, Tag, X,
  };
  protected readonly categoryChips = CATEGORY_CHIPS;
  protected readonly dateFilters = DATE_FILTERS;
  protected readonly sorts = SORTS;
  protected readonly pricePresets = PRICE_PRESETS;
  protected readonly today = dayKey(new Date());

  protected readonly query = signal('');
  protected readonly sort = signal<Sort>('Recommended');
  protected readonly dateFilter = signal<DateFilter>('Any date');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly priceMin = signal<number | null>(null);
  protected readonly priceMax = signal<number | null>(null);
  protected readonly minRating = signal(0);
  protected readonly hideSoldOut = signal(false);
  protected readonly onlyWeekend = signal(false);
  protected readonly showFilters = signal(false);
  protected readonly slideIndex = signal(0);
  private readonly wordIndex = signal(0);
  protected readonly proofNames = ['AP', 'AR', 'RS', 'VI', 'ZK'];
  private readonly words = ['live music', 'stand-up comedy', 'big matches', 'theatre nights', 'food festivals', 'dance shows'];
  protected readonly rotatingWord = computed(() => this.words[this.wordIndex() % this.words.length]);
  protected readonly paused = signal(false);
  private swipeX = 0;
  protected justSwiped = false;

  /** The store keeps the old "All scenes" label; show it as "All". */
  protected readonly activeCategory = computed(() => (this.store.category() === 'All scenes' ? 'All' : this.store.category()));

  private readonly inCity = computed(() => {
    const city = this.store.city();
    return this.store.liveEvents().filter((e) => city === 'All cities' || e.city === city);
  });
  protected readonly venueCount = computed(() => new Set(this.store.liveEvents().map((e) => e.venue)).size);
  protected readonly ticketsSold = computed(() => this.store.liveEvents().reduce((n, e) => n + e.sold, 0));
  protected readonly avgRating = computed(() => {
    const rated = this.store.liveEvents().filter((e) => e.rating.count);
    return rated.length ? (rated.reduce((n, e) => n + e.rating.avg, 0) / rated.length).toFixed(1) : '4.5';
  });
  protected readonly thisWeek = computed(() =>
    [...this.inCity()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 3),
  );
  protected readonly trendingSearches = computed(() => {
    const top = [...this.store.liveEvents()].sort((a, b) => b.sold / b.capacity - a.sold / a.capacity)[0];
    return ['Comedy', 'Jazz', top?.title ?? 'Live music', this.store.city() === 'All cities' ? 'Mumbai' : 'Weekend'];
  });
  protected readonly ticketsLeft = computed(() => this.store.liveEvents().reduce((n, e) => n + e.seatsLeft, 0));
  protected readonly cityTiles = computed(() =>
    this.store.cities().map((city) => {
      const events = this.store.liveEvents().filter((e) => e.city === city);
      const cover = events.find((e) => e.featured) ?? events[0];
      return { city, count: events.length, from: Math.min(...events.map((e) => e.price)), cover: cover ?? { art: 0, imageUrl: '' } };
    }).filter((c) => c.count),
  );

  protected readonly featured = computed(() => {
    const local = this.inCity().filter((e) => e.featured && e.seatsLeft > 0);
    const all = this.store.liveEvents().filter((e) => e.featured && e.seatsLeft > 0);
    return (local.length ? local : all).slice(0, 5);
  });
  protected readonly slide = computed(() => {
    const list = this.featured();
    return list.length ? list[((this.slideIndex() % list.length) + list.length) % list.length] : null;
  });

  protected readonly advancedCount = computed(
    () =>
      Number(this.priceMin() !== null || this.priceMax() !== null) +
      Number(!!(this.dateFrom() || this.dateTo())) +
      Number(this.minRating() > 0) +
      Number(this.hideSoldOut()) +
      Number(this.onlyWeekend()),
  );

  protected readonly activeFilters = computed(() => {
    const list: { label: string; clear: () => void }[] = [];
    if (this.query().trim()) list.push({ label: `“${this.query().trim()}”`, clear: () => this.query.set('') });
    if (this.activeCategory() !== 'All') list.push({ label: this.activeCategory(), clear: () => this.setCategory('All') });
    if (this.dateFilter() !== 'Any date') list.push({ label: this.dateFilter(), clear: () => this.dateFilter.set('Any date') });
    if (this.dateFrom() || this.dateTo())
      list.push({ label: `${this.dateFrom() || 'Any'} → ${this.dateTo() || 'Any'}`, clear: () => (this.dateFrom.set(''), this.dateTo.set('')) });
    if (this.priceMin() !== null || this.priceMax() !== null)
      list.push({
        label: `${this.priceMin() !== null ? inr(this.priceMin()!) : '₹0'} – ${this.priceMax() !== null ? inr(this.priceMax()!) : 'any'}`,
        clear: () => this.setPrice(null, null),
      });
    if (this.minRating()) list.push({ label: `${this.minRating()}+ stars`, clear: () => this.minRating.set(0) });
    if (this.hideSoldOut()) list.push({ label: 'Available only', clear: () => this.hideSoldOut.set(false) });
    if (this.onlyWeekend()) list.push({ label: 'Weekends', clear: () => this.onlyWeekend.set(false) });
    return list;
  });

  protected readonly showRails = computed(() => !this.activeFilters().length);

  protected readonly recent = computed(() => {
    const byId = new Map(this.store.liveEvents().map((e) => [e.id, e]));
    return this.store.recentlyViewed().map((id) => byId.get(id)).filter((e): e is EventItem => !!e).slice(0, 8);
  });
  protected readonly trending = computed(() =>
    this.inCity()
      .filter((e) => e.seatsLeft > 0 && e.sold / e.capacity >= 0.4)
      .sort((a, b) => b.sold / b.capacity - a.sold / a.capacity)
      .slice(0, 8),
  );

  protected readonly heading = computed(() => {
    const label = this.activeCategory();
    if (label === 'Saved') return 'Your saved events';
    if (label !== 'All') return label;
    return this.showRails() ? 'All upcoming events' : 'Results';
  });

  protected readonly filtered = computed(() => {
    const label = this.activeCategory();
    const type = CATEGORY_CHIPS.find((c) => c.label === label)?.type ?? null;
    const query = this.query().trim().toLowerCase();
    const favourites = this.store.favourites();
    const when = this.dateFilter();
    const [from, to] = [this.dateFrom(), this.dateTo()];
    const [min, max] = [this.priceMin(), this.priceMax()];
    const rating = this.minRating();
    const home = this.auth.user()?.city;

    const list = this.inCity().filter((e) => {
      const day = dayKey(e.startsAt);
      return (
        (label === 'All' || (label === 'Saved' ? favourites.includes(e.id) : e.type === type)) &&
        matchesDateFilter(e.startsAt, when) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        (min === null || e.price >= min) &&
        (max === null || e.price <= max) &&
        (!rating || e.rating.avg >= rating) &&
        (!this.hideSoldOut() || e.seatsLeft > 0) &&
        (!this.onlyWeekend() || ['Sat', 'Sun'].includes(shortDate(e.startsAt).slice(0, 3))) &&
        (!query ||
          [e.title, e.sub, e.type, e.venue, e.city, ...e.tags, ...e.lineup.map((l) => l.name)].join(' ').toLowerCase().includes(query))
      );
    });
    const time = (e: EventItem) => Date.parse(e.startsAt);
    const sorters: Record<Sort, (a: EventItem, b: EventItem) => number> = {
      Recommended: (a, b) => Number(b.featured) - Number(a.featured) || time(a) - time(b),
      Soonest: (a, b) => time(a) - time(b),
      'Near me': (a, b) => Number(b.city === home) - Number(a.city === home) || time(a) - time(b),
      'Top rated': (a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count,
      'Selling fast': (a, b) => a.seatsLeft / a.capacity - b.seatsLeft / b.capacity,
      'Price: low to high': (a, b) => a.price - b.price,
      'Price: high to low': (a, b) => b.price - a.price,
    };
    return list.sort(sorters[this.sort()]);
  });

  constructor() {
    const timer = setInterval(() => !this.paused() && this.slideIndex.update((i) => i + 1), 6000);
    const words = setInterval(() => this.wordIndex.update((i) => i + 1), 2600);
    inject(DestroyRef).onDestroy(() => clearInterval(words));
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected label = categoryLabel;
  protected date = (e: EventItem) => shortDate(e.startsAt);
  protected time = (e: EventItem) => timeOf(e.startsAt);
  protected price = inr;
  protected poster = posterStyle;

  protected swipeStart(e: PointerEvent): void {
    this.swipeX = e.clientX;
  }

  /** Swipe left/right on the featured image to change slides (a tap still opens it). */
  protected swipeEnd(e: PointerEvent): void {
    const dx = e.clientX - this.swipeX;
    if (Math.abs(dx) > 40) {
      this.justSwiped = true;
      setTimeout(() => (this.justSwiped = false));
      this.step(dx < 0 ? 1 : -1);
    }
  }

  protected step(delta: number): void {
    this.slideIndex.update((i) => i + delta);
  }

  protected setCategory(label: string): void {
    this.store.category.set(label === 'All' ? 'All scenes' : label);
  }

  protected setPrice(min: number | null, max: number | null): void {
    this.priceMin.set(min);
    this.priceMax.set(max);
  }

  protected open(event: EventItem): void {
    this.router.navigate(['/events', event.id]);
  }

  protected scrollToResults(): void {
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected copyCode(code: string): void {
    navigator.clipboard?.writeText(code);
    this.store.notify(`${code} copied · apply it at checkout`);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.dateFilter.set('Any date');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.setPrice(null, null);
    this.minRating.set(0);
    this.hideSoldOut.set(false);
    this.onlyWeekend.set(false);
    this.setCategory('All');
    this.store.city.set('All cities');
  }
}
