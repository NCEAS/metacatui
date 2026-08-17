"use strict";

define([
  "jquery",
  "jqueryui",
  "underscore",
  "backbone",
  "gmaps",
  "fancybox",
  "clipboard",
  "models/resourceMap/ProvenanceChartAdapter",
  "models/dataONEServices/ViewService",
  "models/dataONEServices/ObjectService",
  "models/viewService/ViewServiceDoc",
  "common/ErrorUtilities",
  "common/UrlUtilities",
  "views/ProvChartView",
  "views/MetadataIndexView",
  "views/AnnotationView",
  "views/MarkdownView",
  "views/DownloadButtonView",
  "views/ViewObjectButtonView",
  "models/SolrResult",
  "text!templates/alert.html",
  "text!templates/dataDisplay.html",
  "text!templates/map.html",
], (
  $,
  $ui,
  _,
  Backbone,
  gmaps,
  _fancybox,
  Clipboard,
  ProvenanceChartAdapter,
  ViewService,
  ObjectService,
  ViewServiceDoc,
  ErrorUtilities,
  UrlUtilities,
  ProvChart,
  MetadataIndex,
  AnnotationView,
  MarkdownView,
  DownloadButtonView,
  ViewObjectButtonView,
  SolrResult,
  AlertTemplate,
  DataDisplayTemplate,
  MapTemplate,
) => {
  const BASE_CLASS = "metadata-view";
  const CLASS_NAMES = {
    active: "active",
    alert(type) {
      return `alert-${type}`;
    },
    container: "container",
    messageContainer: `${BASE_CLASS}__message`,
    metadataContainer: `${BASE_CLASS}__metadata`,
    gutters: "gutters",
    node: "node",
    noStylesheet: "no-stylesheet",
    provChart: "prov-chart",
  };
  const MESSAGES = {
    alternativeIdentifierHelp: `
         An identifier used to reference this dataset in the past or in another
         system. This could be a link to the original dataset or an old
         identifier that was replaced. The referenced dataset may be the same
         or different from the one you are currently viewing, and its
         accessibility may vary. It may provide additional context about the
         history and evolution of the dataset.
        `,
    limitedMetadata: "There is limited metadata about this dataset.",
    loadingDatasetDetails: "Loading dataset details...",
    missingIdentifier: "No details to display. Identifier is missing.",
    viewServiceEmpty: "View service returned empty content.",
    viewServiceUnstyled: "View service returned unstyled content.",
  };
  const VIEW_SERVICE_CLASS_NAMES = ViewServiceDoc.CLASS_NAMES;
  const VIEW_SERVICE_IDS = ViewServiceDoc.IDS;

  /**
   * @class MetadataDocumentView
   * @classdesc Renders science metadata HTML and enhances its markup
   * @classcategory Views
   * @augments Backbone.View
   * @screenshot views/MetadataDocumentView.png
   * @since 0.0.0
   */
  const MetadataDocumentView = Backbone.View.extend(
    /** @lends MetadataDocumentView.prototype */ {
      type: "Metadata",

      /** @inheritdoc */
      pid: null,

      /** @inheritdoc */
      events: {
        "mouseover .highlight-node": "highlightNode",
        "mouseout .highlight-node": "highlightNode",
      },

      /**
       * Build the containers for messages and rendered metadata
       * @returns {string} View markup
       */
      template() {
        return (
          `<div class="${CLASS_NAMES.messageContainer}"></div>` +
          `<div class="${CLASS_NAMES.metadataContainer}"></div>`
        );
      },

      /** Alert template for displaying messages to the user */
      alertTemplate: _.template(AlertTemplate),

      /** Template for displaying data details */
      dataDisplayTemplate: _.template(DataDisplayTemplate),

      /** Template for displaying a map of the dataset's spatial coverage */
      mapTemplate: _.template(MapTemplate),

      /**
       * Text to display in the help tooltip for the alternative identifier
       * field, if the field is present.
       * @type {string}
       * @since 2.26.0
       */
      alternativeIdentifierHelpText: MESSAGES.alternativeIdentifierHelp,

      /**
       * Initialize the MetadataDocumentView
       * @param {object} options Object containing the view's options
       * @param {string} [options.pid] The identifier of the metadata object to
       * render
       * @param {DataPackage} [options.dataPackage] Package containing the object
       * @param {object[]} [options.indexResults] Existing index records
       * @param {object} [options.displayState] Resolved display state
       * @param {boolean} [options.editModeOn] Whether provenance may be edited
       * @param {AbortSignal} [options.signal] Signal for cancelling requests
       * @param {string} [options.viewServiceUrl] The URL of the view service to
       * use when rendering the metadata. If not provided, will use the view
       * service URL from the app model
       * @param {string} [options.resolveBaseUrl] The base URL to use when
       * resolving member identifiers to URLs. Defaults to app model's
       * resolveServiceUrl, then objectServiceUrl, then ""
       * @param {string} [options.altIdentifierHelpText] Alternative identifier
       * help text
       * @returns {void}
       */
      initialize(options = {}) {
        this.pid = options.pid;
        this.dataPackage = options.dataPackage || null;
        this.indexResults = options.indexResults || null;
        this.displayState = options.displayState || {};
        this.editModeOn = options.editModeOn === true;
        this.signal = options.signal || null;
        this.isClosed = false;
        this.previewObjectUrls = new Set();
        if (this.dataPackage) {
          this.listenTo(
            this.dataPackage.events,
            "provenance:changed",
            this.scheduleProvChartRedraw,
          );
        }
        const viewServiceUrl =
          options.viewServiceUrl || MetacatUI.appModel.get("viewServiceUrl");
        this.viewService = new ViewService({ baseUrl: viewServiceUrl });
        this.resolveBaseUrl =
          options.resolveBaseUrl ||
          MetacatUI.appModel.get("resolveServiceUrl") ||
          MetacatUI.appModel.get("objectServiceUrl") ||
          "";
        if (options.altIdentifierHelpText) {
          this.alternativeIdentifierHelpText = options.altIdentifierHelpText;
        }
      },

      /**
       * Add a subview to the list of subviews for this view. This is used to
       * keep track of subviews so they can be closed when this view is closed.
       * @param {Backbone.View} view The subview to add
       * @returns {void}
       */
      addSubview(view) {
        if (!this.subviews) this.subviews = [];
        if (this.subviews.includes(view)) return;
        this.subviews.push(view);
      },

      /**
       * Render metadata and enhance the resulting document.
       * @returns {Promise<MetadataDocumentView>} This view
       */
      async render() {
        this.el.innerHTML = this.template();
        this.messageContainer = this.el.querySelector(
          `.${CLASS_NAMES.messageContainer}`,
        );
        this.metadataContainer = this.el.querySelector(
          `.${CLASS_NAMES.metadataContainer}`,
        );

        if (!this.pid) {
          this.showMessage(MESSAGES.missingIdentifier, {
            type: "error",
          });
          return this;
        }
        this.showMessage(MESSAGES.loadingDatasetDetails);

        let metadataViewDoc;
        let usedIndexFallback = false;
        try {
          metadataViewDoc = await this.renderMetadataFromViewService();
          if (this.signal?.aborted) return this;
        } catch (error) {
          if (ErrorUtilities.isAbortError(error)) return this;
          usedIndexFallback = true;
          metadataViewDoc = await this.renderMetadataFromIndex();
          if (this.signal?.aborted) return this;
        }
        this.renderMetadataDocument(metadataViewDoc);
        if (usedIndexFallback) {
          this.showMessage(MESSAGES.limitedMetadata, { type: "warning" });
        }

        // Modify the markup:
        this.initializeAttributeListTables();
        this.renderAltIdentifierHelpText();
        this.insertDataDetails();
        if (this.el.isConnected) this.checkForProv();
        this.insertSpatialCoverageMap();
        this.insertCopiables();
        this.createAnnotationViews();
        this.insertMarkdownViews();

        return this;
      },

      /**
       * Download and validate metadata rendered by the View Service
       * @returns {Promise<ViewServiceDoc>} Parsed metadata document
       * @throws {Error} When the service returns empty or unsupported markup
       */
      async renderMetadataFromViewService() {
        const metadataViewDoc = await this.viewService.download(this.pid, {
          resolveBaseUrl: this.resolveBaseUrl,
          signal: this.signal,
        });

        if (metadataViewDoc.isEmpty() || metadataViewDoc.hasTransformError()) {
          throw new Error(MESSAGES.viewServiceEmpty);
        }

        if (metadataViewDoc.isUnstyled()) {
          // The response has no recognized stylesheet (e.g. older or custom
          // view-service HTML without an id="Metadata" root). Prefer the index
          // summary when the object is indexed; otherwise still show the raw
          // response, marked so the CSS can adjust for the missing stylesheet.
          if (this.indexResults) {
            throw new Error(MESSAGES.viewServiceUnstyled);
          }
          this.$el.addClass(
            `${CLASS_NAMES.container} ${CLASS_NAMES.noStylesheet}`,
          );
        }

        return metadataViewDoc;
      },

      /**
       * Display metadata fields from the index when View Service rendering is
       * unavailable.
       * @returns {Promise<ViewServiceDoc>} Parsed metadata document
       */
      async renderMetadataFromIndex() {
        const metadataIndexOptions = {
          pid: this.pid,
          dataPackage: this.dataPackage,
          displayState: this.displayState,
        };

        let metadataIndexView;
        try {
          metadataIndexView = await new MetadataIndex(
            metadataIndexOptions,
          ).render();
        } catch {
          if (this.indexResults?.length) {
            try {
              metadataIndexView = await new MetadataIndex({
                ...metadataIndexOptions,
                indexResult: this.indexResults,
              }).render();
            } catch {
              metadataIndexView = null;
            }
          }
        }

        if (!metadataIndexView) {
          metadataIndexView = new MetadataIndex(metadataIndexOptions);
          metadataIndexView.showNotIndexed();
          metadataIndexView.insertDataDetails();
        }

        return ViewServiceDoc.fromHtml(metadataIndexView.el.outerHTML, {
          pid: this.pid,
          resolveBaseUrl: this.resolveBaseUrl,
        });
      },

      /**
       * Insert one normalized document regardless of its original source.
       * @param {ViewServiceDoc} metadataViewDoc Parsed metadata document
       * @returns {void}
       */
      renderMetadataDocument(metadataViewDoc) {
        this.hideMessages();
        this.metadataViewDoc = metadataViewDoc;
        this.dataPackage?.addViewServiceEntities(metadataViewDoc.entities);
        const renderedContent = this.metadataViewDoc.template?.content;
        if (renderedContent?.childNodes.length) {
          this.metadataContainer.replaceChildren(renderedContent);
          this.metadataViewDoc.template = null;
          return;
        }
        this.metadataContainer.innerHTML = metadataViewDoc.html || "";
      },

      /**
       * Initialize attribute table tab row highlighting.
       * @returns {void}
       */
      initializeAttributeListTables() {
        this.$(`.${VIEW_SERVICE_CLASS_NAMES.attributeListTable} tr a`)
          .off("shown.metadataView")
          .on("shown.metadataView", (e) => {
            const row = $(e.target).parents("tr").first();
            row
              .parents(`.${VIEW_SERVICE_CLASS_NAMES.attributeListTable}`)
              .find(`.${VIEW_SERVICE_CLASS_NAMES.active}`)
              .removeClass(VIEW_SERVICE_CLASS_NAMES.active);
            row.addClass(VIEW_SERVICE_CLASS_NAMES.active);
          });
      },

      /**
       * Inserts an info icon next to the alternate identifier field, if it
       * exists. The icon will display a tooltip with the help text for the
       * field.
       * @returns {jQuery|null} The jQuery object for the icon element
       */
      renderAltIdentifierHelpText() {
        // Find the HTML element that contains the alternate identifier.
        const altIdentifierLabel = this.$(
          `.${VIEW_SERVICE_CLASS_NAMES.controlLabel}:contains('Alternate Identifier')`,
        );

        // It may not exist for all datasets.
        if (!altIdentifierLabel.length) return null;

        const text = this.alternativeIdentifierHelpText;

        if (!text) return null;

        // Create the tooltip
        const icon = $(document.createElement("i"))
          .addClass(
            `${VIEW_SERVICE_CLASS_NAMES.tooltipThis} ${VIEW_SERVICE_CLASS_NAMES.icon} ${VIEW_SERVICE_CLASS_NAMES.iconInfoSign}`,
          )
          .css("margin-left", "4px");

        // Activate the jQuery tooltip plugin
        icon.tooltip({
          title: text,
          placement: "top",
          container: "body",
        });

        // Add the icon to the label.
        altIdentifierLabel.append(icon);

        return icon;
      },

      /**
       * Shows a map with the bounding coordinates of the spatial coverage of
       * the dataset.
       * @param {Array} [customCoordinates] An array of custom coordinates to
       * use for the map in the order of [north, south, east, west]
       * @returns {boolean} Returns false if the map could not be inserted
       */
      insertSpatialCoverageMap(customCoordinates) {
        if (!gmaps) return false;
        let geoCoverEls = this.$(
          `.${VIEW_SERVICE_CLASS_NAMES.geographicCoverage}`,
        );
        let parseText = false;
        let directions = ["north", "south", "east", "west"];
        let [n, s, e, w] = customCoordinates || [];

        // Find the geographic region container. Older versions of Metacat
        // (v2.4.3 and less) will not have it classified so look for the header
        // text
        if (!geoCoverEls.length) {
          // For EML
          let title = this.$('h4:contains("Geographic Region")');

          // For FGDC
          if (title.length === 0) {
            title = this.$('label:contains("Bounding Coordinates")');
          }

          geoCoverEls = title.parent();
          parseText = true;
          directions = ["North", "South", "East", "West"];
        }

        for (let i = 0; i < geoCoverEls.length; i += 1) {
          const georegion = geoCoverEls[i];

          if (!customCoordinates?.length) {
            const coordinates = [];

            directions.forEach((direction) => {
              // Parse text for older versions of Metacat (v2.4.3 and earlier)
              let coordinate = "";
              if (parseText) {
                const labelEl = $(georegion).find(
                  `label:contains("${direction}")`,
                );
                if (labelEl.length) {
                  coordinate = labelEl.next().html();
                  if (
                    typeof coordinate !== "undefined" &&
                    coordinate.indexOf("&nbsp;") > -1
                  )
                    coordinate = coordinate.substring(
                      0,
                      coordinate.indexOf("&nbsp;"),
                    );
                }
              } else {
                const coordinateClass =
                  VIEW_SERVICE_CLASS_NAMES[`${direction}BoundingCoordinate`];
                coordinate = $(georegion)
                  .find(`.${coordinateClass}`)
                  .attr("data-value");
              }

              // Save our coordinate value
              coordinates.push(coordinate);
            });

            // Extract the coordinates
            [n, s, e, w] = coordinates;
          }

          // Create Google Map LatLng objects out of our coordinates
          const latLngSW = new gmaps.LatLng(s, w);
          const latLngNE = new gmaps.LatLng(n, e);
          const latLngNW = new gmaps.LatLng(n, w);
          const latLngSE = new gmaps.LatLng(s, e);

          // Get the centroid location of this data item
          const bounds = new gmaps.LatLngBounds(latLngSW, latLngNE);
          const latLngCEN = bounds.getCenter();

          // If there isn't a center point found, don't draw the map.
          if (typeof latLngCEN === "undefined") {
            return false;
          }

          // Get the map path color
          let pathColor = MetacatUI.appModel.get("datasetMapPathColor");
          if (pathColor) {
            pathColor = `color:${pathColor}|`;
          } else {
            pathColor = "";
          }

          // Get the map path fill color
          let fillColor = MetacatUI.appModel.get("datasetMapFillColor");
          if (fillColor) {
            fillColor = `fillcolor:${fillColor}|`;
          } else {
            fillColor = "";
          }

          // Create a google map image
          const mapHTML =
            `<img class='georegion-map' ` +
            `src='https://maps.googleapis.com/maps/api/staticmap?` +
            `center=${latLngCEN.lat()},${latLngCEN.lng()}&size=800x350` +
            `&maptype=terrain` +
            `&markers=size:mid|color:0xDA4D3Aff|${latLngCEN.lat()},${latLngCEN.lng()}&path=${fillColor}${pathColor}weight:3|${latLngSW.lat()},${latLngSW.lng()}|${latLngNW.lat()},${latLngNW.lng()}|${latLngNE.lat()},${latLngNE.lng()}|${latLngSE.lat()},${latLngSE.lng()}|${latLngSW.lat()},${latLngSW.lng()}&visible=${latLngSW.lat()},${latLngSW.lng()}|${latLngNW.lat()},${latLngNW.lng()}|${latLngNE.lat()},${latLngNE.lng()}|${latLngSE.lat()},${latLngSE.lng()}|${latLngSW.lat()},${latLngSW.lng()}&sensor=false` +
            `&key=${MetacatUI.mapKey}'/>`;

          // Find the spot in the DOM to insert our map image
          let insertAfter = georegion;
          if (parseText) {
            const westCoordinateContainer = $(georegion)
              .find('label:contains("West")')
              .parent()
              .parent();
            insertAfter = westCoordinateContainer.length
              ? westCoordinateContainer
              : georegion;
          }

          // Get the URL to the interactive Google Maps instance
          const url = this.getGoogleMapsUrl(latLngCEN, bounds);

          // Insert the map image
          $(insertAfter).append(
            this.mapTemplate({
              map: mapHTML,
              url,
            }),
          );

          $(".fancybox-media").fancybox({
            openEffect: "elastic",
            closeEffect: "elastic",
            helpers: {
              media: {},
            },
          });
        }

        return true;
      },

      /**
       * Returns a URL to a Google Maps instance that is centered on the given
       * coordinates and zoomed to the appropriate level to display the given
       * bounding box.
       * @param {LatLng} latLngCEN The center point of the map
       * @param {LatLngBounds} bounds The bounding box to display
       * @returns {string} The URL to the Google Maps instance
       */
      getGoogleMapsUrl(latLngCEN, bounds) {
        // Use the window width and height as a proxy for the map dimensions
        const mapDim = {
          height: $(window).height(),
          width: $(window).width(),
        };
        const z = this.getBoundsZoomLevel(bounds, mapDim);
        const mapLat = latLngCEN.lat();
        const mapLng = latLngCEN.lng();

        return `https://maps.google.com/?ll=${mapLat},${mapLng}&z=${z}`;
      },

      /**
       * Returns the zoom level that will display the given bounding box at the
       * given dimensions.
       * @param {LatLngBounds} bounds The bounding box to display
       * @param {object} mapDim The dimensions of the map
       * @param {number} mapDim.height The height of the map
       * @param {number} mapDim.width The width of the map
       * @returns {number} The zoom level
       */
      getBoundsZoomLevel(bounds, mapDim) {
        const WORLD_DIM = { height: 256, width: 256 };
        const ZOOM_MAX = 15;
        // 21 is actual max, but any closer and the map is too zoomed in to be
        // useful

        /**
         * Converts a latitude to radians.
         * @param {number} lat The latitude to convert
         * @returns {number} The latitude in radians
         */
        function latRad(lat) {
          const sin = Math.sin((lat * Math.PI) / 180);
          const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
          return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
        }

        /**
         * Returns the zoom level that will display the given bounding box at
         * the given dimensions.
         * @param {number} mapPx The dimensions of the map
         * @param {number} worldPx The dimensions of the world
         * @param {number} fraction The fraction of the world to display
         * @returns {number} The zoom level
         */
        function zoom(mapPx, worldPx, fraction) {
          return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
        }

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const latFraction = (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI;

        const lngDiff = ne.lng() - sw.lng();
        const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

        const latZoom = zoom(mapDim.height, WORLD_DIM.height, latFraction);
        const lngZoom = zoom(mapDim.width, WORLD_DIM.width, lngFraction);

        return Math.min(latZoom, lngZoom, ZOOM_MAX);
      },

      /**
       * Enable copy controls rendered by the Metacat View Service.
       * @returns {void}
       */
      insertCopiables() {
        this.el
          .querySelectorAll(`.${VIEW_SERVICE_CLASS_NAMES.copy}`)
          .forEach((copiable) => {
            const clipboard = new Clipboard(copiable);
            clipboard.on("success", (e) => {
              const icon = document.createElement("span");
              icon.className = `${VIEW_SERVICE_CLASS_NAMES.icon} ${VIEW_SERVICE_CLASS_NAMES.iconOk} success`;
              e.trigger.replaceChildren(icon);

              setTimeout(() => {
                e.trigger.textContent = "Copy";
              }, 500);
            });
          });
      },

      /**
       * Whether the rendered metadata is ready for provenance charts.
       * @returns {boolean} Whether the charts can be drawn
       */
      canDrawProvCharts() {
        return Boolean(
          this.dataPackage?.getResourceMapModel?.() &&
            this.metadataViewDoc &&
            this.metadataContainer &&
            this.el?.contains?.(this.metadataContainer),
        );
      },

      /**
       * Draw provenance charts when the rendered metadata is ready.
       * @returns {void}
       */
      checkForProv() {
        if (!this.canDrawProvCharts()) return;
        this.redrawProvCharts();
      },

      /**
       * Render source and derivation charts beside each data entity.
       * @returns {void}
       */
      drawProvCharts() {
        const projection = ProvenanceChartAdapter.build(this.dataPackage);

        this.dataPackage.getData().forEach((member) => {
          const context = projection.getRecord(member.pid);
          if (!context) return;

          const sources = projection.getSources(member.pid);
          const derivations = projection.getDerivations(member.pid);
          const canEdit = this.editModeOn && context.editable !== false;
          if (!sources.length && !derivations.length && !canEdit) return;

          const container = this.findEntityDetailsContainer(member);
          if (!container) return;

          // Existing lineage is always displayed. For a program context, only
          // add empty input/output editors when its run can be chosen safely.
          if (sources.length || canEdit) {
            const chart = new ProvChart({
              sources,
              context,
              contextEl: container,
              dataPackage: this.dataPackage,
              projection,
              parentView: this,
              editModeOn: this.editModeOn,
            });
            this.addSubview(chart);
            container.before(chart.render().el);
            this.metadataContainer.classList.add(CLASS_NAMES.gutters);
          }

          if (derivations.length || canEdit) {
            const chart = new ProvChart({
              derivations,
              context,
              contextEl: container,
              dataPackage: this.dataPackage,
              projection,
              parentView: this,
              editModeOn: this.editModeOn,
            });
            this.addSubview(chart);
            container.after(chart.render().el);
            this.metadataContainer.classList.add(CLASS_NAMES.gutters);
          }
        });
      },

      /**
       * Step through all prov charts and rerender each one that has been
       * marked for rerendering.
       * @returns {void}
       */
      redrawProvCharts() {
        this.metadataContainer?.classList?.remove(CLASS_NAMES.gutters);
        (this.subviews || []).forEach((view) => {
          if (view.className?.includes("prov-chart")) view.onClose();
        });
        this.subviews = (this.subviews || []).filter(
          (view) => !view.className?.includes("prov-chart"),
        );
        this.drawProvCharts();
      },

      /**
       * Queue one provenance redraw for the current metadata document.
       * @returns {void}
       */
      scheduleProvChartRedraw() {
        if (this.provChartRedrawQueued) return;
        this.provChartRedrawQueued = true;
        Promise.resolve().then(() => {
          this.provChartRedrawQueued = false;
          if (!this.canDrawProvCharts()) return;
          this.redrawProvCharts();
        });
      },

      /**
       * Finds the element in the rendered metadata that describes the given
       * data entity.
       * @param {(object|string)} model Either a model/member that
       * represents the data object or the identifier of the data object
       * @param {Element} [containerEl] The DOM element to exclusively search
       * inside
       * @returns {jQuery|boolean} The entity section or false if it cannot be
       * found
       */
      findEntityDetailsContainer(model, containerEl) {
        const lookup = this.getEntityDetailsLookup(model);
        if (!lookup.id) return false;

        const root = containerEl ? $(containerEl) : this.$el;
        const section = this.metadataViewDoc.findAndAnnotateEntitySection({
          pid: lookup.id,
          fileName: lookup.fileName,
          metadataPid: this.pid,
          root: root[0] || this.el,
        });

        if (section) return $(section);

        if (lookup.id === this.pid) {
          const metadataSelector = `#${VIEW_SERVICE_IDS.metadata}`;
          return this.$(metadataSelector).length
            ? this.$(metadataSelector)
            : this.$el;
        }

        return this.findSingleEntityDetailsContainer(lookup.id);
      },

      /**
       * Normalize the data needed to find one rendered entity section.
       * @param {object|string} model Model, member, or PID
       * @returns {object} Lookup values
       */
      getEntityDetailsLookup(model) {
        if (typeof model === "string") {
          return {
            id: model,
            fileName: this.getEntityFileNameForPid(model),
          };
        }

        if (!model) return { id: null, fileName: null };

        if (typeof model.get === "function") {
          const id =
            model.get("id") || model.get("pid") || model.get("identifier");
          return {
            id,
            fileName: model.get("fileName") || this.getEntityFileNameForPid(id),
          };
        }

        const id = model.pid || model.id || model.identifier || null;
        return {
          id,
          fileName:
            model.fileName ||
            model.objectName ||
            model.viewServiceEntity?.fileName ||
            this.getEntityFileNameForPid(id),
        };
      },

      /**
       * Get a known file name for a package member PID.
       * @param {string} pid Package member PID
       * @returns {string|null} File name, if known
       */
      getEntityFileNameForPid(pid) {
        if (!pid) return null;

        const member = this.dataPackage?.members?.get?.(pid);
        if (member) {
          return (
            member.fileName ||
            member.objectName ||
            member.viewServiceEntity?.fileName ||
            null
          );
        }

        const entity = this.metadataViewDoc?.entities?.find(
          (candidate) => candidate.pid === pid,
        );

        return entity?.fileName || entity?.objectName || null;
      },

      /**
       * If there is only one data entity and one entity section, assume they
       * match.
       * @param {string} id Entity PID
       * @returns {jQuery|boolean} Matching entity section or false
       */
      findSingleEntityDetailsContainer(id) {
        const entityDetails = this.$(
          `.${VIEW_SERVICE_CLASS_NAMES.entityDetails}`,
        );
        if (entityDetails.length !== 1) return false;

        const dataMembers = this.dataPackage?.getData?.();
        if (Array.isArray(dataMembers) && dataMembers.length === 1) {
          this.metadataViewDoc.annotateEntitySection(entityDetails[0], id);
          return entityDetails;
        }

        const matchingEntities =
          this.metadataViewDoc?.entities?.filter(
            (entity) => entity.pid === id,
          ) || [];
        if (matchingEntities.length === 1) {
          this.metadataViewDoc.annotateEntitySection(entityDetails[0], id);
          return entityDetails;
        }

        return false;
      },

      /**
       * Scroll to a package member instead of navigating away from the dataset.
       * @param {Event} event Preview link click
       * @returns {boolean} Whether the member could be previewed
       */
      previewData(event) {
        event.preventDefault();
        const link = $(event.target).closest("a.preview");
        if (!link.length) return false;

        const id = link.attr("data-id");
        if (!id) return false;

        window.location.hash = encodeURIComponent(id);
        MetacatUI.appView.scrollTo(this.findEntityDetailsContainer(id));
        return true;
      },

      /**
       * When the user clicks on a node in the provenance chart, highlight the
       * node and its metadata section
       * @param {Event} e The click event
       * @returns {void}
       */
      highlightNode(e) {
        // PART OF PROV
        // Find the id
        let id = $(e.target).attr("data-id");

        if (typeof id === "undefined" || !id)
          id = $(e.target).parents("[data-id]").attr("data-id");

        // If there is no id, return
        if (typeof id === "undefined") return;

        // Highlight its node
        $(
          `.${CLASS_NAMES.provChart} .${CLASS_NAMES.node}[data-id='${id}']`,
        ).toggleClass(CLASS_NAMES.active);

        // Highlight its metadata section
        if (MetacatUI.appModel.get("pid") === id)
          this.$(`#${VIEW_SERVICE_IDS.metadata}`).toggleClass(
            CLASS_NAMES.active,
          );
        else {
          const entityDetails = this.findEntityDetailsContainer(id);
          if (entityDetails) entityDetails.toggleClass(CLASS_NAMES.active);
        }
      },

      /**
       * Enhance each rendered data entity section with the additional details
       * that aren't part of the View Service markup: an inline preview for
       * image objects, and the download/view interaction buttons.
       * @returns {void}
       */
      insertDataDetails() {
        const dataMembers = this.dataPackage?.getData?.() || [];

        // Don't add previews/buttons to very large packages.
        if (dataMembers.length > 150) return;

        dataMembers.forEach((member) => {
          const container = this.findEntityDetailsContainer(member);
          if (!container) return;

          if (this.getMemberFormatId(member).startsWith("image/")) {
            this.insertImagePreview(member, container);
          }

          this.renderDataInteractionButtons(member, container);
        });

        this.$("a.fancybox[data-fancybox-type='image']").fancybox({
          type: "image",
          aspectRatio: true,
          closeClick: true,
        });
      },

      /**
       * Get the format ID for a package member, preferring System Metadata.
       * @param {DataPackageMember} member Package member
       * @returns {string} The member's format ID, or an empty string
       */
      getMemberFormatId(member) {
        return member?.sysMeta?.formatId || member?.formatId || "";
      },

      /**
       * Adapt a package member into a model shaped like a SolrResult for the
       * data download/view buttons, which consume the SolrResult API (`get()`,
       * `getInfo()`, `downloadWithCredentials()`).
       * @param {DataPackageMember} member Package member
       * @returns {SolrResult|null} The adapter model, or null when no member
       */
      createDataDetailsModel(member) {
        if (!member) return null;
        return new SolrResult({
          ...member.toJSON(),
          id: member.pid,
        });
      },

      /**
       * Insert an inline image preview into a data entity's section.
       * @param {DataPackageMember} member The image package member
       * @param {jQuery} container The entity section to insert the preview into
       * @returns {Promise<void>} Resolves after the preview is prepared
       */
      async insertImagePreview(member, container) {
        const base = MetacatUI.appModel.get("objectServiceUrl") || "";
        const id = member.pid || "";
        const src = id
          ? UrlUtilities.getObjectDownloadUrl(id, {
              baseUrl: base.replace(/\/?$/, "/"),
            })
          : null;
        if (!src) return;

        const dataDisplay = $.parseHTML(
          this.dataDisplayTemplate({
            type: "image",
            src,
            objID: member.pid,
          }).trim(),
        );

        if (container.children("label").length) {
          container.children("label").first().after(dataDisplay);
        } else {
          container.prepend(dataDisplay);
        }

        let isPublic;
        try {
          isPublic =
            typeof member.isPublic === "function"
              ? await member.isPublic()
              : member.isPublic;
        } catch {
          return;
        }
        if (this.isClosed || this.signal?.aborted) return;
        if (isPublic === false) {
          try {
            const blob = await new ObjectService().download(member.pid);
            if (this.isClosed || this.signal?.aborted) return;
            const objectUrl = window.URL.createObjectURL(blob);
            this.previewObjectUrls.add(objectUrl);
            $(dataDisplay).find("img").attr("src", objectUrl);
          } catch {
            // Keep the original object-service URL when private preview fails.
          }
        }
      },

      /**
       * Insert the buttons to download and view a data object beside its entity
       * details.
       *
       * The button views consume a SolrResult shaped model created by
       * createDataDetailsModel()
       * @param {DataPackageMember} member The package member for the object
       * @param {jQuery} container The entity section that describes the object
       * @returns {Promise<void>} Resolves after public access is checked
       */
      async renderDataInteractionButtons(member, container) {
        if (!member || !container) return;

        let isPublic = null;
        try {
          isPublic =
            typeof member.isPublic === "function"
              ? await member.isPublic()
              : member.isPublic;
        } catch {
          // Unknown access falls back to the credentialed download path.
        }
        if (this.isClosed || this.signal?.aborted) return;

        const containerEl = $(container);
        const dataModel = this.createDataDetailsModel(member);
        dataModel.set("isPublic", isPublic ?? null);
        const buttonsContainer = document.createElement("div");
        buttonsContainer.classList.add(
          "control-group",
          "data-interaction-buttons",
        );

        // Create a button to download the data object
        try {
          const downloadButton = new DownloadButtonView({ model: dataModel });
          downloadButton.render();
          this.addSubview(downloadButton);
          buttonsContainer.appendChild(downloadButton.el);
        } catch {
          // Rendering this optional control should not break data details.
        }

        // Create a button to view the data object
        try {
          const viewButton = new ViewObjectButtonView({
            model: dataModel,
            modalContainer: this.$el,
          });
          viewButton.render();
          this.addSubview(viewButton);
          buttonsContainer.appendChild(viewButton.el);
        } catch {
          // Rendering this optional control should not break data details.
        }

        // Don't insert an empty container if neither button rendered.
        if (!buttonsContainer.childElementCount) return;

        const nameLabel = containerEl.find("label:contains('Entity Name')");
        if (nameLabel.length) {
          nameLabel.parent().after(buttonsContainer);
        } else {
          containerEl.prepend(buttonsContainer);
        }
      },

      /**
       * Replace the current message with an alert
       * @param {string|HTMLElement|jQuery} message Alert content
       * @param {object} [options] Alert options
       * @param {string} [options.type] Alert type
       * @returns {HTMLElement} Message container
       */
      showMessage(message, options = {}) {
        this.hideMessages();
        const type = options.type || "info";
        const alertHTML = this.alertTemplate({
          msg: message,
          classes: CLASS_NAMES.alert(type),
          containerClasses: "page",
        });
        this.messageContainer.innerHTML = alertHTML;
        return this.messageContainer;
      },

      /**
       * Remove all current messages.
       * @returns {void}
       */
      hideMessages() {
        this.messageContainer.innerHTML = "";
      },

      /**
       * Clean up the view and its subviews.
       * @returns {void}
       */
      onClose() {
        this.isClosed = true;
        this.stopListening();

        this.previewObjectUrls.forEach((url) => {
          window.URL.revokeObjectURL(url);
        });
        this.previewObjectUrls.clear();

        _.each(this.subviews, (subview) => {
          if (subview.onClose) subview.onClose();
        });
        this.subviews = [];
        this.pid = null;
        this.dataPackage = null;

        // Remove view-specific classes
        this.$el.removeClass(
          `${CLASS_NAMES.container} ${CLASS_NAMES.noStylesheet}`,
        );

        this.$el.empty();
      },

      /**
       * Insert the interactive annotation views.
       * @returns {void}
       */
      createAnnotationViews() {
        this.el
          .querySelectorAll(`.${VIEW_SERVICE_CLASS_NAMES.annotation}`)
          .forEach((annotationEl) => {
            const annotationView = new AnnotationView({
              el: annotationEl,
            }).render();
            this.addSubview(annotationView);
          });
      },

      /**
       * Insert the markdown views.
       * @returns {void}
       */
      insertMarkdownViews() {
        this.el
          .querySelectorAll(`.${VIEW_SERVICE_CLASS_NAMES.markdown}`)
          .forEach((markdownEl) => {
            const markdownView = new MarkdownView({
              markdown: markdownEl.textContent.trim(),
              el: markdownEl.parentElement,
            });

            this.addSubview(markdownView);

            // Clear out old content before rendering
            markdownEl.remove();

            markdownView.render();
          });
      },
    },
  );

  return MetadataDocumentView;
});
