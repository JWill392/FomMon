import {Injectable} from "@angular/core";
import {Geometry} from "geojson";
import {Theme} from "../../shared/theme.service";
import {finalize, Observable, Subject} from "rxjs";
import {booleanEqual as turfBooleanEqual} from "@turf/boolean-equal";

export interface GenerateThumbnailCommand {
  sourceId: string;
  width: number;
  height: number;
  geometry: Geometry;
  theme: Theme;
  fillColor: string;
}

export interface GeneratedThumbnail {
  dataUri: string;
}


interface Task {
  request: GenerateThumbnailCommand;
  response$: Subject<GeneratedThumbnail>;
  cancelled: boolean;
}

/**
 * Service to generate thumbnail images of a geometry on a map
 */
@Injectable({
 providedIn: 'root'
})
export class ThumbnailMapService {

  private _generateCommand = new Subject<Task>();

  register() : Observable<Task> {
    return this._generateCommand.asObservable()
  }

  generate(request: GenerateThumbnailCommand) : Observable<GeneratedThumbnail> {
    // if (!this.renderer) throw new Error('ThumbnailMapService not registered');
    ThumbnailMapService.validateCommand(request);
    const response$ = new Subject<GeneratedThumbnail>();
    const task = {
      request,
      response$,
      cancelled: false,
    };

    this._generateCommand.next(task);

    return response$.asObservable().pipe(
      finalize(() => task.cancelled=true)
    );
  }
  public static commandEquals(a: GenerateThumbnailCommand | undefined, b: GenerateThumbnailCommand | undefined) : boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;

    return a.theme === b.theme &&
      turfBooleanEqual(a.geometry, b.geometry) &&
      a.width === b.width &&
      a.height === b.height;
  }

  public static validateCommand(request: GenerateThumbnailCommand) {
    if (!request.geometry) throw new Error('No geometry provided');
    if (!request.width) throw new Error('No width provided');
    if (!request.height) throw new Error('No height provided');
    if (!request.theme) throw new Error('No theme provided');
    if (!request.fillColor) throw new Error('No fillColor provided');
  }
}