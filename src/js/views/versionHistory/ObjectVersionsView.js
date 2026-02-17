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
   * @since 0.0.0
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
        this.listenTo(this.collection, "update sort", this.render);
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
        this.onClose(); // Remove existing subviews and listeners
        this.listenToCollection();
        this.el.innerHTML = this.template(this.model);

        this.collection.each((model) => {
          const objectVersionView = new ObjectVersionView({
            model,
            referencePid: this.referencePid,
          });
          this.el.prepend(objectVersionView.render().el);
          // Keep track of subviews so we can remove them later
          this.subViews.push(objectVersionView);
        });

        return this;
      },

      /**
       * Cleans up and removes all the ObjectVersionView subviews.
       */
      removeSubViews() {
        const sv = this.subViews;
        if (sv && Array.isArray(sv)) {
          sv.forEach((subView) => {
            if (typeof subView.onClose === "function") {
              subView.onClose();
            }
            subView.remove();
          });
        }
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
