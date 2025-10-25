import {Component, computed, effect, inject, input, output, signal} from '@angular/core';
import {Card} from "../../shared/card/card";
import {MapStateService} from "../map-state.service";
import {FeatureIdentifier} from "maplibre-gl";
import {fidEquals} from "../map-util";
import {Geometry} from "geojson";

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
  styleUrls: ['../../shared/card/card.css', './map-card.css'],
  host: {
    '(click)': 'select($event)',
    '(mouseenter)': 'onMouseEnter($event)',
    '(mouseleave)': 'onMouseLeave($event)',
    '[class.selected]': 'isSelected()',
    '[class.hovered]': 'isHovered()',
  }
})
export class MapCard extends Card {
  private mapStateService = inject(MapStateService);

  readonly featureId = input.required<FeatureIdentifier>();
  readonly geometry = input.required<Geometry>();

  readonly isSelected = signal<boolean>(false);
  readonly isHovered = signal<boolean>(false);

  private isMapSelected = computed(() => fidEquals(this.mapStateService.selected()?.featureId, this.featureId()));
  private isMapHovered = computed(() => this.mapStateService.hovered()?.some(f => fidEquals(f.featureId, this.featureId())));

  selected = output<(MapCardEvent)>();
  hovered = output<MapCardEvent>();

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
    });
  }

  select(_: PointerEvent) {
    // set from card
    this.isSelected.update(s => !s);
    let selected = this.isSelected();
    if (selected) {
      this.mapStateService.select(this.featureId());
      this.flyToSelf();
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
  flyToSelf(): void {
    this.mapStateService.flyTo({
      geometry: this.geometry()
    })
  }
}
