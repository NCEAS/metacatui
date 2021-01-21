/* global define */
define([
  "underscore",
  "jquery",
  "backbone",
  "models/metadata/eml211/EMLAward",
  "text!templates/metadata/EMLAward.html"
], function(_, $, Backbone, EMLAward, EMLAwardTemplate) {
  /**
   * @class EMLAwardView
   * @classdesc The EMLAward renders the content of an EMLAward model
   * @classcategory Views/Metadata
   * @extends Backbone.View
   */
  var EMLAwardView = Backbone.View.extend(
    /** @lends EMLAwardView.prototype */ {
      type: "EMLAwardView",

      tagName: "div",

      className: "row-fluid eml-award",

      editTemplate: _.template(EMLAwardTemplate),

      initialize: function(options) {
        options = options || {};

        this.isNew = options.isNew || (options.model ? false : true);
        this.model = options.model || new EMLAward();
        this.edit = options.edit || false;

        this.$el.data({ model: this.model });
      },

      events: {
        change: "updateModel"
      },

      render: function() {
        //Save the view and model on the element
        this.$el.data({
          model: this.model,
          view: this
        });

        this.$el.html(
          this.editTemplate({
            award: this.model,
            awardFields: new EMLAward().emlEditorAwardFieldLabels,
            isNew: this.isNew
          })
        );

        this.$(".award-search-container")
          .first()
          .append(this.createAwardSearch());

        return this;
      },

      createAwardSearch: function() {
        var awardSearchInput = $(document.createElement("input"))
            .attr("type", "text")
            .attr("data-category", "award-search")
            .addClass("span12 award-search hover-autocomplete-target")
            .attr("placeholder", "Search for NSF awards by keyword"),
          loadingSpinner = $(document.createElement("i")).addClass(
            "icon icon-spinner input-icon icon-spin subtle "
          );

        //Append all the elements to a container
        var containerEl = $(document.createElement("div"))
          .addClass("ui-autocomplete-container award-search-row")
          .append(awardSearchInput, loadingSpinner);

        //Setup the autocomplete widget for the awardSearch input
        awardSearchInput.autocomplete({
          source: function(request, response) {
            var beforeRequest = function() {
              loadingSpinner.show();
            };

            var afterRequest = function() {
              loadingSpinner.hide();
            };

            return MetacatUI.appLookupModel.getGrantAutocomplete(
              request,
              response,
              beforeRequest,
              afterRequest
            );
          },
          select: function(e, ui) {
            e.preventDefault();

            var value = `NSF Award ${ui.item.value} (${ui.item.label})`;
            awardSearchInput.val(value);

            var formEl = $(e.target)
              .parents(".award-container")
              .find("form")[0];

            // set the form values based on the selected autosuggestion;
            // fire change event to trigger updateModel
            var event = new Event("change", { bubbles: true });

            var titleEl = formEl.querySelector("[data-attribute='title']");
            titleEl.value = ui.item.label;
            titleEl.dispatchEvent(event);

            var funderNameEl = formEl.querySelector(
              "[data-attribute='funderName']"
            );
            funderNameEl.value = MetacatUI.appModel.get("awardFunderName");
            funderNameEl.dispatchEvent(event);

            var funderIdentifierEl = formEl.querySelector(
              "[data-attribute='funderIdentifier']"
            );
            funderIdentifierEl.value = MetacatUI.appModel.get(
              "awardFunderIdentifier"
            );
            funderIdentifierEl.dispatchEvent(event);

            var awardNumberEl = formEl.querySelector(
              "[data-attribute='awardNumber']"
            );
            awardNumberEl.value = ui.item.value;
            awardNumberEl.dispatchEvent(event);

            var awardUrlEl = formEl.querySelector(
              "[data-attribute='awardUrl']"
            );
            awardUrlEl.value = `${MetacatUI.appModel.get("awardAwardUrl")}${
              ui.item.value
            }`;
            awardUrlEl.dispatchEvent(event);
          }.bind(this),
          position: {
            my: "left top",
            at: "left bottom",
            of: awardSearchInput,
            collision: "fit"
          },
          appendTo: containerEl,
          minLength: 3
        });

        return containerEl[0];
      },

      updateModel: function(e) {
        if (!e) return false;

        //Get the attribute that was changed
        var attribute = $(e.target).attr("data-attribute");
        if (!attribute) return false;

        if (this.model.emlEditorAwardFieldLabels[attribute]) {
          var newValue = e.target.value;

          var emlModel = this.model.getParentEML();
          if (emlModel) {
            newValue = emlModel.cleanXMLText(newValue);
          }

          //Update the model
          if (newValue == "") {
            this.model.set(attribute, null);
          } else {
            this.model.set(attribute, newValue);
          }

          //Add new award model to the parent EML model
          if (this.isNew) {
            var position = $(
              `.eml-award [data-attribute='${attribute}']`
            ).index(e.target);

            var existingAwards = this.model.get("parentModel").get("award");
            if (!existingAwards[position]) {
              this.model.get("parentModel").addAward(this.model);
              this.model.trickleUpChange()
            }
          }
        }
      }
    }
  );

  return EMLAwardView;
});
