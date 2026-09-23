import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LucideAngularModule, Sparkles } from 'lucide-angular';
import { StoreService } from './core/store.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LucideAngularModule],
  template: `
    <router-outlet />
    @if (store.toast()) {
      <div class="toast"><lucide-icon [img]="Sparkles" [size]="16" />{{ store.toast() }}</div>
    }
  `,
})
export class App {
  protected store = inject(StoreService);
  protected readonly Sparkles = Sparkles;
}
