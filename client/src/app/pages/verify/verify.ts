import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CalendarDays, CircleAlert, CircleCheck, CircleX, Clock, LucideAngularModule, MapPin, ScanLine } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { TicketVerification } from '../../core/models';
import { fullDateTime, posterStyle } from '../../core/format';
import { Logo } from '../../shared/logo';

const STATUS = {
  valid: { title: 'Valid ticket', note: 'This ticket has not been used yet.', tone: 'ok' },
  checked_in: { title: 'Already checked in', note: 'This ticket was scanned at the entrance.', tone: 'warn' },
  cancelled: { title: 'Cancelled ticket', note: 'This booking was cancelled and refunded.', tone: 'bad' },
  expired: { title: 'Event has ended', note: 'This ticket is no longer valid for entry.', tone: 'muted' },
} as const;

/** Public page a QR code opens: anyone can check a ticket; organizers can check it in. */
@Component({
  selector: 'app-verify',
  imports: [LucideAngularModule, Logo],
  template: `
    <main class="verify-page">
      <button class="brand-btn" (click)="router.navigateByUrl('/')"><app-logo /></button>
      @if (ticket(); as t) {
        <section class="verify-card" [class]="'verify-card ' + status().tone">
          <div class="verify-art art-square" [class.custom-img]="!!t.event.imageUrl" [style]="poster()"></div>
          <div class="verify-status">
            <span class="status-icon">
              <lucide-icon [img]="t.status === 'valid' ? icons.CircleCheck : t.status === 'cancelled' ? icons.CircleX : icons.CircleAlert" [size]="34" />
            </span>
            <h1>{{ status().title }}</h1>
            <p>{{ status().note }}</p>
            @if (t.checkedInAt) {
              <small>Scanned {{ full(t.checkedInAt) }}</small>
            }
          </div>
          <div class="verify-body">
            <h2>{{ t.event.title }}</h2>
            <p><lucide-icon [img]="icons.CalendarDays" [size]="15" /> {{ full(t.event.startsAt) }}</p>
            <p><lucide-icon [img]="icons.MapPin" [size]="15" /> {{ t.event.venue }}, {{ t.event.city }}</p>
            <div class="verify-grid">
              <div><small>Seat</small><b>{{ t.seat }}</b></div>
              <div><small>Tier</small><b>{{ t.tier }}</b></div>
              <div><small>Guest</small><b>{{ t.holder }}</b></div>
            </div>
            <code>{{ t.code }} · {{ t.bookingCode }}</code>
            @if (auth.isAdmin() && t.status === 'valid') {
              <button class="btn btn-primary btn-lg block" [disabled]="busy()" (click)="checkIn()">
                <lucide-icon [img]="icons.ScanLine" [size]="18" /> Check in now
              </button>
            } @else if (!auth.user()) {
              <small class="muted center">Organizer? Sign in to check this ticket in.</small>
            }
          </div>
        </section>
      } @else if (error()) {
        <section class="verify-card bad">
          <div class="verify-status">
            <span class="status-icon"><lucide-icon [img]="icons.CircleX" [size]="34" /></span>
            <h1>Ticket not found</h1>
            <p>{{ error() }}</p>
          </div>
        </section>
      } @else {
        <div class="spinner"></div>
      }
      <small class="muted"><lucide-icon [img]="icons.Clock" [size]="13" /> Checked live against ScenePass records</small>
    </main>
  `,
})
export class VerifyPage {
  /** Route param `:code`. */
  readonly code = input.required<string>();
  protected router = inject(Router);
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  protected readonly icons = { CalendarDays, CircleAlert, CircleCheck, CircleX, Clock, MapPin, ScanLine };
  protected readonly ticket = signal<TicketVerification | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly status = computed(() => STATUS[this.ticket()?.status ?? 'valid']);
  protected readonly poster = computed(() => posterStyle(this.ticket()!.event, 400));
  protected full = fullDateTime;

  constructor() {
    effect(() => {
      const code = this.code();
      untracked(() => this.load(code));
    });
  }

  private async load(code: string): Promise<void> {
    try {
      this.ticket.set(await firstValueFrom(this.api.verifyTicket(code)));
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  protected async checkIn(): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.checkin(this.code()));
      navigator.vibrate?.(120);
    } catch {
      // The reload below shows the current state either way.
    } finally {
      await this.load(this.code());
      this.busy.set(false);
    }
  }
}
