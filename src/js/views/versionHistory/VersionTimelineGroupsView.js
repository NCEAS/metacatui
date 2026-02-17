define(["backbone", "views/versionHistory/VersionTimelineGroupView"], (
  Backbone,
  VersionTimelineGroupView,
) => {
  "use strict";

  /**
   * @class VersionTimelineGroupsView
   * @classdesc A view that manages and renders multiple
   * VersionTimelineGroupView instances, each representing a group of object
   * versions for a specific date.
   * @classcategory Views/VersionHistory
   * @augments Backbone.View
   * @screenshot views/VersionTimelineGroupsView.png // TODO: add screenshot
   * @since 0.0.0
   */
  const VersionTimelineGroupsView = Backbone.View.extend(
    /** @lends VersionTimelineGroupsView.prototype */ {
      /**
       * Identifier used when the application inspects view types.
       * @type {string}
       */
      type: "VersionTimelineGroupsView",

      /**
       * Initialize the view and bind collection listeners.
       * @param {object} options View options.
       * @param {string} [options.referencePid] PID used for badge context.
       */
      initialize(options) {
        this.collection = options.collection; // TODO
        this.referencePid = options.referencePid || null;
        this.childViews = new Map();
        this.listenTo(this.collection, "add", this.addOne);
        this.listenTo(this.collection, "remove", this.removeOne);
        this.listenTo(this.collection, "reset sort", this.renderAll);
        this.listenTo(this.collection, "change:models", this.updateGroupModels);
      },

      /**
       * Ensure a child group view exists for the given model.
       * @param {Backbone.Model} model Group model.
       * @returns {VersionTimelineGroupView} The group view instance.
       */
      ensureChildView(model) {
        let view = this.childViews.get(model.cid);
        if (!view) {
          view = new VersionTimelineGroupView({
            date: model.get("date"),
            collection: model.get("models"),
            referencePid: this.referencePid,
          }).render();
          this.childViews.set(model.cid, view);
        }
        return view;
      },

      /**
       * Add a group view for a newly added model.
       * @param {Backbone.Model} model Added group model.
       */
      addOne(model) {
        const view = this.ensureChildView(model);
        this.el.appendChild(view.el);
      },

      /**
       * Remove the group view for a removed model.
       * @param {Backbone.Model} model Removed group model.
       */
      removeOne(model) {
        const view = this.childViews.get(model.cid);
        if (view) {
          view.remove();
          this.childViews.delete(model.cid);
        }
      },

      /**
       * Update the group view's models when the group changes.
       * @param {Backbone.Model} model Updated group model.
       */
      updateGroupModels(model) {
        const view = this.childViews.get(model.cid);
        if (view) {
          view.setModels(model.get("models"));
        }
      },

      /**
       * Render all group views in the collection.
       * @returns {this} The view instance.
       */
      renderAll() {
        const fragment = document.createDocumentFragment();
        this.collection.each((model) => {
          const view = this.ensureChildView(model);
          fragment.appendChild(view.el);
        });
        this.el.appendChild(fragment);
        return this;
      },

      /**
       * Render wrapper that delegates to renderAll.
       * @returns {this} The view instance.
       */
      render() {
        return this.renderAll();
      },

      /**
       * Clean up child views.
       */
      onClose() {
        this.childViews.forEach((view) => view.remove());
        this.childViews.clear();
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return VersionTimelineGroupsView;
});
