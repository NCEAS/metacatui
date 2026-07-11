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
   * @screenshot views/versionHistory/VersionTimelineGroupsView.png
   * @since 2.37.0
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
        this.listenTo(this.collection, "reset sort", this.render);
        this.listenTo(this.collection, "change:models", this.updateGroupModels);
        this.listenTo(
          this.collection,
          "change:date change:label",
          this.updateGroupDate,
        );
      },

      /**
       * Ensure a child group view exists for the given model.
       * @param {Backbone.Model} model VersionTimeLineGroup model (defined in
       * VersionTimelineGroups collection).
       * @returns {VersionTimelineGroupView} The group view instance.
       */
      ensureChildView(model) {
        let view = this.childViews.get(model.cid);
        if (!view) {
          view = new VersionTimelineGroupView({
            model,
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
       * Update the group view's date header when its date or label changes.
       * @param {Backbone.Model} model Updated group model.
       */
      updateGroupDate(model) {
        const view = this.childViews.get(model.cid);
        if (view) {
          view.setDateAndLabel(model.get("date"), model.get("label"));
        }
      },

      /**
       * Render all group views in the collection.
       * @returns {VersionTimelineGroupsView} The view instance.
       */
      render() {
        const fragment = document.createDocumentFragment();
        this.collection.each((model) => {
          const view = this.ensureChildView(model);
          fragment.appendChild(view.el);
        });
        this.el.appendChild(fragment);
        return this;
      },

      /**
       * Sync the ObjectGroupViews hidden/conflict classes with their models'
       * hiddenByUI and hasDateConflict properties. Run after batch-updating
       * models.
       */
      updateVisualState() {
        this.childViews.forEach((view) => view.updateVisualState());
      },

      /**
       * Add tooltips to the ObjectVersionViews within each group.
       */
      addTooltips() {
        this.childViews.forEach((view) => view.addTooltips());
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
