import { Component, DestroyRef, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import jsQR from 'jsqr';
import { Camera, CameraOff, ImageUp, LucideAngularModule } from 'lucide-angular';

/** Pulls a ticket code out of a scanned QR (a /verify/<code> URL or a bare code). */
export function ticketCodeFrom(text: string): string | null {
  const match = text.match(/TK-[A-Z0-9]{6,}/i);
  return match ? match[0].toUpperCase() : null;
}

/** Camera QR scanner (jsQR) with a photo-upload fallback for devices without a camera. */
@Component({
  selector: 'app-qr-scanner',
  imports: [LucideAngularModule],
  template: `
    <div class="scanner">
      @if (active()) {
        <div class="scanner-view">
          <video #video playsinline muted></video>
          <div class="scanner-frame"><i></i></div>
        </div>
      }
      <div class="scanner-actions">
        @if (active()) {
          <button class="btn btn-outline" (click)="stop()"><lucide-icon [img]="icons.CameraOff" [size]="16" /> Stop camera</button>
        } @else {
          <button class="btn btn-primary" (click)="start()"><lucide-icon [img]="icons.Camera" [size]="16" /> Scan with camera</button>
        }
        <label class="btn btn-outline file-btn">
          <lucide-icon [img]="icons.ImageUp" [size]="16" /> Scan from photo
          <input type="file" accept="image/*" (change)="fromFile($event)" />
        </label>
      </div>
      @if (message()) {
        <small class="muted">{{ message() }}</small>
      }
    </div>
  `,
})
export class QrScanner {
  readonly scanned = output<string>();
  protected readonly icons = { Camera, CameraOff, ImageUp };
  protected readonly active = signal(false);
  protected readonly message = signal('');
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private stream: MediaStream | null = null;
  private frame = 0;
  private lastCode = '';
  private canvas = document.createElement('canvas');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected async start(): Promise<void> {
    this.message.set('');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.message.set('Camera access needs HTTPS or localhost. Use "Scan from photo" instead.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      this.active.set(true);
      setTimeout(async () => {
        const video = this.video()?.nativeElement;
        if (!video || !this.stream) return;
        video.srcObject = this.stream;
        await video.play();
        this.loop();
      });
    } catch {
      this.message.set('Camera permission was denied or no camera was found.');
    }
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.active.set(false);
  }

  private loop(): void {
    const video = this.video()?.nativeElement;
    if (!video || !this.stream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const code = this.decode(video, video.videoWidth, video.videoHeight);
      // Ignore the same code while it stays in view, so each ticket fires once.
      if (code && code !== this.lastCode) {
        this.lastCode = code;
        navigator.vibrate?.(80);
        this.scanned.emit(code);
        setTimeout(() => (this.lastCode = ''), 3000);
      }
    }
    this.frame = requestAnimationFrame(() => this.loop());
  }

  private decode(source: CanvasImageSource, width: number, height: number): string | null {
    if (!width || !height) return null;
    const scale = Math.min(1, 800 / Math.max(width, height));
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
    const data = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const result = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
    return result ? ticketCodeFrom(result.data) : null;
  }

  protected fromFile(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const code = this.decode(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(img.src);
      if (code) this.scanned.emit(code);
      else this.message.set('No ScenePass QR code found in that photo.');
    };
    img.src = URL.createObjectURL(file);
  }
}
