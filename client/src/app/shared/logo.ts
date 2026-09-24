import { Component, input } from '@angular/core';
import { LucideAngularModule, Ticket } from 'lucide-angular';

/** ScenePass mark (emerald tile with a ticket) and a single-colour wordmark. */
@Component({
  selector: 'app-logo',
  imports: [LucideAngularModule],
  host: { class: 'logo', '[class.logo-lg]': 'size() === "lg"' },
  template: `
    <span class="logo-mark"><lucide-icon [img]="Ticket" [size]="size() === 'lg' ? 24 : 17" [strokeWidth]="2.4" /></span>
    @if (showName()) {
      <span class="logo-word">ScenePass</span>
    }
  `,
})
export class Logo {
  readonly size = input<'md' | 'lg'>('md');
  readonly showName = input(true);
  protected readonly Ticket = Ticket;
}
