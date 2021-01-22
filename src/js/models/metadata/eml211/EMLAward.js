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
      awardUrl: null
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
      modelJSON.funderIdentifier = [];
      var funderidentifier = $(objectDOM).children(
        "funderidentifier, funderIdentifier"
      );
      _.each(funderidentifier, function(item) {
        modelJSON.funderIdentifier.push(item.innerText);
      });
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
      var objectDOM = $(document.createElement("award"));

      _.each(
        this.nodeNameMap(),
        function(modelName, domName) {
          var modelValue = this.get(modelName);

          if (!modelValue) {
            return;
          }

          if (Array.isArray(modelValue)) {
            modelValue.forEach(function(value) {
              var element = document.createElement(domName);
              element.innerText = value;
              objectDOM.append(element);
            });
          } else {
            var element = document.createElement(domName);
            element.innerText = modelValue;
            objectDOM.append(element);
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
