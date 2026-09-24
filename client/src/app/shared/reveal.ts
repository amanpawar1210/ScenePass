import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

// One shared observer for every element that should fade in on scroll.
let observer: IntersectionObserver | null = null;
function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer!.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -40px 0px', threshold: 0.08 },
  );
  return observer;
}

/** Fades and slides an element in the first time it scrolls into view. */
@Directive({ selector: '[appReveal]', host: { class: 'reveal' } })
export class Reveal implements OnInit, OnDestroy {
  /** Stagger index, e.g. the item's position in a grid. */
  readonly appReveal = input<number | ''>('');
  private el = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    const node = this.el.nativeElement as HTMLElement;
    const index = Number(this.appReveal()) || 0;
    node.style.setProperty('--reveal-delay', `${Math.min(index % 8, 7) * 55}ms`);
    const obs = getObserver();
    if (obs) obs.observe(node);
    else node.classList.add('in');
  }

  ngOnDestroy(): void {
    observer?.unobserve(this.el.nativeElement);
  }
}
