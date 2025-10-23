import {
  Component,
  ElementRef,
  inject,
  input,
  ViewChild,
  AfterViewInit,
  OnInit, computed
} from '@angular/core';
import {AreaWatchService} from '../area-watch.service';
import {NotificationService} from '../../shared/snackbar/notification.service';
import {LayerConfigService} from '../../layer-type/layer-config.service';
import {LocalState} from "../../shared/service/local-state";
import {NgIcon, provideIcons} from "@ng-icons/core";
import {phosphorXCircleFill} from "@ng-icons/phosphor-icons/fill";
import {AreaWatchLayerService} from "../../map/layer/area-watch-layer/area-watch-layer.service";
import {Card, CardAction, CardLabel, CardThumb} from "../../shared/card/card";
import {MapCard} from "../../map/map-card/map-card";
import {FeatureIdentifier} from "maplibre-gl";

@Component({
  selector: 'app-area-watch-card',
  imports: [
    NgIcon,
    CardAction,
    CardLabel,
    CardThumb,
    MapCard
  ],
  templateUrl: './area-watch-card.html',
  styleUrl: './area-watch-card.css',
  providers: [provideIcons({phosphorXCircleFill})],
  host: {
  }
})
export class AreaWatchCard implements AfterViewInit, OnInit {
  awService = inject(AreaWatchService);
  layerService = inject(LayerConfigService);
  notService = inject(NotificationService);

  isOdd = input.required<boolean>();
  id = input.required<string>();
  data = computed(() => this.awService.get(this.id()));

  featureId = computed<FeatureIdentifier>(() => this.areaWatchLayerService.toFeatureIdentifier(this.id()));

  protected readonly LocalState = LocalState;

  @ViewChild('thumb') thumb!: ElementRef<HTMLImageElement>;

  private areaWatchLayerService = inject(AreaWatchLayerService);

  constructor() {

  }

  ngOnInit(): void {
  }

  ngAfterViewInit() {
    // TODO generate thumbnails
    // // Ensure the map and DOM elements are ready
    // this.mapService.mapLoaded$.subscribe(() => {
    //   const mapInstance = this.mapService.mapInstance;
    //
    //   if (mapInstance && this.thumb?.nativeElement) {
    //     // Set an ID on the image element for the library to use
    //     const imageId = `map-thumb-${Math.random().toString(36).substr(2, 9)}`;
    //     this.thumb.nativeElement.id = imageId;
    //
    //     toElement(mapInstance, {
    //       targetImageId: imageId,
    //       format: 'png',
    //       hideAllControls: true
    //     }).catch(error => {
    //       console.error('Failed to generate map thumbnail:', error);
    //     });
    //   }
    // });
  }

  delete(event: PointerEvent) {
    event.stopPropagation();
    this.awService.delete$(this.data())
      .subscribe({
        next: (_) => {
          this.notService.pushMessage(`Watch deleted - ${this.data().name}`);
          },
        error: (e) => {
          console.error('Failed to delete watch', e);
          this.notService.pushMessage(`Failed to delete watch '${this.data().name}'`);
        }
      });
    // no destroyref; component is destroyed when deleted
  }
}
