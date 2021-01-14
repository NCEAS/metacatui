/* global define */
define([
  "underscore",
  "jquery",
  "backbone",
  "models/metadata/eml211/EMLProject",
  "models/metadata/eml211/EMLText",
  "text!templates/metadata/EMLProject.html"
], function(_, $, Backbone, EMLProject, EMLText, EMLProjectTemplate) {
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

        if (this.edit) {
          this.$el.html(
            this.editTemplate({
              award: this.model.get("award"),
              awardFields: this.model.get("awardFields")
            })
          );
        }

        return this;
      },

      /*
       * Remove this award
       */
      removeAward: function(e) {
        //Get the index of this award
        var awardEl = $(e.target).parent(".award-container"),
          index = this.$(".award-container").index(awardEl),
          view = this;

        //Remove this award from the model
        this.model.removeAward(index)
        this.model.trickleUpChange()

        //Remove the award elements from the page
        awardEl.slideUp("fast", function() {
          this.remove();

          //Bump down all the award numbers
          var awardNums = view.$(".award-num");

          for (var i = index; i < awardNums.length; i++) {
            $(awardNums[i]).text(i + 1);
          }
        });
      },

      previewRemove: function(e){
        $(e.target).parents(".award-container").toggleClass("remove-preview");
      }
    }
  );

  return EMLProjectView;
});
