define([
  "underscore",
  "jquery",
  "backbone",
  "models/DataONEObject",
  "models/metadata/ScienceMetadata",
  "models/metadata/eml211/EML211",
  "views/metadata/EML211View",
  "text!templates/metadata.html",
], function (
  _,
  $,
  Backbone,
  DataONEObject,
  ScienceMetadata,
  EML,
  EMLView,
  Template,
) {
  var DatasetView = Backbone.View.extend({
    el: "#Content",

    /* Templates */
    template: _.template(Template),

    events: {},

    id: null,
    seriesId: null,

    /* A list of the subviews */
    subviews: [],

    initialize: function (options) {
      if (options === undefined || !options) var options = {};

      this.id =
        options.pid || options.id || MetacatUI.appModel.get("pid") || null;

      if (typeof options.el !== "undefined") this.setElement(options.el);

      return this;
    },

    /* Render the view */
    render: function () {
      this.$el.append(this.template());

      MetacatUI.appModel.set("headerType", "default");

      //Get the model and when it's found, render it
      this.on("modelFound", this.renderMetadata);
      this.getModel();

      return this;
    },

    //Retrieves info on and creates a model for this metadata
    getModel: function () {
      //The Model and ID
      if (!this.id) return false;

      var model = new DataONEObject({ id: this.id });

      var viewRef = this;

      //Get information about this object
      this.listenToOnce(model, "sync", function (model) {
        //Is this an EML 2.1.1 doc?
        if (model.get("formatid") == "eml://ecoinformatics.org/eml-2.1.1") {
          var metadataModel = new EML(model.toJSON());

          //Save the model in the view and trigger the event
          viewRef.model = metadataModel;
          viewRef.trigger("modelFound");
        } else if (model.get("formatType") == "DATA") {
          //Get the metadata doc that documents this data object
          if (model.get("isDocumentedBy")) {
            //Just default to the first one for now
            var isDocBy = model.get("isDocumentedBy");
            if (Array.isArray(isDocBy)) isDocBy = isDocBy[0];
            viewRef.getModel(isDocBy);
          }
          //If there is no metadata doc, then just use the data model
          else {
            //Save the model in the view and trigger the event
            viewRef.model = model;
            viewRef.trigger("modelFound");
          }
        } else if (model.get("formatType") == "RESOURCE") {
          //TODO: Create a data package collection and add this resource map to it, then call a function to find the metadata
        }
      });
      model._fetch();

      return model;
    },

    //Render the metadata display using the attributes of the model
    //TODO: Render the metadata
    renderMetadata: function () {
      this.$el.html("metadata goes here");
    },

    // This function is called when there is no metadata document in this dataset. Only system metadata will be displayed.
    //TODO: Fill in from old MetadataView
    noMetadata: function () {},

    /* Close the view and its sub views */
    close: function () {
      this.remove(); // remove for the DOM, stop listening
      this.off(); // remove callbacks, prevent zombies

      this.model = null;
      this.id = null;
      this.seriesId = null;

      // Close each subview
      _.each(this.subviews, function (i, subview) {
        subview.close();
      });

      this.subviews = [];
      window.onbeforeunload = null;
    },
  });
  return DatasetView;
});
