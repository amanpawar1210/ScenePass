import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Check, CreditCard, LucideAngularModule, ShieldCheck, Tag, X } from 'lucide-angular';
import { ApiService, errorMessage } from '../core/api.service';
import { Order, Quote, Seat } from '../core/models';
import { StoreService } from '../core/store.service';
import { inr } from '../core/format';

/** Checkout with server-side pricing and promo codes; used for solo and group bookings. */
@Component({
  selector: 'app-checkout-modal',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="modal" (click)="closed.emit()">
      <section class="sheet" (click)="$event.stopPropagation()">
        <button class="close" aria-label="Close" (click)="closed.emit()"><lucide-icon [img]="icons.X" [size]="18" /></button>
        <span class="eyebrow">Checkout</span>
        <h2>{{ title() }}</h2>
        @if (subtitle()) {
          <p class="muted">{{ subtitle() }}</p>
        }

        <div class="line-items">
          @for (seat of seats(); track seat.id) {
            <div><span>{{ seat.tier }} · Seat {{ seat.id }}</span><b>{{ price(seat.price) }}</b></div>
          }
        </div>

        <div class="promo-box">
          <lucide-icon [img]="icons.Tag" [size]="16" />
          <input
            [ngModel]="promoInput()"
            (ngModelChange)="promoInput.set($event.toUpperCase())"
            (keydown.enter)="apply()"
            placeholder="Promo code"
            aria-label="Promo code"
          />
          @if (quote()?.promo) {
            <button type="button" (click)="remove()">Remove</button>
          } @else {
            <button type="button" [disabled]="!promoInput().trim() || quoting()" (click)="apply()">Apply</button>
          }
        </div>
        @if (quote()?.promoError) {
          <small class="promo-msg error">{{ quote()!.promoError }}</small>
        } @else if (quote()?.promo) {
          <small class="promo-msg ok"><lucide-icon [img]="icons.Check" [size]="13" /> {{ quote()!.promo!.code }} applied · {{ quote()!.promo!.description }}</small>
        } @else if (store.promos().length) {
          <div class="promo-suggestions">
            @for (p of store.promos(); track p.code) {
              <button type="button" [title]="p.description" (click)="promoInput.set(p.code); apply()">{{ p.code }}</button>
            }
          </div>
        }

        <div class="pay-method">
          <lucide-icon [img]="icons.CreditCard" [size]="20" />
          <span><b>Demo card ending 4242</b><small>No real payment is taken</small></span>
          <lucide-icon [img]="icons.Check" [size]="18" />
        </div>

        <div class="totals">
          <div><span>Subtotal</span><b>{{ price(quote()?.subtotal ?? subtotal()) }}</b></div>
          @if (quote()?.discount) {
            <div class="discount"><span>Discount</span><b>−{{ price(quote()!.discount) }}</b></div>
          }
          <div><span>Booking fee</span><b>Free</b></div>
          <div class="grand"><span>Total</span><b>{{ price(quote()?.total ?? subtotal()) }}</b></div>
          @if (splitWays() > 1) {
            <div class="split-note"><span>Split {{ splitWays() }} ways</span><b>{{ price((quote()?.total ?? subtotal()) / splitWays()) }} each</b></div>
          }
        </div>

        <button class="btn btn-primary btn-lg block" [disabled]="paying() || quoting()" (click)="pay()">
          {{ paying() ? 'Confirming…' : 'Pay ' + price(quote()?.total ?? subtotal()) }}
        </button>
        <small class="fine-print"><lucide-icon [img]="icons.ShieldCheck" [size]="13" /> Free cancellation up to 2 hours before the show
          @if (countdown()) { · seats held for {{ countdown() }} }</small>
      </section>
    </div>
  `,
})
export class CheckoutModal implements OnInit {
  readonly eventId = input.required<string>();
  readonly seats = input.required<Seat[]>();
  readonly title = input('One step from the scene');
  readonly subtitle = input('');
  readonly roomCode = input<string | undefined>(undefined);
  readonly splitWays = input(1);
  readonly countdown = input('');
  readonly closed = output<void>();
  readonly booked = output<Order>();

  protected store = inject(StoreService);
  private api = inject(ApiService);
  protected readonly icons = { Check, CreditCard, ShieldCheck, Tag, X };
  protected readonly quote = signal<Quote | null>(null);
  protected readonly quoting = signal(false);
  protected readonly paying = signal(false);
  protected readonly promoInput = signal('');
  protected price = inr;
  protected subtotal = () => this.seats().reduce((sum, s) => sum + s.price, 0);

  ngOnInit(): void {
    this.refresh('');
  }

  protected apply(): void {
    this.refresh(this.promoInput().trim());
  }

  protected remove(): void {
    this.promoInput.set('');
    this.refresh('');
  }

  private async refresh(code: string): Promise<void> {
    this.quoting.set(true);
    try {
      this.quote.set(await firstValueFrom(this.api.quote(this.eventId(), this.seats().map((s) => s.id), code)));
    } catch (err) {
      this.store.notify(errorMessage(err));
    } finally {
      this.quoting.set(false);
    }
  }

  protected async pay(): Promise<void> {
    this.paying.set(true);
    try {
      const order = await firstValueFrom(
        this.api.createOrder(this.eventId(), this.seats().map((s) => s.id), this.quote()?.promo?.code ?? null, this.roomCode()),
      );
      this.store.orders.update((orders) => [order, ...orders]);
      this.store.refreshEvents();
      this.booked.emit(order);
    } catch (err) {
      this.store.notify(errorMessage(err));
      this.closed.emit();
    } finally {
      this.paying.set(false);
    }
  }
}
