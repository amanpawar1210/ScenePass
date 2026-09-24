import { Component, effect, input, signal } from '@angular/core';
import QRCode from 'qrcode';

/** Renders a scannable QR code for a ticket code. */
@Component({
  selector: 'app-qr-code',
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="'QR code for ' + value()" [width]="size()" [height]="size()" />
    }
  `,
})
export class QrCode {
  readonly value = input.required<string>();
  readonly size = input(132);
  protected readonly src = signal('');

  constructor() {
    effect(() => {
      const value = this.value();
      QRCode.toDataURL(value, { margin: 1, width: this.size() * 2, color: { dark: '#2b1d21', light: '#fffdf8' } })
        .then((url) => this.src.set(url))
        .catch(() => this.src.set(''));
    });
  }
}
