import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/** Animates a number from its previous value to the new one, e.g. <b [appCountUp]="36"></b>. */
@Directive({ selector: '[appCountUp]' })
export class CountUp {
  readonly appCountUp = input.required<number>();
  /** Optional formatter, e.g. rupees. */
  readonly countFormat = input<(n: number) => string>((n) => Math.round(n).toLocaleString('en-IN'));
  private el = inject(ElementRef<HTMLElement>);
  private current = 0;

  constructor() {
    effect((onCleanup) => {
      const target = this.appCountUp();
      const format = this.countFormat();
      const from = this.current;
      const start = performance.now();
      const duration = 900;
      let frame = 0;
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        this.current = from + (target - from) * eased;
        this.el.nativeElement.textContent = format(this.current);
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      onCleanup(() => cancelAnimationFrame(frame));
    });
  }
}
