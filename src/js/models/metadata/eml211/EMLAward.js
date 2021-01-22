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
        fundername: "funderName",
        funderidentifier: "funderIdentifier",
        awardnumber: "awardNumber",
        title: "title",
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

          var element = document.createElement(domName);
          element.innerText = modelValue;

          if (domNameEl[0]) {
            domNameEl.replaceWith(element);
          } else {
            objectDomEl.append(element);
          }

          this.trickleUpChange();
        },
        this
      );

      return objectDOM;
    },

    /*
     * Climbs up the model heirarchy until it finds the EML model
     *
     * @return {EML211 or false} - Returns the EML 211 Model or false if not found
     */
    getParentEML: function() {
      var emlModel = this.get("parentModel"),
        tries = 0;

      while (emlModel.type !== "EML" && tries < 6) {
        emlModel = emlModel.get("parentModel");
        tries++;
      }

      if (emlModel && emlModel.type == "EML") return emlModel;
      else return false;
    },

    validate: function() {
      var errors = {};

      if (!this.get("funderName")) {
        errors.funderName = "Provide a funder name.";
      }

      if (!this.get("title")) {
        errors.title = "Provide an award title.";
      }

      if (Object.keys(errors).length) {
        return errors;
      }
    },

    trickleUpChange: function() {
      MetacatUI.rootDataPackage.packageModel.set("changed", true);
    }
  });

  return EMLAward;
});
