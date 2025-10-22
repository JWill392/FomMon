import {Component, inject, input, OnDestroy, OnInit} from '@angular/core';
import {LayerCategory, MapLayerService} from "../map-layer.service";

@Component({
  selector: 'app-map-layer-group',
  imports: [],
  template: '',
  styles: ''
})
export class MapLayerGroupComponent implements OnInit, OnDestroy {
  private mapLayerService = inject(MapLayerService);

  groupId = input.required<string>();

  category = input.required<LayerCategory>();
  name = input.required<string>();
  thumbnailImg = input.required<string>();
  initiallyVisible = input<boolean>(false);

  interactivity = input({
    select: false,
    hover: false,
  });

  ngOnInit(): void {
    this.mapLayerService.addGroup({
      id: this.groupId(),
      name: this.name(),
      thumbnailImg: this.thumbnailImg(),
      visible: this.initiallyVisible(),
      category: this.category(),
      interactivity: this.interactivity(),
    });
  }

  ngOnDestroy() {
    this.mapLayerService.unregisterLayer(this.groupId());
  }
}
