import { Component, ElementRef, OnInit, computed, inject, input, output, signal, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ArrowLeft,
  Building2,
  Check,
  CreditCard,
  Info,
  Landmark,
  LockKeyhole,
  LucideAngularModule,
  ShieldCheck,
  Smartphone,
  Tag,
  X,
} from 'lucide-angular';
import { ApiService, errorMessage } from '../core/api.service';
import { Order, PaymentAuthorization, PaymentMethod, Quote, Seat } from '../core/models';
import { StoreService } from '../core/store.service';
import { inr } from '../core/format';

type Step = 'review' | 'pay' | 'otp' | 'upi' | 'processing';
const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank'];

function brandOf(num: string): string {
  if (/^4/.test(num)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  if (/^(60|65|81|82|508)/.test(num)) return 'RuPay';
  return '';
}

/** Checkout with a realistic dummy payment gateway (card + OTP, UPI, net banking). */
@Component({
  selector: 'app-checkout-modal',
  imports: [FormsModule, LucideAngularModule, NgTemplateOutlet],
  host: { '(document:keydown.escape)': 'step() !== "processing" && closed.emit()' },
  template: `
    <div class="modal" (click)="step() !== 'processing' && closed.emit()">
      <section class="sheet checkout" (click)="$event.stopPropagation()">
        @if (step() !== 'processing') {
          <button class="close" aria-label="Close" (click)="closed.emit()"><lucide-icon [img]="icons.X" [size]="18" /></button>
        }
        <ol class="steps-bar">
          <li [class.done]="stepIndex() > 0" [class.on]="stepIndex() === 0">Review</li>
          <li [class.done]="stepIndex() > 1" [class.on]="stepIndex() === 1">Payment</li>
          <li [class.on]="stepIndex() === 2">Confirm</li>
        </ol>

        @switch (step()) {
          @case ('review') {
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
              <input [ngModel]="promoInput()" (ngModelChange)="promoInput.set($event.toUpperCase())" (keydown.enter)="apply()" placeholder="Promo code" aria-label="Promo code" />
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
            <ng-container *ngTemplateOutlet="totalsTpl" />
            <button class="btn btn-primary btn-lg block" [disabled]="quoting()" (click)="step.set('pay')">
              Continue to payment · {{ price(total()) }}
            </button>
          }

          @case ('pay') {
            <button class="back-link" (click)="step.set('review'); error.set('')"><lucide-icon [img]="icons.ArrowLeft" [size]="15" /> Back to review</button>
            <h2>Pay {{ price(total()) }}</h2>
            <div class="method-tabs" role="tablist">
              <button role="tab" [class.active]="method() === 'card'" (click)="setMethod('card')"><lucide-icon [img]="icons.CreditCard" [size]="17" /> Card</button>
              <button role="tab" [class.active]="method() === 'upi'" (click)="setMethod('upi')"><lucide-icon [img]="icons.Smartphone" [size]="17" /> UPI</button>
              <button role="tab" [class.active]="method() === 'netbanking'" (click)="setMethod('netbanking')"><lucide-icon [img]="icons.Landmark" [size]="17" /> Net banking</button>
            </div>

            @if (method() === 'card') {
              <div class="card-visual" [class.flipped]="cvvFocus()">
                <div class="card-face front">
                  <div class="card-top"><span class="chip-gold"></span><b>{{ brand() || 'Card' }}</b></div>
                  <div class="card-number">{{ cardNumberDisplay() }}</div>
                  <div class="card-bottom"><span><small>Card holder</small>{{ cardName || 'YOUR NAME' }}</span><span><small>Expires</small>{{ expiry || 'MM/YY' }}</span></div>
                </div>
                <div class="card-face back"><div class="stripe"></div><div class="cvv-box">{{ cvv ? '•'.repeat(cvv.length) : 'CVV' }}</div></div>
              </div>
              <div class="form-grid2">
                <label class="event-field span-2">Card number
                  <input inputmode="numeric" autocomplete="cc-number" [ngModel]="cardNumber" (ngModelChange)="onCardNumber($event)" placeholder="4242 4242 4242 4242" maxlength="23" />
                </label>
                <label class="event-field">Expiry
                  <input inputmode="numeric" autocomplete="cc-exp" [ngModel]="expiry" (ngModelChange)="onExpiry($event)" placeholder="MM/YY" maxlength="5" />
                </label>
                <label class="event-field">CVV
                  <input inputmode="numeric" autocomplete="cc-csc" type="password" [(ngModel)]="cvv" (focus)="cvvFocus.set(true)" (blur)="cvvFocus.set(false)" [maxlength]="brand() === 'Amex' ? 4 : 3" placeholder="123" />
                </label>
                <label class="event-field span-2">Name on card
                  <input autocomplete="cc-name" [(ngModel)]="cardName" placeholder="Asha Rao" />
                </label>
              </div>
            } @else if (method() === 'upi') {
              <label class="event-field">UPI ID
                <input [(ngModel)]="upiId" (keydown.enter)="authorize()" placeholder="yourname@okhdfcbank" autocomplete="off" />
              </label>
              <div class="upi-apps">
                @for (app of upiApps; track app) {
                  <button type="button" (click)="upiId = 'demo@' + app.toLowerCase().replace(' ', '')">{{ app }}</button>
                }
              </div>
            } @else {
              <div class="bank-grid">
                @for (b of banks; track b) {
                  <button type="button" [class.active]="bank() === b" (click)="bank.set(b)"><lucide-icon [img]="icons.Building2" [size]="16" /> {{ b }}</button>
                }
              </div>
            }

            @if (error()) {
              <div class="pay-error"><lucide-icon [img]="icons.Info" [size]="16" /> {{ error() }}</div>
            }
            <div class="test-hint">
              <lucide-icon [img]="icons.Info" [size]="14" />
              <span>Demo payments only. Card <b>4242 4242 4242 4242</b>, any future expiry, any CVV, OTP <b>123456</b>. Card <b>4000 0000 0000 0002</b> or UPI <b>fail&#64;upi</b> to see a decline.</span>
            </div>
            <button class="btn btn-primary btn-lg block" [disabled]="busy()" (click)="authorize()">
              <lucide-icon [img]="icons.LockKeyhole" [size]="16" /> {{ busy() ? 'Checking…' : 'Pay ' + price(total()) }}
            </button>
          }

          @case ('otp') {
            <div class="bank-page">
              <div class="bank-head"><lucide-icon [img]="icons.ShieldCheck" [size]="20" /><b>SecureBank verification</b></div>
              <p>Enter the one-time password sent to your registered mobile for <b>{{ auth()?.label }}</b>.</p>
              <div class="otp-amount">Amount: <b>{{ price(auth()?.amount ?? 0) }}</b> · Merchant: ScenePass</div>
              <div class="otp-boxes">
                @for (i of otpSlots; track i) {
                  <input
                    #otpBox
                    inputmode="numeric"
                    maxlength="1"
                    [value]="otp().charAt(i)"
                    (input)="onOtpInput(i, $event)"
                    (keydown.backspace)="onOtpBack(i, $event)"
                    (paste)="onOtpPaste($event)"
                    [attr.aria-label]="'OTP digit ' + (i + 1)"
                  />
                }
              </div>
              <small class="muted center">Demo OTP: <b>{{ auth()?.otpHint }}</b></small>
              @if (error()) {
                <div class="pay-error"><lucide-icon [img]="icons.Info" [size]="16" /> {{ error() }}</div>
              }
              <button class="btn btn-primary btn-lg block" [disabled]="otp().length < 6 || busy()" (click)="confirm()">Verify & pay</button>
              <button class="link-btn center" (click)="step.set('pay'); error.set('')">Cancel and choose another method</button>
            </div>
          }

          @case ('upi') {
            <div class="upi-wait">
              <div class="phone-pulse"><lucide-icon [img]="icons.Smartphone" [size]="34" /></div>
              <h2>Approve in your UPI app</h2>
              <p class="muted">A collect request for <b>{{ price(auth()?.amount ?? 0) }}</b> was sent to <b>{{ upiId }}</b>.</p>
              <div class="upi-timer"><i [style.width.%]="upiProgress()"></i></div>
              <small class="muted">Waiting for approval… (demo approves automatically)</small>
            </div>
          }

          @case ('processing') {
            <div class="upi-wait">
              <div class="spinner"></div>
              <h2>Confirming your booking…</h2>
              <p class="muted">Please don't close this window.</p>
            </div>
          }
        }

        <ng-template #totalsTpl>
          <div class="totals">
            <div><span>Subtotal</span><b>{{ price(quote()?.subtotal ?? subtotal()) }}</b></div>
            @if (quote()?.discount) {
              <div class="discount"><span>Discount</span><b>−{{ price(quote()!.discount) }}</b></div>
            }
            <div><span>Booking fee</span><b>Free</b></div>
            <div class="grand"><span>Total</span><b>{{ price(total()) }}</b></div>
            @if (splitWays() > 1) {
              <div class="split-note"><span>Split {{ splitWays() }} ways</span><b>{{ price(total() / splitWays()) }} each</b></div>
            }
          </div>
        </ng-template>
        @if (countdown() && step() !== 'processing') {
          <small class="fine-print"><lucide-icon [img]="icons.ShieldCheck" [size]="13" /> Seats held for {{ countdown() }} · free cancellation up to 2 hours before</small>
        }
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
  protected readonly icons = { ArrowLeft, Building2, Check, CreditCard, Info, Landmark, LockKeyhole, ShieldCheck, Smartphone, Tag, X };
  protected readonly banks = BANKS;
  protected readonly upiApps = ['GPay', 'PhonePe', 'Paytm', 'BHIM'];
  protected readonly otpSlots = [0, 1, 2, 3, 4, 5];
  private readonly otpBoxes = viewChildren<ElementRef<HTMLInputElement>>('otpBox');

  protected readonly step = signal<Step>('review');
  protected readonly quote = signal<Quote | null>(null);
  protected readonly quoting = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly promoInput = signal('');
  protected readonly method = signal<PaymentMethod>('card');
  protected readonly bank = signal('');
  protected readonly cvvFocus = signal(false);
  protected readonly auth = signal<PaymentAuthorization | null>(null);
  protected readonly otp = signal('');
  protected readonly upiProgress = signal(0);
  protected readonly brandSig = signal('');
  protected cardNumber = '';
  protected expiry = '';
  protected cvv = '';
  protected cardName = '';
  protected upiId = '';

  protected price = inr;
  protected subtotal = () => this.seats().reduce((sum, s) => sum + s.price, 0);
  protected readonly total = computed(() => this.quote()?.total ?? this.subtotal());
  protected readonly brand = this.brandSig.asReadonly();
  protected readonly stepIndex = computed(() => ({ review: 0, pay: 1, otp: 2, upi: 2, processing: 2 })[this.step()]);
  private readonly digits = signal('');
  protected readonly cardNumberDisplay = computed(() => (this.digits().padEnd(16, '•').match(/.{1,4}/g) ?? []).join(' '));

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

  protected setMethod(m: PaymentMethod): void {
    this.method.set(m);
    this.error.set('');
  }

  protected onCardNumber(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 19);
    this.digits.set(digits);
    this.brandSig.set(brandOf(digits));
    this.cardNumber = digits.replace(/(.{4})/g, '$1 ').trim();
  }

  protected onExpiry(value: string): void {
    const d = value.replace(/\D/g, '').slice(0, 4);
    this.expiry = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  protected async authorize(): Promise<void> {
    this.error.set('');
    const method = this.method();
    if (method === 'netbanking' && !this.bank()) return this.error.set('Choose your bank');
    this.busy.set(true);
    try {
      const auth = await firstValueFrom(
        this.api.authorizePayment({
          eventId: this.eventId(),
          seats: this.seats().map((s) => s.id),
          promoCode: this.quote()?.promo?.code ?? null,
          roomCode: this.roomCode(),
          method,
          card: method === 'card' ? { number: this.cardNumber, expiry: this.expiry, cvv: this.cvv, name: this.cardName } : undefined,
          upiId: method === 'upi' ? this.upiId : undefined,
          bank: method === 'netbanking' ? this.bank() : undefined,
        }),
      );
      this.auth.set(auth);
      if (auth.otpRequired) {
        this.otp.set('');
        this.step.set('otp');
        setTimeout(() => this.otpBoxes()[0]?.nativeElement.focus(), 50);
      } else {
        this.waitForUpi();
      }
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  /** Simulates the customer approving a UPI collect request in their app. */
  private waitForUpi(): void {
    this.step.set('upi');
    this.upiProgress.set(0);
    const started = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(100, ((Date.now() - started) / 3500) * 100);
      this.upiProgress.set(p);
      if (p >= 100) {
        clearInterval(timer);
        this.confirm();
      }
    }, 100);
  }

  protected onOtpInput(i: number, e: Event): void {
    const input = e.target as HTMLInputElement;
    const digit = input.value.replace(/\D/g, '').slice(-1);
    const chars = this.otp().padEnd(6, ' ').split('');
    chars[i] = digit || ' ';
    this.otp.set(chars.join('').trimEnd().replace(/ /g, ''));
    input.value = digit;
    if (digit) this.otpBoxes()[i + 1]?.nativeElement.focus();
    if (this.otp().length === 6) this.confirm();
  }

  protected onOtpBack(i: number, e: Event): void {
    if (!(e.target as HTMLInputElement).value) this.otpBoxes()[i - 1]?.nativeElement.focus();
  }

  protected onOtpPaste(e: ClipboardEvent): void {
    const digits = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    this.otp.set(digits);
    if (digits.length === 6) this.confirm();
  }

  protected async confirm(): Promise<void> {
    const auth = this.auth();
    if (!auth || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.step.set('processing');
    try {
      const order = await firstValueFrom(
        this.api.createOrder({
          eventId: this.eventId(),
          seats: this.seats().map((s) => s.id),
          promoCode: this.quote()?.promo?.code ?? null,
          roomCode: this.roomCode(),
          authId: auth.authId,
          otp: auth.otpRequired ? this.otp() : undefined,
        }),
      );
      this.store.orders.update((orders) => [order, ...orders]);
      this.store.refreshEvents();
      this.booked.emit(order);
    } catch (err) {
      const msg = errorMessage(err);
      this.error.set(msg);
      if (/otp/i.test(msg) && !/cancelled/i.test(msg)) {
        this.step.set('otp');
        this.otp.set('');
        setTimeout(() => this.otpBoxes()[0]?.nativeElement.focus(), 50);
      } else {
        this.step.set('pay');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
