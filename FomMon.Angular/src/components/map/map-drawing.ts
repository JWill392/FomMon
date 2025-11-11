import {Component, DestroyRef, effect, inject, input, OnDestroy, OnInit, signal} from '@angular/core';
import {MaplibreTerradrawControl} from "@watergis/maplibre-gl-terradraw";
import {TerraDraw} from "terra-draw";
import {Map as MapLibreMap} from "maplibre-gl";
import {DrawCommand, MapStateService} from "./map-state.service";
import {v4 as uuidv4} from "uuid";
import {ErrorService} from "../shared/error.service";
import {MapLayerService} from "./layer/map-layer.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

type DrawState = 'map-preinit' | 'control-added' | 'map-idle' | 'draw-ready' | 'destroyed' ;

@Component({
  selector: 'app-map-drawing',
  imports: [],
  template: '',
  styles: []
})
export class MapDrawing implements OnInit, OnDestroy {
  private readonly mapStateService = inject(MapStateService);
  private readonly mapLayerService = inject(MapLayerService);
  private readonly errorService = inject(ErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly map = input.required<MapLibreMap>();

  protected currentDrawCommand = signal<DrawCommand | undefined>(undefined);
  private drawControl : MaplibreTerradrawControl | undefined;
  private draw : TerraDraw | undefined;

  private readonly terradrawGroupId = 'terradraw' as const;

  /** Draw component state; currently just for debugging purposes */
  protected drawState = signal<DrawState>('map-preinit');

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


  public ngOnInit() {
    // this.map = map;
    if (!this.map()) throw new Error('Map not initialized');


    this.drawControl = new MaplibreTerradrawControl({
      modes: ['polygon', 'select', 'delete-selection', 'render'],
      open: true
    });
    this.map().addControl(this.drawControl, 'top-right');
    this.destroyRef.onDestroy(() => this.map().removeControl(this.drawControl));
    this.setDrawState('control-added');


    this.draw = this.drawControl.getTerraDrawInstance();
    if (!this.draw) {
      this.errorService.handleError(new Error('Failed to get terra draw instance'));
      return;
    }


    // just hide until in draw mode (too slow to add control on entering draw mode)
    this.hideDrawControl();

    this.map().once('idle', () => {
      this.setDrawState('map-idle');
      const drawEnabled = this.draw["_enabled"];
      if (drawEnabled) {
        // 'ready' will never be emitted, and otherwise impossible to know this based on public draw state
        this.onDrawReady();
      } else {
        const onReady = this.onDrawReady.bind(this)
        this.draw.on('ready', onReady)
        this.destroyRef.onDestroy(() => {this.draw.off('ready', onReady)})

        this.draw.start(); // not called reliably by terradraw control because it assumes map.loaded and map.once('load')
        // covers all cases, but really loaded & load are (weirdly) totally unrelated concepts
      }
    });
  }

  public ngOnDestroy() {
    this.exitDrawMode();
    this.setDrawState('destroyed');
  }


  private setDrawState(state: DrawState) {
    this.drawState.set(state);
  }

  private onDrawReady() {
    this.setDrawState('draw-ready');
    const layers = this.drawControl.cleanStyle(this.map().getStyle(), {onlyTerraDrawLayers: true}).layers.map(l => l.id);


  // register layers for ordering
    this.mapLayerService.addGroup({
      id: this.terradrawGroupId,
      name: "TerraDraw",
      order: 100,
      visible: true,
      category: "internal",
      thumbnailImg: "",
    });
    for (const lid of layers) {
      this.mapLayerService.addLayer({
        id: lid,
        groupId: this.terradrawGroupId,
        layout: null,
        source: "",
        sourceLayer: "",
      });
    }
    this.destroyRef.onDestroy(() => {this.mapLayerService.removeGroup(this.terradrawGroupId)});

    this.mapStateService.drawCommand$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(command => {
        this.enterDrawMode(command)
      })
  }

  private enterDrawMode(command: DrawCommand) : void {
    if (this.currentDrawCommand()) return;
    if (!this.map) return;

    this.currentDrawCommand.set(command);

    this.showDrawControl();


    if (command.geometry) {
      // import geometry to terradraw
      const drawFeatureId = uuidv4();
      this.draw.addFeatures([{
        id: drawFeatureId, // has to be guid or silently dies
        type: 'Feature' as const,
        geometry: command.geometry,
        properties: {
          mode: command.mode
        }
      }]);

      // hide redundant real feature geometry
      if (command.id) {
        var timeout = setTimeout(() => this.mapStateService.hide(command.id), 100);
        this.destroyRef.onDestroy(() => clearTimeout(timeout))

      }
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
