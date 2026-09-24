import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule, X } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { EventInput, EventItem } from '../../core/models';
import { StoreService } from '../../core/store.service';

const CATEGORY_LABELS: Record<string, string> = {
  'LIVE MUSIC': 'Live music',
  THEATRE: 'Theatre',
  COMEDY: 'Comedy',
  SPORT: 'Sport',
  MOVIE: 'Movie',
  FOOD: 'Food & drink',
  WORKSHOP: 'Workshop',
  DANCE: 'Dance',
  ART: 'Art',
  EXHIBITION: 'Exhibition',
};

/** Value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function eventToInput(e: EventItem): EventInput {
  return {
    title: e.title,
    sub: e.sub,
    description: e.description,
    type: e.type,
    startsAt: e.startsAt,
    durationMins: e.durationMins,
    venue: e.venue,
    address: e.address,
    city: e.city,
    language: e.language,
    ageLimit: e.ageLimit,
    prices: e.tiers.map((t) => t.price),
    lineup: e.lineup.map((l) => l.name).join(', '),
    tags: e.tags.join(', '),
    imageUrl: e.imageUrl,
    featured: e.featured,
    status: e.status,
  };
}

@Component({
  selector: 'app-event-form',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="modal" (click)="closed.emit()">
      <section class="wide-modal" (click)="$event.stopPropagation()">
        <button class="close" aria-label="Close" (click)="closed.emit()"><lucide-icon [img]="X" /></button>
        <span>ORGANIZER STUDIO</span>
        <h2>{{ event() ? 'Edit experience' : 'Publish a new event' }}.</h2>

        <div class="form-grid">
          <label class="event-field span-2">Event title<input [(ngModel)]="form.title" placeholder="Midnight Sessions" maxlength="80" /></label>
          <label class="event-field span-2">Tagline<input [(ngModel)]="form.sub" placeholder="An intimate late-night jazz set" maxlength="140" /></label>
          <label class="event-field">
            Category
            <select [(ngModel)]="form.type">
              @for (c of categories(); track c) {
                <option [value]="c">{{ label(c) }}</option>
              }
            </select>
          </label>
          <label class="event-field">
            City
            <select [(ngModel)]="form.city">
              @for (c of store.cities(); track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </label>
          <label class="event-field">Venue<input [(ngModel)]="form.venue" placeholder="Bangalore International Centre" /></label>
          <label class="event-field">Address<input [(ngModel)]="form.address" placeholder="Domlur 2nd Stage" /></label>
          <label class="event-field">Starts at<input type="datetime-local" [(ngModel)]="startsLocal" /></label>
          <label class="event-field">Duration (minutes)<input type="number" min="15" max="1440" step="15" [(ngModel)]="form.durationMins" /></label>

          <fieldset class="span-2 price-fields">
            <legend>Ticket prices (₹), front rows to back. Leave blank to use fewer tiers.</legend>
            <label class="event-field">Front<input type="number" min="1" [(ngModel)]="prices[0]" placeholder="2499" /></label>
            <label class="event-field">Middle<input type="number" min="1" [(ngModel)]="prices[1]" placeholder="1799" /></label>
            <label class="event-field">Back<input type="number" min="1" [(ngModel)]="prices[2]" placeholder="999" /></label>
          </fieldset>

          @if (!event()) {
            <label class="event-field">Rows<input type="number" min="4" max="20" [(ngModel)]="rows" /></label>
            <label class="event-field">Seats per row<input type="number" min="6" max="24" [(ngModel)]="seatsPerRow" /></label>
          }

          <label class="event-field span-2">
            Description
            <textarea rows="4" [(ngModel)]="form.description" maxlength="2000" placeholder="What makes this night special?"></textarea>
          </label>
          <label class="event-field">Lineup (comma separated)<input [(ngModel)]="form.lineup" placeholder="Artist one, Artist two" /></label>
          <label class="event-field">Tags (comma separated)<input [(ngModel)]="form.tags" placeholder="Jazz, Late night" /></label>
          <label class="event-field">Language<input [(ngModel)]="form.language" /></label>
          <label class="event-field">Age limit<input [(ngModel)]="form.ageLimit" placeholder="All ages" /></label>
          <label class="event-field span-2">Poster image URL (optional)<input [(ngModel)]="form.imageUrl" placeholder="https://…" /></label>

          <label class="toggle-field"><input type="checkbox" [(ngModel)]="form.featured" /> Feature on the Discover hero</label>
          <label class="toggle-field"><input type="checkbox" [ngModel]="form.status === 'draft'" (ngModelChange)="form.status = $event ? 'draft' : 'published'" /> Save as draft (hidden from customers)</label>
        </div>

        @if (error()) {
          <p class="form-error">{{ error() }}</p>
        }
        <button class="pay" [disabled]="saving()" (click)="save()">
          {{ saving() ? 'Saving…' : event() ? 'Save changes' : form.status === 'draft' ? 'Save draft' : 'Publish event' }}
        </button>
      </section>
    </div>
  `,
})
export class EventForm implements OnInit {
  readonly event = input<EventItem | null>(null);
  readonly saved = output<EventItem>();
  readonly closed = output<void>();

  protected store = inject(StoreService);
  private api = inject(ApiService);
  protected readonly X = X;
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected form!: EventInput;
  protected startsLocal = '';
  protected prices: (number | null)[] = [null, null, null];
  protected rows = 8;
  protected seatsPerRow = 14;

  protected categories = () => this.store.meta()?.categories ?? Object.keys(CATEGORY_LABELS);
  protected label = (c: string) => CATEGORY_LABELS[c] ?? c;

  ngOnInit(): void {
    const e = this.event();
    if (e) {
      this.form = eventToInput(e);
      this.startsLocal = toLocalInput(e.startsAt);
      this.prices = [0, 1, 2].map((i) => this.form.prices[i] ?? null);
    } else {
      const start = new Date(Date.now() + 14 * 86_400_000);
      start.setHours(20, 0, 0, 0);
      this.form = {
        title: '', sub: '', description: '', type: 'LIVE MUSIC', startsAt: '', durationMins: 120,
        venue: '', address: '', city: this.store.cities()[0], language: 'English', ageLimit: 'All ages',
        prices: [], lineup: '', tags: '', imageUrl: '', featured: false, status: 'published',
      };
      this.startsLocal = toLocalInput(start.toISOString());
      this.prices = [1999, 1299, 799];
    }
  }

  protected async save(): Promise<void> {
    const f = this.form;
    const prices = this.prices.map(Number).filter((p) => p > 0);
    if (f.title.trim().length < 3 || f.venue.trim().length < 3) return this.error.set('Title and venue need at least 3 characters.');
    if (!this.startsLocal) return this.error.set('Choose a date and time.');
    if (!prices.length) return this.error.set('Add at least one ticket price.');
    this.error.set('');

    const body: EventInput = {
      ...f,
      startsAt: new Date(this.startsLocal).toISOString(),
      durationMins: Number(f.durationMins),
      prices,
      ...(this.event() ? {} : { rows: Number(this.rows), seatsPerRow: Number(this.seatsPerRow) }),
    };
    this.saving.set(true);
    try {
      const id = this.event()?.id;
      const saved = await firstValueFrom(id ? this.api.updateEvent(id, body) : this.api.createEvent(body));
      this.saved.emit(saved);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
