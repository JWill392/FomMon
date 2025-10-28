import {Component, DestroyRef, effect, inject, signal} from '@angular/core';
import {MaplibreTerradrawControl} from "@watergis/maplibre-gl-terradraw";
import {TerraDraw} from "terra-draw";
import {Map as MapLibreMap} from "maplibre-gl";
import {DrawCommand, MapStateService} from "./map-state.service";
import {v4 as uuidv4} from "uuid";
import {ErrorService} from "../shared/error.service";
import {MapLayerService} from "./layer/map-layer.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-map-drawing',
  imports: [],
  template: '',
  styles: []
})
export class MapDrawing {
  private readonly mapStateService = inject(MapStateService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly errorService = inject(ErrorService);
  private readonly destroyRef = inject(DestroyRef);

  private map : MapLibreMap;

  protected currentDrawCommand = signal<DrawCommand | undefined>(undefined);
  private drawControl : MaplibreTerradrawControl | undefined;
  private draw : TerraDraw | undefined;

  constructor() {
    effect(() => this.handleModeChange())
  }

  private handleModeChange() {
    const mode = this.mapStateService.mode();
    if (!this.map) return;

    if (mode !== 'draw' && this.currentDrawCommand()) {
      this.exitDrawMode();
    }
  }


  // terradraw doesn't work with signals; must be set synchronously when map loaded
  public register(map: MapLibreMap) {
    this.map = map;
    this.drawControl = new MaplibreTerradrawControl({
      modes: ['polygon', 'select', 'delete-selection', 'render'],
      open: true
    });
    map.addControl(this.drawControl, 'top-right');

    this.draw = this.drawControl.getTerraDrawInstance();
    if (!this.draw) {
      this.errorService.handleError(new Error('Failed to get terra draw instance'));
      return undefined;
    }
    this.hideDrawControl();

    // register layers for ordering
    this.draw.on('ready', () => {
      console.log("terra draw ready");
      const layers = this.drawControl.cleanStyle(this.map.getStyle(), {onlyTerraDrawLayers: true}).layers.map(l => l.id);
      const groupId = "terradraw" as const;
      this.mapLayerService.addGroup({
        id: groupId,
        name: "TerraDraw",
        order: 100,
        visible: true,
        interactivity: {select: false, hover: false},
        category: "internal",
        thumbnailImg: "",
      });
      for (const lid of layers) {
        this.mapLayerService.addLayer({
          id: lid,
          groupId: groupId,
          layout: null,
          source: "",
          sourceLayer: "",
        });
      }

      this.mapStateService.drawCommand$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(command => {
          this.enterDrawMode(command)
        })
    })

    return this.draw;
  }

  private enterDrawMode(command: DrawCommand) : void {
    if (this.currentDrawCommand()) return;
    if (!this.map) return;

    this.currentDrawCommand.set(command);

    this.showDrawControl();


    if (command.id) {
      this.mapStateService.hide(command.id);
    }

    if (command.geometry) {
      const drawFeatureId = uuidv4();
      this.draw.addFeatures([{
        id: drawFeatureId, // has to be guid or silently dies
        type: 'Feature' as const,
        geometry: command.geometry,
        properties: {
          mode: command.mode
        }
      }]);
      this.draw.selectFeature(drawFeatureId);
    } else {
      this.draw.setMode(command.mode);
    }

    this.draw.on('finish', (id: any) => {
      const feature = this.draw.getSnapshotFeature(id);

      if (feature?.geometry) {
        this.mapStateService.drawResult$.next(feature.geometry);
        this.draw.setMode('select');
      }
    });
  }
  private exitDrawMode() {
    if (!this.currentDrawCommand()) return;
    if (!this.map) return;

    if (this.currentDrawCommand().id) {
      this.mapStateService.unhide(this.currentDrawCommand().id);
    }

    this.hideDrawControl()
    this.draw.clear();


    this.draw.setMode('render');
    this.currentDrawCommand.set(undefined);
  }


  // toggle css visibility - hack to work around terradraw control not initializing properly when added/removed after map loaded.
  private hideDrawControl() {
    if (!this.drawControl) return;
    const container = (this.drawControl as any).controlContainer;

    if (container) {
      container.style.display = 'none';
    }
  }

  private showDrawControl() {
    if (!this.drawControl) return;
    const container = (this.drawControl as any).controlContainer;
    if (container) {
      container.style.display = 'block';
    }
  }

}
