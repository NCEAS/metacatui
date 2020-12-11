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

      events: {},

      render: function() {
        //Save the view and model on the element
        this.$el
          .data({
            model: this.model,
            view: this
          })
          .attr("data-category", "project");

        if (this.edit) {
          this.$el.html(this.editTemplate({
            award: this.model.get('award')
          }));
        }

        return this;
      }
    }
  );

  return EMLProjectView;
});
