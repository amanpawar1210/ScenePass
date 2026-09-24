import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ArrowRight, CreditCard, Link2, LucideAngularModule, MousePointerClick, Users } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { GroupRoom } from '../../core/models';
import { StoreService } from '../../core/store.service';
import { initialsOf, posterStyle, shortDate, timeOf } from '../../core/format';

@Component({
  selector: 'app-rooms',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="container page">
      <header class="page-head">
        <div>
          <small class="eyebrow">Group booking</small>
          <h1>Book together, sit together</h1>
          <p class="lead">Open a room for any event, share the link, and everyone picks seats on the same live map.</p>
        </div>
      </header>

      <section class="steps">
        <div class="step"><span><lucide-icon [img]="icons.Users" [size]="20" /></span><b>1. Open a room</b><small>Tap "Book with friends" on any event.</small></div>
        <div class="step"><span><lucide-icon [img]="icons.Link2" [size]="20" /></span><b>2. Share the invite</b><small>Friends join with the link or room code.</small></div>
        <div class="step"><span><lucide-icon [img]="icons.MousePointerClick" [size]="20" /></span><b>3. Pick seats live</b><small>Everyone's picks show up on one map.</small></div>
        <div class="step"><span><lucide-icon [img]="icons.CreditCard" [size]="20" /></span><b>4. Host checks out</b><small>See the per-person split at checkout.</small></div>
      </section>

      <section class="card join-card">
        <div>
          <h2>Got an invite code?</h2>
          <p class="muted">Enter the 6-character code a friend shared with you.</p>
        </div>
        <form class="join-form" (submit)="$event.preventDefault(); join()">
          <input [ngModel]="code()" (ngModelChange)="code.set($event.toUpperCase())" name="code" maxlength="6" placeholder="e.g. T3NUPZ" aria-label="Room code" />
          <button class="btn btn-primary" [disabled]="code().trim().length < 4">Join room <lucide-icon [img]="icons.ArrowRight" [size]="16" /></button>
        </form>
      </section>

      <section class="section">
        <header class="section-head"><div><h2>Your rooms</h2></div></header>
        @if (loading()) {
          <div class="skeleton-block short"></div>
        } @else {
          <div class="room-list">
            @for (room of rooms(); track room.id) {
              <button class="card room-row" (click)="router.navigate(['/rooms', room.code])">
                @if (room.event; as e) {
                  <div class="thumb art-square" [class.custom-img]="!!e.imageUrl" [style]="poster(e)"></div>
                  <div class="grow">
                    <b>{{ e.title }}</b>
                    <small class="muted">{{ date(e.startsAt) }} · {{ time(e.startsAt) }} · {{ e.venue }}</small>
                    <div class="avatar-stack">
                      @for (m of room.members; track m.user; let i = $index) {
                        <span class="avatar-sm" [attr.data-tone]="i % 6" [title]="m.name">{{ initials(m.name) }}</span>
                      }
                    </div>
                  </div>
                }
                <div class="room-meta">
                  <span [class]="'chip ' + (room.status === 'booked' ? 'chip-success' : 'chip-brand')">{{ room.status === 'booked' ? 'Booked' : 'Open' }}</span>
                  <small class="muted">{{ room.selection.length }} seats · code {{ room.code }}</small>
                </div>
              </button>
            } @empty {
              <div class="empty-block">
                <lucide-icon [img]="icons.Users" [size]="30" />
                <h3>No group rooms yet</h3>
                <p class="muted">Open any event and tap "Book with friends" to start one.</p>
                <button class="btn btn-primary" (click)="router.navigateByUrl('/discover')">Find an event</button>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
})
export class RoomsPage implements OnInit {
  protected router = inject(Router);
  private api = inject(ApiService);
  private store = inject(StoreService);
  protected readonly icons = { ArrowRight, CreditCard, Link2, MousePointerClick, Users };
  protected readonly rooms = signal<GroupRoom[]>([]);
  protected readonly loading = signal(true);
  protected readonly code = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.rooms.set(await firstValueFrom(this.api.rooms()));
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected join(): void {
    this.router.navigate(['/rooms', this.code().trim()]);
  }

  protected poster = posterStyle;
  protected date = shortDate;
  protected time = timeOf;
  protected initials = initialsOf;
}
