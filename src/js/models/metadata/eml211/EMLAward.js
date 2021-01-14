/* global define */
define(["jquery", "underscore", "backbone", "models/DataONEObject"], function(
  $,
  _,
  Backbone,
  DataONEObject
) {
  var EMLAward = Backbone.Model.extend({
    defaults: {
      objectDOM: null,
      parentModel: null,
      funderName: null,
      funderIdentifier: null,
      awardNumber: null,
      title: null,
      awardUrl: null,
      awardFields: null
    },

    initialize: function(options) {
      if (options && options.objectDOM) this.set(this.parse(options.objectDOM));
    },

    nodeNameMap: function() {
      return {
        title: "title",
        fundername: "funderName",
        funderidentifier: "funderIdentifier",
        awardnumber: "awardNumber",
        awardurl: "awardUrl"
      };
    },

    emlEditorAwardFieldLabels: {
      title: "Award Title",
      funderName: "Funder Name",
      funderIdentifier: "Funder Identifier",
      awardNumber: "Award Number",
      awardUrl: "Award URL"
    },

    emlEditorAwardFields: {
      funderIdentifier: true,
      awardNumber: true,
      awardUrl: true
    },

    parse: function(objectDOM) {
      if (!objectDOM) var objectDOM = this.get("objectDOM");

      var modelJSON = {};

      modelJSON.title =
        $(objectDOM)
          .children("title")
          .text() || null;
      modelJSON.funderName =
        $(objectDOM)
          .children("fundername, funderName")
          .text() || null;
      modelJSON.funderIdentifier =
        $(objectDOM)
          .children("funderidentifier, funderIdentifier")
          .text() || null;
      modelJSON.awardNumber =
        $(objectDOM)
          .children("awardnumber, awardNumber")
          .text() || null;
      modelJSON.awardUrl =
        $(objectDOM)
          .children("awardurl, awardUrl")
          .text() || null;

      return modelJSON;
    },

    updateDOM: function() {
      var objectDOM;
      if (this.get("objectDOM")) {
        objectDOM = this.get("objectDOM").cloneNode(true);
      } else {
        objectDOM = $(document.createElement("award"));
      }

      _.each(
        this.nodeNameMap(),
        function(modelName, domName) {
          var modelValue = this.get(modelName);
          var objectDomEl = $(objectDOM);
          var domNameEl = objectDomEl.find(domName);

          if (!modelValue) {
            return;
          }
          if (domNameEl.text() === modelValue) {
            return;
          }

          if (domNameEl[0]) {
            domNameEl.replaceWith(`<${domName}>${modelValue}</${domName}>`);
          } else {
            objectDomEl.append(`<${domName}>${modelValue}</${domName}>`);
          }

          this.trickleUpChange();
        },
        this
      );

      return objectDOM;
    },

    trickleUpChange: function() {
      MetacatUI.rootDataPackage.packageModel.set("changed", true);
    }
  });

  return EMLAward;
});
