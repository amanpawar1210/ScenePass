import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ArrowRight, CalendarDays, Heart, LucideAngularModule, MapPin, Star, X } from 'lucide-angular';
import { StoreService } from '../core/store.service';
import { categoryLabel, countdownLabel, inr, posterStyle, shortDate, timeOf } from '../core/format';

/** Lightweight event preview opened from a card, without leaving the page. */
@Component({
  selector: 'app-quick-view',
  imports: [LucideAngularModule],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    @if (store.quickView(); as e) {
      <div class="modal" (click)="close()">
        <section class="quick-view" (click)="$event.stopPropagation()">
          <button class="close" aria-label="Close" (click)="close()"><lucide-icon [img]="icons.X" [size]="18" /></button>
          <div class="qv-art art-square" [class.custom-img]="!!e.imageUrl" [style]="poster()"></div>
          <div class="qv-body">
            <div class="chip-row">
              <span class="chip chip-brand">{{ label() }}</span>
              @if (countdown()) {
                <span class="chip chip-live"><i class="pulse-dot"></i>{{ countdown() }}</span>
              }
            </div>
            <h2>{{ e.title }}</h2>
            <p class="muted">{{ e.sub }}</p>
            <div class="meta-row">
              <span><lucide-icon [img]="icons.CalendarDays" [size]="15" /> {{ date() }} · {{ time() }}</span>
              <span><lucide-icon [img]="icons.MapPin" [size]="15" /> {{ e.venue }}, {{ e.city }}</span>
              @if (e.rating.count) {
                <span class="rating"><lucide-icon [img]="icons.Star" [size]="14" /> {{ e.rating.avg.toFixed(1) }} <small>({{ e.rating.count }})</small></span>
              }
            </div>
            <div class="qv-tiers">
              @for (t of e.tiers; track t.name) {
                <div><small>{{ t.name }}</small><b>{{ price(t.price) }}</b></div>
              }
            </div>
            <div class="qv-seats">
              <div class="progress"><i [style.width.%]="(e.sold / e.capacity) * 100"></i></div>
              <small class="muted">{{ e.seatsLeft }} of {{ e.capacity }} seats left</small>
            </div>
            <div class="row-gap">
              <button class="btn btn-primary" [disabled]="e.seatsLeft <= 0" (click)="go(['/events', e.id, 'seats'])">
                {{ e.seatsLeft > 0 ? 'Select seats' : 'Sold out' }}
              </button>
              <button class="btn btn-outline" (click)="go(['/events', e.id])">Full details <lucide-icon [img]="icons.ArrowRight" [size]="16" /></button>
              <button class="icon-btn-round" [class.saved-round]="saved()" [attr.aria-label]="saved() ? 'Unsave' : 'Save'" (click)="store.toggleFavourite(e.id)">
                <lucide-icon [img]="icons.Heart" [size]="17" />
              </button>
            </div>
          </div>
        </section>
      </div>
    }
  `,
})
export class QuickView {
  protected store = inject(StoreService);
  private router = inject(Router);
  protected readonly icons = { ArrowRight, CalendarDays, Heart, MapPin, Star, X };
  private readonly e = computed(() => this.store.quickView()!);
  protected readonly poster = computed(() => posterStyle(this.e(), 700));
  protected readonly label = computed(() => categoryLabel(this.e().type));
  protected readonly date = computed(() => shortDate(this.e().startsAt));
  protected readonly time = computed(() => timeOf(this.e().startsAt));
  protected readonly countdown = computed(() => countdownLabel(this.e().startsAt, this.e().endsAt, this.store.now()));
  protected readonly saved = computed(() => this.store.favourites().includes(this.e().id));
  protected price = inr;

  protected close(): void {
    this.store.quickView.set(null);
  }

  protected go(path: unknown[]): void {
    this.close();
    this.router.navigate(path);
  }
}
