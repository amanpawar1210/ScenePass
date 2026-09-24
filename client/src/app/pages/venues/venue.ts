import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ArrowLeft, Armchair, LucideAngularModule, MapPin, Navigation, Star } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { VenueDetail } from '../../core/models';
import { initialsOf, posterStyle, shortDate } from '../../core/format';
import { EventCard } from '../../shared/event-card';
import { Stars } from '../../shared/stars';

@Component({
  selector: 'app-venue',
  imports: [LucideAngularModule, EventCard, Stars],
  template: `
    <div class="container page">
      <button class="back-link" (click)="router.navigateByUrl('/venues')"><lucide-icon [img]="icons.ArrowLeft" [size]="16" /> All venues</button>
      @if (venue(); as v) {
        <section class="venue-hero card">
          <div class="art-frame"><div class="venue-hero-art art-wide" [class.custom-img]="!!v.imageUrl" [style]="poster(v, 1100)"></div></div>
          <div class="venue-hero-body">
            <small class="eyebrow">{{ v.city }}</small>
            <h1>{{ v.name }}</h1>
            <p class="muted"><lucide-icon [img]="icons.MapPin" [size]="15" /> {{ v.address }}, {{ v.city }}</p>
            <div class="stat-row">
              <div>
                @if (v.rating.count) {
                  <b>{{ v.rating.avg.toFixed(1) }}</b><app-stars [value]="v.rating.avg" [size]="14" /><small class="muted">{{ v.rating.count }} reviews</small>
                } @else {
                  <b>New</b><small class="muted">No reviews yet</small>
                }
              </div>
              <div><b>{{ v.events.length }}</b><small class="muted">upcoming events</small></div>
              <div><b><lucide-icon [img]="icons.Armchair" [size]="18" /> {{ v.layout.rows * v.layout.seatsPerRow }}</b><small class="muted">seats</small></div>
            </div>
            <a class="btn btn-outline" [href]="mapUrl()" target="_blank" rel="noopener"><lucide-icon [img]="icons.Navigation" [size]="16" /> Get directions</a>
          </div>
        </section>

        <section class="section">
          <header class="section-head"><div><h2>Upcoming at {{ v.name }}</h2></div></header>
          <div class="event-grid">
            @for (e of v.events; track e.id) {
              <app-event-card [event]="e" />
            } @empty {
              <p class="muted">No upcoming events here right now.</p>
            }
          </div>
        </section>

        <section class="section">
          <header class="section-head"><div><h2>What people say</h2></div></header>
          <div class="review-grid">
            @for (rev of v.reviews; track rev.id) {
              <article class="card review">
                <span class="avatar-sm">{{ initials(rev.userName) }}</span>
                <div>
                  <div class="review-head"><b>{{ rev.userName }}</b><app-stars [value]="rev.rating" [size]="13" /></div>
                  <small class="muted">{{ rev.eventTitle ? 'Attended ' + rev.eventTitle + ' · ' : '' }}{{ date(rev.createdAt) }}</small>
                  @if (rev.comment) {
                    <p>{{ rev.comment }}</p>
                  }
                </div>
              </article>
            } @empty {
              <p class="muted">No reviews yet.</p>
            }
          </div>
        </section>
      } @else if (error()) {
        <div class="empty-block"><h3>{{ error() }}</h3><button class="btn btn-primary" (click)="router.navigateByUrl('/venues')">All venues</button></div>
      } @else {
        <div class="skeleton-block"></div>
      }
    </div>
  `,
})
export class VenuePage {
  /** Route param `:slug`. */
  readonly slug = input.required<string>();
  protected router = inject(Router);
  private api = inject(ApiService);
  protected readonly icons = { ArrowLeft, Armchair, MapPin, Navigation, Star };
  protected readonly venue = signal<VenueDetail | null>(null);
  protected readonly error = signal('');
  protected readonly mapUrl = computed(() => {
    const v = this.venue();
    return v ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name}, ${v.address}, ${v.city}`)}` : '#';
  });

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(async () => {
        this.venue.set(null);
        try {
          this.venue.set(await firstValueFrom(this.api.venue(slug)));
        } catch (err) {
          this.error.set(errorMessage(err));
        }
      });
    });
  }

  protected poster = posterStyle;
  protected date = shortDate;
  protected initials = initialsOf;
}
