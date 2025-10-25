import {Directive, ElementRef, Output, EventEmitter, OnInit, DestroyRef, inject} from '@angular/core';

@Directive({
  selector: '[appInViewport]'
})
export class InViewportDirective implements OnInit {
  @Output() inViewport = new EventEmitter<boolean>();
  private observer: IntersectionObserver;
  private destroyRef = inject(DestroyRef)

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        this.inViewport.emit(entry.isIntersecting);
      });
    }, { threshold: [0.9] });
    this.destroyRef.onDestroy(() => this.observer?.disconnect())

    this.observer.observe(this.el.nativeElement);
  }
}