import {Component, computed, DestroyRef, effect, ElementRef, inject, input, output, signal} from '@angular/core';
import {Card} from "../../shared/card/card";
import {MapStateService} from "../map-state.service";
import {FeatureIdentifier} from "maplibre-gl";
import {fidEquals} from "../map-util";
import {InViewportDirective} from "../../shared/in-viewport.directive";

export type MapCardEventSource = 'map' | 'card';
export interface MapCardEvent {
  value: boolean,
  source: MapCardEventSource,
}

/**
 * Card for map features with bidirectional selection and hover
 * */
@Component({
  selector: 'app-map-card',
  imports: [],
  templateUrl: '../../shared/card/card.html',
  styleUrls: ['../../shared/card/card.scss',],
  host: {
    '(click)': 'select($event)',
    '(mouseenter)': 'onMouseEnter($event)',
    '(mouseleave)': 'onMouseLeave($event)',
    '[class.selected]': 'isSelected()',
    '[class.hovered]': 'isHovered()',
    '(inViewport)': "isInViewport = $event",
  },
  hostDirectives: [{
    directive: InViewportDirective,
    outputs: ['inViewport']
  }]
})
export class MapCard extends Card {
  private mapStateService = inject(MapStateService);
  private elementRef = inject(ElementRef);
  private destroyRef = inject(DestroyRef);

  readonly featureId = input.required<FeatureIdentifier>();

  readonly isSelected = signal<boolean>(false);
  readonly isHovered = signal<boolean>(false);

  private isMapSelected = computed(() => fidEquals(this.mapStateService.selected()?.featureId, this.featureId()));
  private isMapHovered = computed(() => this.mapStateService.hovered()?.some(f => fidEquals(f.featureId, this.featureId())));
  protected isInViewport = false;

  selected = output<(MapCardEvent)>();
  hovered = output<MapCardEvent>();

  enableScrollIntoView = input({hover: false}, {alias: 'scrollIntoView'});

  constructor() {
    super();

    // set from map state
    effect(() => {
      let selectCard = this.isSelected();
      let selectMap = this.isMapSelected();
      if (selectCard === selectMap) return;

      this.isSelected.set(selectMap);
      this.selected.emit({value: selectMap, source: 'map'});

    });
    effect(() => {
      let hoverCard = this.isHovered();
      let hoverMap = this.isMapHovered();
      if (hoverCard === hoverMap) return;

      this.isHovered.set(hoverMap);
      this.hovered.emit({value: hoverMap, source: 'map'});

      if (this.enableScrollIntoView().hover)
        this.debounce(
          () => this.scrollIntoViewIfNeeded(),
          () => this.isHovered(),
          200
        );
    });
  }

  select(_: PointerEvent) {
    // set from card
    this.isSelected.update(s => !s);
    let selected = this.isSelected();
    if (selected) {
      this.mapStateService.select(this.featureId());
    } else {
      this.mapStateService.unselect(this.featureId());
    }
    this.selected.emit({value: selected, source: 'card'});
  }

  onMouseEnter(_: MouseEvent) {
    if (this.isHovered()) return;
    this.isHovered.set(true);
    this.mapStateService.addHover(this.featureId());
    this.hovered.emit({value: true, source: 'card'});
  }

  onMouseLeave(_: MouseEvent) {
    if (!this.isHovered()) return;
    this.isHovered.set(false);
    this.mapStateService.removeHover(this.featureId());
    this.hovered.emit({value: false, source: 'card'});
  }


  private debounce(fn: () => void, predicate: () => boolean, delay: number) {
    if (!predicate()) return;
    const timer = setTimeout(() => {
      if (!predicate()) return;
      fn();
    }, delay)
    this.destroyRef.onDestroy(() => {clearTimeout(timer)});
  }

  private scrollIntoViewIfNeeded() {
    if (this.isInViewport) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    this.elementRef.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}
