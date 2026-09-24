import { Component, computed, input, model } from '@angular/core';
import { LucideAngularModule, Star } from 'lucide-angular';

/** Star rating. Read-only by default; set `editable` to let people pick 1–5. */
@Component({
  selector: 'app-stars',
  imports: [LucideAngularModule],
  host: { class: 'stars', '[class.editable]': 'editable()' },
  template: `
    @for (i of five; track i) {
      @if (editable()) {
        <button type="button" [class.on]="i <= value()" [attr.aria-label]="i + ' star' + (i > 1 ? 's' : '')" (click)="value.set(i)">
          <lucide-icon [img]="Star" [size]="size()" />
        </button>
      } @else {
        <span [class.on]="i <= rounded()"><lucide-icon [img]="Star" [size]="size()" /></span>
      }
    }
  `,
})
export class Stars {
  readonly value = model(0);
  readonly editable = input(false);
  readonly size = input(15);
  protected readonly Star = Star;
  protected readonly five = [1, 2, 3, 4, 5];
  protected readonly rounded = computed(() => Math.round(this.value()));
}
