import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Eye, Heart, LucideAngularModule, MapPin, Star } from 'lucide-angular';
import { Reveal } from './reveal';
import { EventItem } from '../core/models';
import { StoreService } from '../core/store.service';
import { availability, categoryLabel, countdownLabel, dayParts, inr, posterStyle, shortDate, timeOf } from '../core/format';

@Component({
  selector: 'app-event-card',
  imports: [LucideAngularModule, Reveal],
  host: { style: 'display: contents' },
  template: `
    @let e = event();
    <article class="event-card" [appReveal]="index()" role="link" tabindex="0" (keydown.enter)="open()" (click)="open()">
      <div class="card-media">
        <div class="poster" [class.custom-img]="!!e.imageUrl" [style]="poster()"></div>
        <span class="media-tag">{{ category() }}</span>
        <div class="date-badge"><b>{{ parts().day }}</b><small>{{ parts().month }}</small></div>
        <button
          class="heart"
          [attr.aria-label]="(saved() ? 'Unsave ' : 'Save ') + e.title"
          [class.saved]="saved()"
          (click)="$event.stopPropagation(); store.toggleFavourite(e.id)"
        >
          <lucide-icon [img]="icons.Heart" [size]="17" />
        </button>
        @if (badge(); as b) {
          <em [class]="'avail ' + b.tone">{{ b.label }}</em>
        }
        <button class="quick-btn" (click)="$event.stopPropagation(); store.quickView.set(e)">
          <lucide-icon [img]="icons.Eye" [size]="15" /> Quick view
        </button>
      </div>
      <div class="card-body">
        <div class="card-date">
          <span class="nowrap">{{ date() }} · {{ time() }}</span>
          @if (countdown()) {
            <span class="chip chip-live"><i class="pulse-dot"></i>{{ countdown() }}</span>
          }
        </div>
        <h3>{{ e.title }}</h3>
        <p class="card-venue"><lucide-icon [img]="icons.MapPin" [size]="14" />{{ e.venue }}, {{ e.city }}</p>
        <footer>
          @if (e.rating.count) {
            <span class="rating"><lucide-icon [img]="icons.Star" [size]="14" /> {{ e.rating.avg.toFixed(1) }} <small>({{ e.rating.count }})</small></span>
          } @else {
            <span class="rating muted">New venue</span>
          }
          <b>{{ price() }} <small>onwards</small></b>
        </footer>
        <div class="sold-meter" [title]="e.sold + ' of ' + e.capacity + ' seats booked'">
          <i [style.width.%]="soldPct()" [class.hot]="soldPct() > 70"></i>
        </div>
      </div>
    </article>
  `,
})
export class EventCard {
  readonly event = input.required<EventItem>();
  /** Position in its list, used to stagger the entrance animation. */
  readonly index = input(0);
  protected store = inject(StoreService);
  private router = inject(Router);
  protected readonly icons = { Eye, Heart, MapPin, Star };

  protected readonly saved = computed(() => this.store.favourites().includes(this.event().id));
  protected readonly poster = computed(() => posterStyle(this.event(), 600));
  protected readonly badge = computed(() => availability(this.event()));
  protected readonly category = computed(() => categoryLabel(this.event().type));
  protected readonly date = computed(() => shortDate(this.event().startsAt));
  protected readonly time = computed(() => timeOf(this.event().startsAt));
  protected readonly countdown = computed(() => countdownLabel(this.event().startsAt, this.event().endsAt, this.store.now()));
  protected readonly price = computed(() => inr(this.event().price));
  protected readonly parts = computed(() => dayParts(this.event().startsAt));
  protected readonly soldPct = computed(() => Math.round((this.event().sold / this.event().capacity) * 100));

  protected open(): void {
    this.router.navigate(['/events', this.event().id]);
  }
}
