import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, QrCode, Ticket } from 'lucide-angular';
import { StoreService } from '../../core/store.service';

@Component({
  selector: 'app-tickets',
  imports: [DatePipe, LucideAngularModule],
  template: `
    <section class="simple-page">
      <div class="page-kicker"><lucide-icon [img]="icons.Ticket" /> YOUR WALLET</div>
      <h1>Every ticket.<br /><em>Ready at the door.</em></h1>
      @if (latest(); as order) {
        <div class="ticket-card">
          <div>
            <span>SCENEPASS · ADMIT {{ order.seats.length }}</span>
            <h2>{{ order.event.title }}</h2>
            <p>{{ order.event.date }} · {{ order.event.venue }}</p>
            <b>{{ order.seats.join(' · ') }}</b>
          </div>
          <lucide-icon [img]="icons.QrCode" [size]="92" />
        </div>
        <div class="order-history">
          <h2>Booking history</h2>
          @for (order of store.orders(); track order.id) {
            <article>
              <div>
                <b>{{ order.event.title }}</b>
                <small>{{ order.code }} · {{ order.createdAt | date: 'd/M/yyyy' }} · {{ order.seats.join(', ') }}</small>
              </div>
              <strong>{{ order.total ? '₹' + order.total.toLocaleString('en-IN') : 'Confirmed' }}</strong>
            </article>
          }
        </div>
      } @else {
        <div class="empty-state">
          <lucide-icon [img]="icons.Ticket" [size]="42" />
          <h2>No tickets yet</h2>
          <p>Your confirmed bookings and offline QR passes will live here.</p>
          <button (click)="router.navigateByUrl('/discover')">Discover events</button>
        </div>
      }
    </section>
  `,
})
export class TicketsPage {
  protected store = inject(StoreService);
  protected router = inject(Router);
  protected readonly icons = { QrCode, Ticket };
  protected readonly latest = computed(() => this.store.orders()[0] ?? null);
}
