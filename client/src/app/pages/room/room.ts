import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule, Share2, Users } from 'lucide-angular';
import { AuthService } from '../../core/auth.service';
import { StoreService } from '../../core/store.service';

@Component({
  selector: 'app-room',
  imports: [LucideAngularModule],
  template: `
    <section class="simple-page">
      <div class="page-kicker"><lucide-icon [img]="icons.Users" /> GROUP BOOKING PREVIEW</div>
      <h1>Book together.<br /><em>Decide without chaos.</em></h1>
      <p>Preview a group seat vote. Shared rooms are simulated in this demo.</p>
      <div class="room-board">
        <section>
          <header>
            <span>DEMO ROOM SP–9248</span>
            <button (click)="copyInvite()"><lucide-icon [img]="icons.Share2" [size]="15" /> Copy invite</button>
          </header>
          <div class="member">
            <span>YOU</span>
            <div><b>{{ auth.user()?.name }}</b><small>Host · {{ store.selectedSeats().length }} seats selected</small></div>
            <em>READY</em>
          </div>
          <div class="member">
            <span>NK</span>
            <div><b>Nina · demo participant</b><small>Viewing Row C</small></div>
            <em>CHOOSING</em>
          </div>
          <div class="member">
            <span>JM</span>
            <div><b>Jay · demo participant</b><small>Voted for C7–C10</small></div>
            <em>READY</em>
          </div>
          <button class="continue" [disabled]="!store.selectedEvent()" (click)="openSeatMap()">Open seat map</button>
        </section>
        <aside>
          <span>GROUP VOTE · DEMO</span>
          <h2>Row C · seats 7–10</h2>
          <div class="vote">
            <b>{{ voted() ? '4 of 4' : '3 of 4' }} agree</b>
            <i><em [style.width]="voted() ? '100%' : '75%'"></em></i>
          </div>
          <button (click)="toggleVote()">{{ voted() ? 'Remove my vote' : 'Vote for these seats' }}</button>
        </aside>
      </div>
    </section>
  `,
})
export class RoomPage {
  protected auth = inject(AuthService);
  protected store = inject(StoreService);
  private router = inject(Router);
  protected readonly icons = { Share2, Users };
  protected readonly voted = signal(false);

  protected copyInvite(): void {
    navigator.clipboard?.writeText(`${location.origin}/room`);
    this.store.notify('Demo room link copied');
  }

  protected toggleVote(): void {
    this.store.notify(this.voted() ? 'Vote removed' : 'Vote recorded');
    this.voted.update((v) => !v);
  }

  protected openSeatMap(): void {
    const event = this.store.selectedEvent();
    if (event) this.router.navigate(['/events', event.id, 'seats']);
  }
}
