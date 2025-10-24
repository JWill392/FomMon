import {Component, computed, DestroyRef, effect, inject, input, signal} from '@angular/core';
import {Card} from "../../shared/card/card";
import {MapStateService} from "../map-state.service";
import {FeatureIdentifier} from "maplibre-gl";
import {fidEquals} from "../map-util";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Geometry} from "geojson";

/**
 * Card for map features with bidirectional selection and hover
 * */
@Component({
  selector: 'app-map-card',
  imports: [],
  templateUrl: '../../shared/card/card.html',
  styleUrls: ['../../shared/card/card.css', './map-card.css'],
  host: {
    '(click)': 'select($event)',
    '(mouseenter)': 'onMouseEnter($event)',
    '(mouseleave)': 'onMouseLeave($event)',
    '[class.selected]': 'selected()',
    '[class.hovered]': 'hovered()',
  }
})
export class MapCard extends Card {
  private mapStateService = inject(MapStateService);
  private destroyRef = inject(DestroyRef);

  featureId = input.required<FeatureIdentifier>();
  geometry = input.required<Geometry>();

  selected = signal<boolean>(false);
  hovered = signal<boolean>(false);

  private isMapSelected = computed(() => fidEquals(this.mapStateService.selected()?.featureId, this.featureId()));
  private isMapHovered = computed(() => this.mapStateService.hovered()?.some(f => fidEquals(f.featureId, this.featureId())));

  constructor() {
    super();

    // set from map state
    effect(() => this.selected.set(this.isMapSelected()));
    effect(() => this.hovered.set(this.isMapHovered()));
  }

  select(_: PointerEvent) {
    // set from card
    this.selected.update(s => !s);
    if (this.selected()) {
      this.mapStateService.select(this.featureId());
      this.flyToSelf();
    }

    else {
      this.mapStateService.unselect(this.featureId());
    }
  }

  onMouseEnter(_: MouseEvent) {
    this.hovered.set(true);
    this.mapStateService.addHover(this.featureId());
  }

  onMouseLeave(_: MouseEvent) {
    this.hovered.set(false);
    this.mapStateService.removeHover(this.featureId());
  }
  flyToSelf(): void {
    this.mapStateService.flyTo(this.featureId(), this.geometry())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
