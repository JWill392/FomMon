import {Component, DestroyRef, effect, EffectCleanupFn, inject, input, OnInit} from '@angular/core';
import {Map as MapLibreMap, MapMouseEvent} from 'maplibre-gl';
import {FlyToCommand, MapSelection, MapStateService} from "./map-state.service";
import {MapLayerService} from "./layer/map-layer.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Geometry} from "geojson";
import {boundingBox} from "./map-util";

@Component({
  selector: 'app-map-interaction',
  imports: [],
  template: '',
  styles: []
})
export class MapInteraction implements OnInit {
  private readonly mapStateService = inject(MapStateService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly map = input.required<MapLibreMap>();


  constructor() {
    effect((onCleanup) => {
      const selected = this.mapStateService.selected();

      this.setFeatureState(selected?[selected]:[], 'selected', onCleanup);
    });

    // hover
    effect((onCleanup) => {
      const hovered = this.mapStateService.hovered();

      if (hovered.length > 0) {
        this.map().getCanvas().style.cursor = 'pointer';
      } else {
        this.map().getCanvas().style.cursor = '';
      }

      this.setFeatureState(hovered, 'hover', onCleanup);
    });

    // hide
    effect((onCleanup) => {
      const hidden = this.mapStateService.hidden();
      this.setFeatureState(hidden, 'hide', onCleanup);
    });
  }


  ngOnInit() {
    if (!this.map()) throw new Error('Map not initialized');
    this.mapStateService.flyToCommand$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(command => {
        this.executeFlyTo(command);
      });
  }


  handleMapClick(e: MapMouseEvent) {
    if (this.mapStateService.mode() !== 'select') return;
    if (e.defaultPrevented) return;


    const features = this.map().queryRenderedFeatures(e.point);
    if (features && features.length > 0) {
      const hasInteractiveFeature = features.some(feature => {
        const group = this.mapLayerService.getGroupBySource(feature.source, feature.sourceLayer);
        return group?.interactivity?.select === true;
      });
      if (hasInteractiveFeature) return;
    }
    this.mapStateService.clearSelection();
  }


  private executeFlyTo(command: FlyToCommand): void {
    if (!command.geometry) return;

    const camera = this.getCameraWithPadding(command.geometry);

    const easeParametric = (t: number) => {
      const sqr = t * t;
      return sqr / (2 * (sqr - t) + 1);
    }

    this.map().flyTo({
      ...camera,
      speed: 3,
      maxDuration: 1500,
      curve: 1.42,
      easing: easeParametric
    })
  }


  private getCameraWithPadding(geometry: Geometry, padFraction: number = 0.1) {
    const mapContainer = this.map().getContainer();
    const mapPadding = this.mapStateService.padding()

    const bounds = boundingBox(geometry);

    return this.map().cameraForBounds(bounds, {
      padding: {
        top: mapPadding.top + mapContainer.offsetHeight * padFraction,
        bottom: mapPadding.bottom + mapContainer.offsetHeight * padFraction,
        left: mapPadding.left + mapContainer.offsetWidth * padFraction,
        right: mapPadding.right + mapContainer.offsetWidth * padFraction,
      },
    })
  }



  private setFeatureState(selectionList: MapSelection[], stateName: string, onCleanup: (cleanupFn: EffectCleanupFn) => void) {
    selectionList.forEach((s) => this.map().setFeatureState(s.featureId, {[stateName]: true}));
    onCleanup(() => {
      selectionList.forEach((s) => this.map().setFeatureState(s.featureId, {[stateName]: false}));
    });
  }
}
