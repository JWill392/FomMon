declare module 'maplibre-gl-map-to-image' {
  import { Map, LngLatBoundsLike } from 'maplibre-gl';

  export interface ToElementOptions {
    /**
     * REQUIRED: The ID of the HTML element where the image should be inserted.
     */
    targetImageId: string;

    /**
     * Flag to hide all map controls.
     */
    hideAllControls?: boolean;

    /**
     * Specific corners from which to hide controls.
     */
    hideControlsInCorner?: string[];

    /**
     * Flag to hide all map markers.
     */
    hideMarkers?: boolean;

    /**
     * Flag to hide all map popups.
     */
    hidePopups?: boolean;

    /**
     * Layer IDs to hide on the map by setting their visibility to 'none'.
     */
    hideVisibleLayers?: string[];

    /**
     * Layer IDs to show on the map by setting their visibility to 'visible'.
     */
    showHiddenLayers?: string[];

    /**
     * Optional bounding box to fit the map to, with padding.
     */
    bbox?: LngLatBoundsLike;

    /**
     * Flag to prevent seeing any map edits by capturing a background image before the map is rendered.
     */
    coverEdits?: boolean;

    /**
     * The format of the generated image. Possible values are 'jpeg', 'png', 'svg', and 'canvas'.
     */
    format?: 'jpeg' | 'png' | 'svg' | 'canvas';
  }

  /**
   * Creates a raster image from a MapLibre map. The map is first captured as a virtual
   * clone, and then the image is generated from this clone. This process allows the
   * image to be rendered with all of the map's overlays and controls visible.
   * @param map - The MapLibre map instance.
   * @param options - Configuration options that dictate how the image should be generated.
   * @returns A promise that resolves when the image has been generated and inserted into the page.
   */
  export function toElement(map: Map, options: ToElementOptions): Promise<void>;
}
