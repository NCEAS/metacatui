/*global define */
define([
    "jquery",
    "underscore",
    "backbone",
    "text!templates/entityModal.html",
  ], function ($, _, Backbone, Template) {
    "use strict";
  
    /**
     * @class EntityModalView
     * @classdesc 
     * @classcategory Views
     * @extends Backbone.View
     */
    var EntityModalView = Backbone.View.extend(
      /** @lends EntityModalView.prototype */ {
        /**
         * Classes to add to the modal
         * @type {string}
         */
        className: "entity modal fade hide",
  
        /**
         * The underscore template for the main part of this view (modal)
         * @type {Underscore.Template}
         */
        template: _.template(Template),
  
        /**
         * The events this view will listen for. See
         * {@link https://backbonejs.org/#View-events}
         * @type {Object}
         */
        events: {
          hidden: "teardown",
        },
  
        /**
         * Initialize a new EntityModalView
         * @param {Object} options - A literal object with options to pass to the
         * view
         */
        initialize: function (options) {
          if (typeof options === "undefined") {
            var options = {};
          }
          this.id = options.id || undefined;
          this.entityEl = options.entityEl || "";
          this.entityName = options.entityName || "";
          this.downloadEl = options.downloadEl || "";
        },
  
        /**
         * Render the view
         */
        render: function () {
          // Set listeners
          this.$el.off("shown");
          this.$el.on("shown", this.renderView.bind(this));
          this.show();
          return this;
        },
  
        /**
         * Render the view
         * @returns {EntityModalView} - Returns this view
         */
        renderView: function () {
          try {
            var view = this;
            // Render the modal
            this.el.innerHTML = this.template({

            });

            this.$(".entity-name").text(this.entityName);

            this.$(".entity-container").html(this.entityEl);

            this.$(".download-button-container").html(this.downloadEl);

          } catch (e) {
            console.error("Failed to render the Entity Modal View: ", e);
            MetacatUI.appView.showAlert({
              message: `Something went wrong displaying the entities for this dataset.`,
              classes: "alert-info",
              container: this.$el,
              replaceContents: true,
              includeEmail: true,
            });
          } finally {
            this.$el.modal({ show: false }); // don't show modal on instantiation
          }
        },
  
        /**
         * Make the modal visible
         */
        show: function () {
          this.$el.modal("show");
        },
  
        /**
         * Remove the modal from the DOM
         */
        teardown: function () {
          this.$el.modal("hide");
          this.$el.data("modal", null);
          this.remove();
        },
  
        /**
         * Cleans up and removes all artifacts created for view
         */
        onClose: function () {
          this.teardown();
        },
      }
    );
  
    return EntityModalView;
  });
  