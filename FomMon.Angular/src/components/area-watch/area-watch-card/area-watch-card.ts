import {
  Component,
  ElementRef,
  inject,
  input,
  ViewChild,
  AfterViewInit,
  OnInit, signal, computed
} from '@angular/core';
import {AreaWatch} from '../area-watch.model';
import {AreaWatchService} from '../area-watch.service';
import {NotificationService} from '../../shared/snackbar/notification.service';
import {LayerConfigService} from '../../layer-type/layer-config.service';
import {LocalState} from "../../shared/service/local-state";
import {NgIcon, provideIcons} from "@ng-icons/core";
import {phosphorXCircleFill} from "@ng-icons/phosphor-icons/fill";
import {AreaWatchLayerService} from "../../map/layer/area-watch-layer/area-watch-layer.service";

@Component({
  selector: 'app-area-watch-card',
  imports: [
    NgIcon
  ],
  templateUrl: './area-watch-card.html',
  styleUrl: './area-watch-card.css',
  providers: [provideIcons({phosphorXCircleFill})],
  host: {
    '[class.item-odd]': 'isOdd()',
    '[class.selected]': 'isSelected()',
    '[class.mapHovered]': 'isHovered()',
    '(click)': 'select($event)',
    '(mouseenter)': 'onMouseEnter($event)',
    '(mouseleave)': 'onMouseLeave($event)'
  }
})
export class AreaWatchCard implements AfterViewInit, OnInit {
  awService = inject(AreaWatchService);
  layerService = inject(LayerConfigService);
  notService = inject(NotificationService);

  isOdd = input.required<boolean>();
  data = input.required<AreaWatch>();

  protected readonly LocalState = LocalState;

  @ViewChild('thumb') thumb!: ElementRef<HTMLImageElement>;

  private areaWatchLayerService = inject(AreaWatchLayerService);
  protected isSelected = computed(() => this.areaWatchLayerService.selectedAreaWatchId() === this.data().id);
  protected isHovered = computed(() => this.areaWatchLayerService.hoveredAreaWatchIds().includes(this.data().id));


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

  select(event: PointerEvent) {
    this.areaWatchLayerService.select(this.data().id);
  }

  onMouseEnter($event: MouseEvent) {
    this.areaWatchLayerService.addHover(this.data().id);
  }

  onMouseLeave($event: MouseEvent) {
    this.areaWatchLayerService.removeHover(this.data().id);
  }
}
