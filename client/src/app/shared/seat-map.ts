import { Component, computed, input, output } from '@angular/core';
import { Seat, SeatMap } from '../core/models';
import { inr } from '../core/format';

interface SeatRow {
  label: string;
  tierStart?: { name: string; price: number };
  left: Seat[];
  right: Seat[];
}

/** One tag per seat picked in a group room, e.g. { A4: { initials: 'NK', tone: 2 } }. */
export type SeatTags = Record<string, { initials: string; tone: number }>;

@Component({
  selector: 'app-seat-map',
  template: `
    <div class="stage"><span>Stage</span></div>
    <div class="seat-legend">
      <span><i class="lg-available"></i>Available</span>
      <span><i class="lg-selected"></i>Selected</span>
      <span><i class="lg-held"></i>On hold</span>
      <span><i class="lg-booked"></i>Booked</span>
    </div>
    <div class="seat-rows">
      @for (row of rows(); track row.label) {
        @if (row.tierStart; as tier) {
          <div class="tier-divider"><span>{{ tier.name }} · {{ price(tier.price) }}</span></div>
        }
        <div class="seat-row">
          <em>{{ row.label }}</em>
          @for (block of [row.left, row.right]; track $index) {
            <div class="seat-block">
              @for (seat of block; track seat.id) {
                <button
                  type="button"
                  [class]="'seat ' + seatClass(seat)"
                  [attr.data-tone]="tags()[seat.id]?.tone"
                  [disabled]="!isSelectable(seat)"
                  [title]="seatTitle(seat)"
                  (click)="toggle.emit(seat)"
                >{{ tags()[seat.id]?.initials ?? seat.number }}</button>
              }
            </div>
          }
          <em>{{ row.label }}</em>
        </div>
      }
    </div>
  `,
  host: { class: 'seat-map-view' },
})
export class SeatMapView {
  readonly map = input.required<SeatMap>();
  readonly selected = input<string[]>([]);
  readonly tags = input<SeatTags>({});
  readonly toggle = output<Seat>();

  protected price = inr;

  protected readonly rows = computed<SeatRow[]>(() => {
    const map = this.map();
    const half = Math.ceil(map.layout.seatsPerRow / 2);
    const byRow = new Map<string, Seat[]>();
    for (const seat of map.seats) byRow.set(seat.row, [...(byRow.get(seat.row) ?? []), seat]);
    return [...byRow.entries()].map(([label, seats]) => {
      const tier = map.tiers.find((t) => t.rows[0] === label);
      return { label, tierStart: tier ? { name: tier.name, price: tier.price } : undefined, left: seats.slice(0, half), right: seats.slice(half) };
    });
  });

  protected seatClass(seat: Seat): string {
    if (this.selected().includes(seat.id)) return 'selected';
    return seat.status === 'mine' ? 'available' : seat.status;
  }

  protected isSelectable(seat: Seat): boolean {
    return seat.status === 'available' || seat.status === 'mine' || this.selected().includes(seat.id);
  }

  protected seatTitle(seat: Seat): string {
    const state = { available: 'available', mine: 'held by you', held: 'on hold', booked: 'booked', blocked: 'unavailable' }[seat.status];
    const tag = this.tags()[seat.id];
    return `${seat.id} · ${seat.tier} · ${inr(seat.price)} · ${tag ? 'picked by ' + tag.initials : state}`;
  }
}
