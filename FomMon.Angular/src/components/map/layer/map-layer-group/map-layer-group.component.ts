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
  order = input.required<number>();
  thumbnailImg = input.required<string>();
  initiallyVisible = input<boolean>(false);

  ngOnInit(): void {
    this.mapLayerService.addGroup({
      id: this.groupId(),
      name: this.name(),
      order: this.order(),
      thumbnailImg: this.thumbnailImg(),
      visible: this.initiallyVisible(),
      category: this.category(),
    });
  }

  ngOnDestroy() {
    this.mapLayerService.removeLayer(this.groupId());
  }
}
