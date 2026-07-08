/**
 * Backbone view responsible for rendering the list (<ul>) of individual
 * object versions that belong to a specific timeline group.
 */
define([
  "backbone",
  "collections/DataONEObjects",
  "views/versionHistory/ObjectVersionView",
], (Backbone, DataONEObjects, ObjectVersionView) => {
  "use strict";

  const BASE_CLASS = "object-versions";

  /**
   * CSS class names used throughout the ObjectVersionsView.
   * @enum {string}
   */
  const CLASS_NAMES = {
    base: BASE_CLASS,
  };

  /**
   * @class ObjectVersionsView
   * @classdesc A view that renders a list of object versions as <li> elements.
   * @classcategory Views/VersionHistory
   * @augments Backbone.View
   * @screenshot views/versionHistory/ObjectVersionsView.png
   * @since 2.37.0
   */
  const ObjectVersionsView = Backbone.View.extend(
    /** @lends ObjectVersionsView.prototype */ {
      /**
       * Identifier used when the application inspects view types.
       * @type {string}
       */
      type: "ObjectVersionsView",

      /** @inheritdoc */
      tagName: "ul",

      /** @inheritdoc */
      className: CLASS_NAMES.base,

      /**
       * @param {object} options Options passed to the view.
       * @param {DataONEObjects} options.collection Collection containing the versions to render.
       */
      initialize(options = {}) {
        this.collection =
          options.collection instanceof DataONEObjects
            ? options.collection
            : new DataONEObjects();
        this.subViews = [];
        this.subViewsByCid = new Map();
        this.referencePid = options.referencePid || null;
      },

      /**
       * Hook for future template customizations; currently unused placeholder.
       * @param {DataONEObjects} _collection The DataONEObjects collection.
       * @returns {string} HTML string
       */
      template(_collection) {
        return "";
      },

      /**
       * Swap the backing collection and refresh bindings.
       * @param {DataONEObjects} newCollection The collection to replace the
       * current one.
       */
      changeCollection(newCollection) {
        if (this.collection === newCollection) return;
        this.stopListeningCollection();
        this.collection = newCollection;
        this.render();
      },

      /**
       * Listens to collection events to trigger re-rendering.
       */
      listenToCollection() {
        this.stopListeningCollection();
        this.listenTo(
          this.collection,
          "add remove update sort reset",
          this.syncViews,
        );
      },

      /**
       * Stops listening to collection events.
       */
      stopListeningCollection() {
        if (this.collection) {
          this.stopListening(this.collection);
        }
      },

      /**
       * Renders <li> children for each DataONE object version.
       * @returns {this} The view instance
       */
      render() {
        this.listenToCollection();
        this.el.innerHTML = this.template(this.model);
        this.syncViews();
        return this;
      },

      /**
       * Ensure row subviews match the collection contents and order.
       * Reuses existing row views to avoid rebuilding the full list on each
       * incremental collection update.
       * @returns {this} The view instance.
       */
      syncViews() {
        if (!this.collection) return this;

        const activeCids = new Set(this.collection.map((model) => model.cid));
        this.subViewsByCid.forEach((subView, cid) => {
          if (!activeCids.has(cid)) {
            if (typeof subView.onClose === "function") {
              subView.onClose();
            }
            subView.remove();
            this.subViewsByCid.delete(cid);
          }
        });

        const fragment = document.createDocumentFragment();
        const newSubViews = [];
        const viewsNeedingInitialRender = [];

        this.collection.each((model) => {
          let subView = this.subViewsByCid.get(model.cid);
          if (!subView) {
            subView = new ObjectVersionView({
              model,
              referencePid: this.referencePid,
            });
            this.subViewsByCid.set(model.cid, subView);
            viewsNeedingInitialRender.push(subView);
          } else if (subView.model !== model) {
            subView.changeModel(model);
          }

          fragment.appendChild(subView.el);
          newSubViews.push(subView);
        });

        this.el.appendChild(fragment);
        viewsNeedingInitialRender.forEach((subView) => subView.render());
        this.subViews = newSubViews;

        return this;
      },

      /** Show or hide sub-views based on their model's hiddenByUI attribute */
      applyVisibilityState() {
        this.subViews.forEach((subView) => subView.applyVisibilityState?.());
      },

      /**
       * Manually add tooltips to sub-views. Useful if they've been rendered
       * while not in the DOM.
       */
      addTooltips() {
        this.subViews.forEach((subView) => subView.addTooltips?.());
      },

      /**
       * Cleans up and removes all the ObjectVersionView subviews.
       */
      removeSubViews() {
        this.subViewsByCid.forEach((subView) => {
          if (typeof subView.onClose === "function") {
            subView.onClose();
          }
          subView.remove();
        });
        this.subViewsByCid.clear();
        this.subViews = [];
      },

      /**
       * Stops collection listeners prior to removal.
       */
      onClose() {
        this.removeSubViews();
        this.stopListeningCollection();
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return ObjectVersionsView;
});
