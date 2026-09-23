import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Check, LayoutDashboard, LucideAngularModule, Plus, Trash2, X } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { CITIES, EventInput, EventItem } from '../../core/models';
import { StoreService } from '../../core/store.service';

const SAMPLE_TREND = [42, 58, 47, 71, 64, 82, 94].map((height, i) => ({ height, day: 'MTWTFSS'[i] }));
const OPERATIONS = ['Entry gates', 'Scanner devices', 'Food counters', 'Support crew'];

@Component({
  selector: 'app-studio',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <section class="simple-page studio">
      <div class="studio-heading">
        <div>
          <div class="page-kicker"><lucide-icon [img]="icons.LayoutDashboard" /> ORGANIZER STUDIO</div>
          <h1>Organizer overview.</h1>
        </div>
        <button (click)="openForm()"><lucide-icon [img]="icons.Plus" [size]="17" /> Create event</button>
      </div>
      <div class="metrics">
        <article><span>DEMO SALES</span><b>₹{{ grossSales().toLocaleString('en-IN') }}</b><em>{{ store.orders().length }} orders</em></article>
        <article><span>TICKETS SOLD</span><b>{{ soldSeats() }}</b><em>across all customers</em></article>
        <article><span>PUBLISHED EVENTS</span><b>{{ store.events().length }}</b><em>available to browse</em></article>
      </div>
      <div class="studio-grid">
        <section>
          <header><h2>Sample sales trend</h2><span>Illustrative data</span></header>
          <div class="bars">
            @for (bar of trend; track $index) {
              <i [style.height.%]="bar.height"><span>{{ bar.day }}</span></i>
            }
          </div>
        </section>
        <aside>
          <h2>Operations preview</h2>
          @for (item of operations; track item; let i = $index) {
            <div>
              <span><lucide-icon [img]="icons.Check" [size]="14" />{{ item }}</span>
              <b>{{ i === 2 ? '8 / 10' : 'Ready' }}</b>
            </div>
          }
        </aside>
      </div>
      <div class="admin-events">
        <header>
          <div><span>EVENT INVENTORY</span><h2>Published experiences</h2></div>
          <b>{{ store.events().length }} active</b>
        </header>
        @for (e of store.events(); track e.id) {
          <article>
            <div><b>{{ e.title }}</b><small>{{ e.date }} · {{ e.venue }}</small></div>
            <em>₹{{ e.price }}</em>
            <button [title]="'Edit ' + e.title" (click)="openForm(e)">Edit</button>
            <button [title]="'Unpublish ' + e.title" (click)="removeEvent(e)"><lucide-icon [img]="icons.Trash2" [size]="17" /></button>
          </article>
        }
      </div>
    </section>

    @if (showForm()) {
      <div class="modal">
        <section>
          <button class="close" aria-label="Close" (click)="showForm.set(false)"><lucide-icon [img]="icons.X" /></button>
          <span>ORGANIZER STUDIO</span>
          <h2>{{ editingId() ? 'Edit experience' : 'Publish a new event' }}.</h2>
          <label class="event-field">Event title<input autofocus [(ngModel)]="form.title" placeholder="Midnight Sessions" /></label>
          <label class="event-field">Date and time<input [(ngModel)]="form.date" placeholder="SAT · 02 NOV · 8 PM" /></label>
          <label class="event-field">Venue<input [(ngModel)]="form.venue" placeholder="Bengaluru International Centre" /></label>
          <label class="event-field">
            City
            <select [(ngModel)]="form.city">
              @for (option of cities; track option) {
                <option [value]="option">{{ option }}</option>
              }
            </select>
          </label>
          <label class="event-field">
            Starting price (₹)
            <input type="number" min="1" [(ngModel)]="form.price" (keydown.enter)="saveEvent()" />
          </label>
          <button class="pay" [disabled]="saving()" (click)="saveEvent()">
            {{ editingId() ? 'Save changes' : 'Publish event' }}
          </button>
        </section>
      </div>
    }
  `,
})
export class StudioPage {
  protected store = inject(StoreService);
  private api = inject(ApiService);
  protected readonly icons = { Check, LayoutDashboard, Plus, Trash2, X };
  protected readonly cities = CITIES;
  protected readonly trend = SAMPLE_TREND;
  protected readonly operations = OPERATIONS;

  protected readonly grossSales = computed(() => this.store.orders().reduce((sum, o) => sum + o.total, 0));
  protected readonly soldSeats = computed(() => this.store.orders().reduce((sum, o) => sum + o.seats.length, 0));

  protected readonly showForm = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected form: EventInput = this.emptyForm();

  protected openForm(event?: EventItem): void {
    this.editingId.set(event?.id ?? null);
    this.form = event
      ? { title: event.title, venue: event.venue, city: event.city, date: event.date, price: event.price }
      : this.emptyForm();
    this.showForm.set(true);
  }

  protected async saveEvent(): Promise<void> {
    const f = this.form;
    if (f.title.trim().length < 3 || f.venue.trim().length < 3 || !f.date.trim() || Number(f.price) < 1) {
      this.store.notify('Complete all event fields');
      return;
    }
    const id = this.editingId();
    const body: EventInput = { ...f, price: Number(f.price) };
    this.saving.set(true);
    try {
      if (id) {
        const updated = await firstValueFrom(this.api.updateEvent(id, body));
        this.store.events.update((events) => events.map((e) => (e.id === id ? updated : e)));
      } else {
        const created = await firstValueFrom(this.api.createEvent(body));
        this.store.events.update((events) => [...events, created]);
      }
      this.showForm.set(false);
      this.store.notify(id ? 'Event updated' : 'Event published to Discover');
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  protected async removeEvent(event: EventItem): Promise<void> {
    if (!confirm(`Unpublish "${event.title}"? Existing tickets stay valid.`)) return;
    try {
      await firstValueFrom(this.api.deleteEvent(event.id));
      this.store.events.update((events) => events.filter((e) => e.id !== event.id));
      this.store.notify('Event unpublished');
    } catch (err) {
      this.store.notify(errorMessage(err));
    }
  }

  private emptyForm(): EventInput {
    return { title: '', venue: '', city: 'Bengaluru', date: '', price: 999 };
  }
}
