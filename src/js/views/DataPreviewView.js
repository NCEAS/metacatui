define(["underscore", "jquery", "backbone", "models/DataONEObject"], function (
  _,
  $,
  Backbone,
  DataONEObject,
) {
  /* 
            A DataPreviewView shows a thumbnail of a DataONEObject
        */
  var DataPreviewView = Backbone.View.extend({
    tagName: "div",

    className: "data-preview thumbnail",

    id: null,

    /* Events this view listens to */
    events: {},

    initialize: function (options) {
      if (!options) var options = {};

      this.model = options.model || new DataONEObject();
    },

    render: function () {
      var format = this.model.get("formatId") || this.model.get("mediaType");

      if (format && format.indexOf("image") > -1) {
        var previewImg = $(document.createElement("img")),
          previewHTML = $(document.createElement("div"))
            .addClass("thumbnail-square")
            .append(previewImg);

        if (this.model.isNew()) {
          var reader = new FileReader();

          reader.addEventListener(
            "load",
            function () {
              previewImg.attr("src", reader.result);
            },
            false,
          );

          reader.readAsDataURL(this.model.get("uploadFile"));
        } else {
          previewImg.attr(
            "src",
            MetacatUI.appModel.get("objectServiceUrl") +
              encodeURIComponent(this.model.get("id")),
          );
        }

        this.$el.append(previewHTML);
      }
    },
  });

  return DataPreviewView;
});
