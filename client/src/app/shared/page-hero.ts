import { Component, input } from '@angular/core';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';

/**
 * Colourful page header used across pages: eyebrow, title, subtitle, any extra
 * content (stats, search, actions) and an optional aside (e.g. a highlight card).
 */
@Component({
  selector: 'app-page-hero',
  imports: [LucideAngularModule],
  template: `
    <section class="page-hero">
      <span class="blob b1"></span><span class="blob b2"></span>
      <div class="page-hero-main">
        <span class="chip chip-live-soft">
          @if (icon(); as i) {
            <lucide-icon [img]="i" [size]="14" />
          }
          {{ eyebrow() }}
        </span>
        <h1>{{ title() }} @if (highlight()) {<span class="hl">{{ highlight() }}</span>}</h1>
        @if (subtitle()) {
          <p class="lead">{{ subtitle() }}</p>
        }
        <ng-content />
      </div>
      <div class="page-hero-aside"><ng-content select="[aside]" /></div>
    </section>
  `,
})
export class PageHero {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  /** Optional trailing words rendered in the brand colour. */
  readonly highlight = input('');
  readonly subtitle = input('');
  readonly icon = input<LucideIconData | null>(null);
}
