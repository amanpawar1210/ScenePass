import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Building2, CalendarDays, CornerDownLeft, LayoutGrid, LucideAngularModule, LucideIconData, MapPin, Search } from 'lucide-angular';
import { StoreService } from '../core/store.service';
import { categoryLabel, posterStyle, shortDate } from '../core/format';
import { EventItem } from '../core/models';

interface Result {
  kind: 'Event' | 'Venue' | 'Category' | 'City';
  label: string;
  hint: string;
  icon: LucideIconData;
  event?: EventItem;
  run: () => void;
}

/** Global instant search (Ctrl/⌘ + K or "/"): events, venues, categories and cities. */
@Component({
  selector: 'app-command-palette',
  imports: [FormsModule, LucideAngularModule],
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  template: `
    @if (store.paletteOpen()) {
      <div class="palette-backdrop" (click)="close()">
        <div class="palette" role="dialog" aria-label="Search" (click)="$event.stopPropagation()">
          <div class="palette-input">
            <lucide-icon [img]="icons.Search" [size]="20" />
            <input
              #input
              [ngModel]="query()"
              (ngModelChange)="query.set($event); active.set(0)"
              (keydown)="onKey($event)"
              placeholder="Search events, venues, categories, cities…"
              aria-label="Search"
            />
            <kbd>Esc</kbd>
          </div>
          <div class="palette-results">
            @for (group of groups(); track group.kind) {
              <small class="palette-group">{{ group.kind }}s</small>
              @for (r of group.items; track r.label) {
                <button
                  class="palette-item"
                  [class.active]="indexOf(r) === active()"
                  (mouseenter)="active.set(indexOf(r))"
                  (click)="pick(r)"
                >
                  @if (r.event; as e) {
                    <span class="palette-thumb art-square" [style]="poster(e, 100)"></span>
                  } @else {
                    <span class="palette-icon"><lucide-icon [img]="r.icon" [size]="16" /></span>
                  }
                  <span class="grow"><b>{{ r.label }}</b><small>{{ r.hint }}</small></span>
                  <lucide-icon [img]="icons.CornerDownLeft" [size]="14" />
                </button>
              }
            } @empty {
              <p class="palette-empty">No matches for "{{ query() }}"</p>
            }
          </div>
          <footer class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Ctrl</kbd><kbd>K</kbd> toggle</span></footer>
        </div>
      </div>
    }
  `,
})
export class CommandPalette {
  protected store = inject(StoreService);
  private router = inject(Router);
  protected readonly icons = { CornerDownLeft, Search };
  protected readonly query = signal('');
  protected readonly active = signal(0);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  protected poster = posterStyle;

  private readonly results = computed<Result[]>(() => {
    const q = this.query().trim().toLowerCase();
    const events = this.store.liveEvents();
    const match = (s: string) => !q || s.toLowerCase().includes(q);

    const eventResults = events
      .filter((e) => match([e.title, e.sub, e.venue, e.city, e.type, ...e.lineup.map((l) => l.name), ...e.tags].join(' ')))
      .slice(0, q ? 6 : 4)
      .map<Result>((e) => ({
        kind: 'Event', label: e.title, hint: `${shortDate(e.startsAt)} · ${e.venue}, ${e.city}`, icon: CalendarDays, event: e,
        run: () => this.router.navigate(['/events', e.id]),
      }));

    const venues = new Map(events.map((e) => [e.venueSlug, e]));
    const venueResults = [...venues.values()]
      .filter((e) => q && match(`${e.venue} ${e.address} ${e.city}`))
      .slice(0, 4)
      .map<Result>((e) => ({
        kind: 'Venue', label: e.venue, hint: `${e.address}, ${e.city}`, icon: Building2,
        run: () => this.router.navigate(['/venues', e.venueSlug]),
      }));

    const categoryResults = [...new Set(events.map((e) => e.type))]
      .filter((t) => q && match(categoryLabel(t)))
      .map<Result>((t) => ({
        kind: 'Category', label: categoryLabel(t), hint: `${events.filter((e) => e.type === t).length} events`, icon: LayoutGrid,
        run: () => {
          this.store.category.set(CATEGORY_CHIP[t] ?? 'All scenes');
          this.router.navigateByUrl('/discover');
        },
      }));

    const cityResults = this.store.cities()
      .filter((c) => q && match(c))
      .map<Result>((c) => ({
        kind: 'City', label: c, hint: `${events.filter((e) => e.city === c).length} upcoming events`, icon: MapPin,
        run: () => {
          this.store.city.set(c);
          this.router.navigateByUrl('/discover');
        },
      }));

    return [...eventResults, ...venueResults, ...categoryResults, ...cityResults];
  });

  protected readonly groups = computed(() => {
    const kinds: Result['kind'][] = ['Event', 'Venue', 'Category', 'City'];
    return kinds.map((kind) => ({ kind, items: this.results().filter((r) => r.kind === kind) })).filter((g) => g.items.length);
  });

  constructor() {
    effect(() => {
      if (this.store.paletteOpen()) setTimeout(() => this.input()?.nativeElement.focus());
    });
  }

  protected indexOf(r: Result): number {
    return this.results().indexOf(r);
  }

  protected onGlobalKey(e: KeyboardEvent): void {
    const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.store.paletteOpen.update((v) => !v);
    } else if (e.key === '/' && !typing && !this.store.paletteOpen()) {
      e.preventDefault();
      this.store.paletteOpen.set(true);
    } else if (e.key === 'Escape' && this.store.paletteOpen()) {
      this.close();
    }
  }

  protected onKey(e: KeyboardEvent): void {
    const count = this.results().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.update((i) => (i + 1) % Math.max(count, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.update((i) => (i - 1 + count) % Math.max(count, 1));
    } else if (e.key === 'Enter') {
      const r = this.results()[this.active()];
      if (r) this.pick(r);
    }
  }

  protected pick(r: Result): void {
    this.close();
    r.run();
  }

  protected close(): void {
    this.store.paletteOpen.set(false);
    this.query.set('');
    this.active.set(0);
  }
}

// Maps event types to the Discover category chip labels.
const CATEGORY_CHIP: Record<string, string> = {
  'LIVE MUSIC': 'Music', COMEDY: 'Comedy', THEATRE: 'Theatre', SPORT: 'Sport', MOVIE: 'Movies',
  FOOD: 'Food', DANCE: 'Dance', WORKSHOP: 'Workshops', ART: 'Art', EXHIBITION: 'Exhibitions',
};
