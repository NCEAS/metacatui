import { WebMercatorTilingScheme, Rectangle, Ellipsoid, Cartesian2, GeographicTilingScheme, Credit, Event, ImageryLayerFeatureInfo } from 'cesium';

declare const colorscales: {
    viridis: Uint8Array;
    inferno: Uint8Array;
    turbo: Uint8Array;
    rainbow: {
        colors: string[];
        positions: number[];
    };
    jet: {
        colors: string[];
        positions: number[];
    };
    hsv: {
        colors: string[];
        positions: number[];
    };
    hot: {
        colors: string[];
        positions: number[];
    };
    cool: {
        colors: string[];
        positions: number[];
    };
    spring: {
        colors: string[];
        positions: number[];
    };
    summer: {
        colors: string[];
        positions: number[];
    };
    autumn: {
        colors: string[];
        positions: number[];
    };
    winter: {
        colors: string[];
        positions: number[];
    };
    bone: {
        colors: string[];
        positions: number[];
    };
    copper: {
        colors: string[];
        positions: number[];
    };
    greys: {
        colors: string[];
        positions: number[];
    };
    ylgnbu: {
        colors: string[];
        positions: number[];
    };
    greens: {
        colors: string[];
        positions: number[];
    };
    ylorrd: {
        colors: string[];
        positions: number[];
    };
    bluered: {
        colors: string[];
        positions: number[];
    };
    rdbu: {
        colors: string[];
        positions: number[];
    };
    picnic: {
        colors: string[];
        positions: number[];
    };
    portland: {
        colors: string[];
        positions: number[];
    };
    blackbody: {
        colors: string[];
        positions: number[];
    };
    earth: {
        colors: string[];
        positions: number[];
    };
    electric: {
        colors: string[];
        positions: number[];
    };
    magma: Uint8Array;
    plasma: Uint8Array;
    redblue: {
        colors: string[];
        positions: number[];
    };
    coolwarm: {
        colors: string[];
        positions: number[];
    };
    diverging_1: {
        colors: string[];
        positions: number[];
    };
    diverging_2: {
        colors: string[];
        positions: number[];
    };
    blackwhite: {
        colors: string[];
        positions: number[];
    };
    twilight: {
        colors: string[];
        positions: number[];
    };
    twilight_shifted: {
        colors: string[];
        positions: number[];
    };
};

declare type TypedArray = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;
interface DataSet {
    textureData: WebGLTexture;
    width: number;
    height: number;
    data: TypedArray;
    id: string;
}
declare type RenderColorType = 'continuous' | 'discrete';
declare type ColorScaleNames = keyof typeof colorscales;
declare type PlotOptions = {
    /**
     * The canvas to render to.
     */
    canvas?: HTMLCanvasElement;
    /**
     * The raster data to render.
     */
    data?: TypedArray;
    /**
     * The width of the input raster.
     */
    width?: number;
    /**
     * The height of the input raster.
     */
    height?: number;
    /**
     * A list of named datasets. Each must have 'id', 'data', 'width' and 'height'.
     */
    datasets?: {
        id: string;
        data: TypedArray;
        width: number;
        height: number;
    }[];
    /**
     * The no-data value that shall always be hidden.
     */
    noDataValue?: number;
    /**
     * Transformation matrix.
     */
    matrix?: [number, number, number, number, number, number, number, number, number];
    /**
     * Plotty can also function with pure javascript but it is much slower then using WebGL rendering.
     */
    useWebGL?: boolean;
} & SingleBandRenderOptions;

/**
 * The main plotty module.
 * @module plotty
 * @name plotty
 * @author: Daniel Santillan
 */
/**
 * @constant
 */

/**
 * Render the colorscale to the specified canvas.
 * @memberof module:plotty
 * @param {String} name the name of the color scale to render
 * @param {HTMLCanvasElement} canvas the canvas to render to
 * @param {RenderColorType} type the type of color scale to render, either "continuous" or "discrete"
 */
declare function renderColorScaleToCanvas(name: string, canvas: HTMLCanvasElement, type?: RenderColorType): void;
/**
 * The raster plot class.
 * @memberof module:plotty
 * @constructor
 * @param {Object} options the options to pass to the plot.
 * @param {HTMLCanvasElement} [options.canvas=document.createElement('canvas')]
 *        the canvas to render to
 * @param {TypedArray} [options.data] the raster data to render
 * @param {Number} [options.width] the width of the input raster
 * @param {Number} [options.height] the height of the input raster
 * @param {Object[]} [options.datasets=undefined] a list of named datasets. each
 *         must have 'id', 'data', 'width' and 'height'.
 * @param {(HTMLCanvasElement|HTMLImageElement)} [options.colorScaleImage=undefined]
 *        the color scale image to use
 * @param {String} [options.colorScale] the name of a named color scale to use
 * @param {Number[]} [options.domain=[0, 1]] the value domain to scale the color
 * @param {Number[]} [options.displayRange=[0, 1]] range of values that will be
 *        rendered, values outside of the range will be transparent
 * @param {Boolean} [options.applyDisplayRange=false] set if displayRange should
 *        be used
 * @param {Boolean} [options.clampLow=true] whether or now values below the domain
 *        shall be clamped
 * @param {Boolean} [options.clampHigh=clampLow] whether or now values above the
 * domain shall be clamped (if not defined defaults to clampLow value)
 * @param {Number} [options.noDataValue = undefined] the no-data value that shall
 *         always be hidden
 * @param {Array} [options.matrix=[1, 0, 0, 0, 1, 0, 0, 0, 1 ]] Transformation matrix
 * @param {Boolean} [options.useWebGL=true] plotty can also function with pure javascript
 *         but it is much slower then using WebGl rendering
 *
 */
declare class plot {
    canvas: HTMLCanvasElement;
    currentDataset: DataSet;
    datasetCollection: Record<string, DataSet>;
    gl: WebGLRenderingContext | null;
    program: WebGLProgram;
    texCoordBuffer: WebGLBuffer;
    ctx: CanvasRenderingContext2D;
    displayRange: number[];
    applyDisplayRange: boolean;
    matrix: number[];
    colorScaleImage: HTMLCanvasElement | HTMLImageElement;
    domain: number[];
    colorScaleCanvas: HTMLCanvasElement;
    name: ColorScaleNames;
    clampLow: boolean;
    clampHigh: boolean;
    textureScale: WebGLTexture;
    noDataValue: number;
    expressionAst: string;
    colorType: RenderColorType;
    constructor(options: PlotOptions);
    /**
     * Get the raw data from the currently selected dataset.
     * @returns {TypedArray} the data of the currently selected dataset.
     */
    getData(): TypedArray;
    /**
     * Query the raw raster data at the specified coordinates.
     * @param {Number} x the x coordinate
     * @param {Number} y the y coordinate
     * @returns {Number} the value at the specified coordinates
     */
    atPoint(x: number, y: number): number;
    /**
     * Set the raw raster data to be rendered. This creates a new unnamed dataset.
     * @param {TypedArray} data the raw raster data. This can be a typed array of
     *                          any type, but will be coerced to Float32Array when
     *                          beeing rendered.
     * @param {number} width the width of the raster image
     * @param {number} height the height of the data
     */
    setData(data: TypedArray, width: number, height: number): void;
    /**
     * Add a new named dataset. The semantics are the same as with @see setData.
     * @param {string} id the identifier for the dataset.
     * @param {TypedArray} data the raw raster data. This can be a typed array of
     *                          any type, but will be coerced to Float32Array when
     *                          beeing rendered.
     * @param {number} width the width of the raster image
     * @param {number} height the height of the data
     */
    addDataset(id: string, data: TypedArray, width: number, height: number): void;
    /**
     * Set the current dataset to be rendered.
     * @param {string} id the identifier of the dataset to be rendered.
     */
    setCurrentDataset(id: string): void;
    /**
     * Remove the dataset.
     * @param {string} id the identifier of the dataset to be removed.
     */
    removeDataset(id: string): void;
    removeAllDataset(): void;
    /**
     * Check if the dataset is available.
     * @param {string} id the identifier of the dataset to check.
     * @returns {Boolean} whether or not a dataset with that identifier is defined
     */
    datasetAvailable(id: string): boolean;
    /**
     * Retrieve the rendered color scale image.
     * @returns {(HTMLCanvasElement|HTMLImageElement)} the canvas or image element
     *                                                 for the rendered color scale
     */
    getColorScaleImage(): (HTMLCanvasElement | HTMLImageElement);
    /**
     * Set the canvas to draw to. When no canvas is supplied, a new canvas element
     * is created.
     * @param {HTMLCanvasElement} [canvas] the canvas element to render to.
     */
    setCanvas(canvas: HTMLCanvasElement): void;
    setColorType(type: RenderColorType): void;
    /**
     * Set the new value domain for the rendering.
     * @param {number[]} domain the value domain range in the form [low, high]
     */
    setDomain(domain: number[]): void;
    /**
     * Set the display range that will be rendered, values outside of the range
     * will not be rendered (transparent)
     * @param {number[]} displayRange range array in the form [min, max]
     */
    setDisplayRange(displayRange: number[]): void;
    /**
     * Get the canvas that is currently rendered to.
     * @returns {HTMLCanvasElement} the canvas that is currently rendered to.
     */
    getCanvas(): HTMLCanvasElement;
    /**
     * Set the currently selected color scale.
     * @param {ColorScaleNames} name the name of the colorscale. Must be registered.
     */
    setColorScale(name: ColorScaleNames): void;
    /**
     * Set the clamping for the lower and the upper border of the values. When
     * clamping is enabled for either side, the values below or above will be
     * clamped to the minimum/maximum color.
     * @param {Boolean} clampLow whether or not the minimum shall be clamped.
     * @param {Boolean} clampHigh whether or not the maxmimum shall be clamped.
     *                            defaults to clampMin.
     */
    setClamp(clampLow: boolean, clampHigh: boolean): void;
    /**
     * Set the currently selected color scale as an image or canvas.
     * @param {(HTMLCanvasElement|HTMLImageElement)} colorScaleImage the new color
     *                                                               scale image
     */
    setColorScaleImage(colorScaleImage: (HTMLCanvasElement | HTMLImageElement)): void;
    /**
     * Set the no-data-value: a special value that will be rendered transparent.
     * @param {number} noDataValue the no-data-value. Use null to clear a
     *                            previously set no-data-value.
     */
    setNoDataValue(noDataValue: number): void;
    /**
     * Render the map to the specified canvas with the given settings.
     */
    render(): void;
    /**
     * Render the specified dataset with the current settings.
     * @param {string} id the identifier of the dataset to render.
     */
    renderDataset(id: string): void;
    /**
     * Get the color for the specified value.
     * @param {number} val the value to query the color for.
     * @returns {Array} the 4-tuple: red, green, blue, alpha in the range 0-255.
     */
    getColor(val: number): Array<any>;
    /**
     * Sets a mathematical expression to be evaluated on the plot. Expression can contain mathematical operations with integer/float values, dataset identifiers or GLSL supported functions with a single parameter.
     * Supported mathematical operations are: add '+', subtract '-', multiply '*', divide '/', power '**', unary plus '+a', unary minus '-a'.
     * Useful GLSL functions are for example: radians, degrees, sin, asin, cos, acos, tan, atan, log2, log, sqrt, exp2, exp, abs, sign, floor, ceil, fract.
     * @param {string} expression Mathematical expression. Example: '-2 * sin(3.1415 - dataset1) ** 2'
     */
    setExpression(expression: string): void;
    destroy(): void;
}

declare class TIFFImageryProviderTilingScheme extends WebMercatorTilingScheme {
    readonly nativeRectangle: Rectangle;
    constructor(options?: {
        ellipsoid?: Ellipsoid;
        numberOfLevelZeroTilesX?: number;
        numberOfLevelZeroTilesY?: number;
        rectangleSouthwestInMeters?: Cartesian2;
        rectangleNortheastInMeters?: Cartesian2;
        /** projection function, convert [lon, lat] position to [x, y] */
        project: (pos: number[]) => number[];
        /** unprojection function, convert [x, y] position to [lon, lat] */
        unproject: (pos: number[]) => number[];
    });
    tileXYToNativeRectangle2(x: number, y: number, level: number): Rectangle;
    tileXYToRectangle(x: number, y: number, level: number): Rectangle;
}

interface SingleBandRenderOptions {
    /** band index start from 1, defaults to 1 */
    band?: number;
    /**
     * The color scale image to use.
     */
    colorScaleImage?: HTMLCanvasElement | HTMLImageElement;
    /**
     * The name of a named color scale to use.
     */
    colorScale?: ColorScaleNames;
    /** custom interpolate colors, [stopValue(0 - 1), color] or [color], if the latter, means equal distribution
     * @example
     * [[0, 'red'], [0.6, 'green'], [1, 'blue']]
    */
    colors?: [number, string][] | string[];
    /** Determine whether to use the true value range for custom color ranges */
    useRealValue?: boolean;
    /** defaults to continuous */
    type?: 'continuous' | 'discrete';
    /**
     * The value domain to scale the color.
     */
    domain?: [number, number];
    /**
     * Range of values that will be rendered, values outside of the range will be transparent.
     */
    displayRange?: [number, number];
    /**
     * Set if displayRange should be used.
     */
    applyDisplayRange?: boolean;
    /**
     * Whether or not values below the domain shall be clamped.
     */
    clampLow?: boolean;
    /**
     * Whether or not values above the domain shall be clamped (if not defined defaults to clampLow value).
     */
    clampHigh?: boolean;
    /**
     * Sets a mathematical expression to be evaluated on the plot. Expression can contain mathematical operations with integer/float values, band identifiers or GLSL supported functions with a single parameter.
     * Supported mathematical operations are: add '+', subtract '-', multiply '*', divide '/', power '**', unary plus '+a', unary minus '-a'.
     * Useful GLSL functions are for example: radians, degrees, sin, asin, cos, acos, tan, atan, log2, log, sqrt, exp2, exp, abs, sign, floor, ceil, fract.
     * Don't forget to set the domain parameter!
     * @example
     * '-2 * sin(3.1415 - b1) ** 2'
     * '(b1 - b2) / (b1 + b2)'
     */
    expression?: string;
}
interface MultiBandRenderOptions {
    /** Band value starts from 1 */
    r?: {
        band: number;
        min?: number;
        max?: number;
    };
    g?: {
        band: number;
        min?: number;
        max?: number;
    };
    b?: {
        band: number;
        min?: number;
        max?: number;
    };
}
declare type TIFFImageryProviderRenderOptions = {
    /** nodata value, default read from tiff meta */
    nodata?: number;
    /** Only valid for three band rendering, defaults to { 'black': 'transparent' } */
    colorMapping?: Record<string, string>;
    /** try to render multi band cog to RGB, priority 1 */
    convertToRGB?: boolean;
    /** priority 2 */
    multi?: MultiBandRenderOptions;
    /** priority 3 */
    single?: SingleBandRenderOptions;
};
interface TIFFImageryProviderOptions {
    requestOptions?: {
        /** defaults to false */
        forceXHR?: boolean;
        headers?: Record<string, any>;
        credentials?: boolean;
        /** defaults to 0 */
        maxRanges?: number;
        /** defaults to false */
        allowFullFile?: boolean;
        [key: string]: any;
    };
    credit?: string;
    tileSize?: number;
    maximumLevel?: number;
    minimumLevel?: number;
    enablePickFeatures?: boolean;
    hasAlphaChannel?: boolean;
    renderOptions?: TIFFImageryProviderRenderOptions;
    /**
     * If TIFF's projection is not EPSG:4326 or EPSG:3857, you can pass the ``projFunc`` to handle the projection
     * @experimental
     */
    projFunc?: (code: number) => {
        /** projection function, convert [lon, lat] position to [x, y] */
        project: ((pos: number[]) => number[]);
        /** unprojection function, convert [x, y] position to [lon, lat] */
        unproject: ((pos: number[]) => number[]);
    } | undefined;
    /** cache survival time, defaults to 60 * 1000 ms */
    cache?: number;
    /** geotiff resample method, defaults to nearest */
    resampleMethod?: 'nearest' | 'bilinear' | 'linear';
}
declare class TIFFImageryProvider {
    private readonly options;
    ready: boolean;
    tilingScheme: TIFFImageryProviderTilingScheme | GeographicTilingScheme | WebMercatorTilingScheme;
    rectangle: Rectangle;
    tileSize: number;
    tileWidth: number;
    tileHeight: number;
    maximumLevel: number;
    minimumLevel: number;
    credit: Credit;
    errorEvent: Event;
    readyPromise: Promise<boolean>;
    bands: Record<number, {
        min: number;
        max: number;
    }>;
    noData: number;
    hasAlphaChannel: boolean;
    plot: plot;
    renderOptions: TIFFImageryProviderRenderOptions;
    readSamples: number[];
    requestLevels: number[];
    bbox: number[];
    private _destroyed;
    private _source;
    private _imageCount;
    private _images;
    private _imagesCache;
    private _cacheTime;
    private _isTiled;
    private _proj?;
    origin: number[];
    reverseY: boolean;
    samples: number;
    constructor(options: TIFFImageryProviderOptions & {
        /**
         * @deprecated
         * Deprecated after cesium@1.104+, you can use fromUrl instead
         * @example
         * const provider = await TIFFImageryProvider.fromUrl(url)
         */
        url: string | File | Blob;
    });
    get isDestroyed(): boolean;
    private _build;
    static fromUrl(url: string | File | Blob, options?: TIFFImageryProviderOptions): Promise<TIFFImageryProvider>;
    /**
     * Get the origin of an image.  If the image does not have an affine transform,
     * the top-left corner of the pixel bounds is returned.
     * @param {GeoTIFFImage} image The image.
     * @return {Array<number>} The image origin.
     */
    private _getOrigin;
    private _checkIfReversed;
    /**
     * get suitable cog levels
     */
    private _getCogLevels;
    /**
     * 获取瓦片数据
     * @param x
     * @param y
     * @param z
     */
    private _loadTile;
    private _createTile;
    requestImage(x: number, y: number, z: number): Promise<HTMLCanvasElement | ImageData | HTMLImageElement>;
    pickFeatures(x: number, y: number, zoom: number, longitude: number, latitude: number): Promise<ImageryLayerFeatureInfo[]>;
    destroy(): void;
}

export { type MultiBandRenderOptions, type SingleBandRenderOptions, TIFFImageryProvider, type TIFFImageryProviderOptions, type TIFFImageryProviderRenderOptions, colorscales, TIFFImageryProvider as default, renderColorScaleToCanvas };
