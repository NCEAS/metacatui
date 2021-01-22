/* global define */
define([
  "underscore",
  "jquery",
  "backbone",
  "views/metadata/EMLAwardView",
  "models/metadata/eml211/EMLProject",
  "models/metadata/eml211/EMLAward",
  "text!templates/metadata/EMLProject.html"
], function(
  _,
  $,
  Backbone,
  EMLAwardView,
  EMLProject,
  EMLAward,
  EMLProjectTemplate
) {
  /**
   * @class EMLProjectView
   * @classdesc The EMLProject renders the content of an EMLProject model
   * @classcategory Views/Metadata
   * @extends Backbone.View
   */
  var EMLProjectView = Backbone.View.extend(
    /** @lends EMLProjectView.prototype */ {
      type: "EMLProjectView",

      tagName: "div",

      className: "row-fluid eml-project",

      editTemplate: _.template(EMLProjectTemplate),

      initialize: function(options) {
        options = options || {};

        this.isNew = options.isNew || (options.model ? false : true);
        this.model = options.model || new EMLProject();
        this.edit = options.edit || false;

        this.$el.data({ model: this.model });
      },

      events: {
        "keyup .award-container.new": "addNewAward",
        "click .remove": "removeAward",
        "mouseover .remove": "previewRemove",
        "mouseout .remove": "previewRemove"
      },

      render: function() {
        //Save the view and model on the element
        this.$el
          .data({
            model: this.model,
            view: this
          })
          .attr("data-category", "project");

        this.$el.html(this.editTemplate());

        var awardRowEl = this.$(".award-row");
        _.each(
          this.model.get("award"),
          function(award) {
            var awardView = new EMLAwardView({
              model: award,
              edit: this.edit,
              isNew: false
            });

            awardRowEl.append(awardView.render().el);
          },
          this
        );

        this.addNewAward();

        return this;
      },

      /**
       * Remove award from DOM and awards model.
       * @param {e} - The event
       */
      removeAward: function(e) {
        //Get the index of this award
        var awardEl = $(e.target).parents(".eml-award"),
          index = this.$(".eml-award").index(awardEl);

        //Remove this award from the model
        this.model.removeAward(index);

        //Remove the award elements from the page
        awardEl.slideUp("fast", function() {
          this.remove();
        });
      },

      /**
       * Add empty awards form to DOM.
       */
      addNewAward: function() {
        // update DOM for last award
        this.$(".award-container.new")
          .removeClass("new")
          .prepend('<i class="remove icon-remove"></i>');

        // add new award to DOM
        var awardView = new EMLAwardView({
          model: new EMLAward({ parentModel: this.model }),
          edit: this.edit,
          isNew: true
        });

        this.$(".award-row").append(awardView.render().el);
      },

      previewRemove: function(e) {
        $(e.target)
          .parents(".award-container")
          .toggleClass("remove-preview");
      }
    }
  );

  return EMLProjectView;
});
