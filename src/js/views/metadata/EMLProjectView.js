/* global define */
define([
  "underscore",
  "jquery",
  "backbone",
  "models/metadata/eml211/EMLProject",
  "models/metadata/eml211/EMLText",
  "models/metadata/eml211/EMLAward",
  "text!templates/metadata/EMLProject.html"
], function(_, $, Backbone, EMLProject, EMLText, EMLAward, EMLProjectTemplate) {
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
        change: "updateModel",
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

        if (this.edit) {
          this.$el.html(
            this.editTemplate({
              award: this.model.get("award"),
              awardFields: this.model.get("awardFields")
            })
          );

          var containers = this.$(".award-search-container");
          for (let index = 0; index < containers.length; index++) {
            containers[index].append(this.createAwardSearch());
          }
        }

        return this;
      },

      updateModel: function(e) {
        if (!e) return false;

        var updatedInput = $(e.target);

        //Get the attribute that was changed
        var changedAttr = updatedInput.attr("data-attribute");
        if (!changedAttr) return false;

        if (Object.keys(this.model.get("awardFields")).includes(changedAttr)) {
          var position = this.$(`[data-attribute='${changedAttr}']`).index(
            e.target
          );
          this.model.updateAward(e, position);
        }
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
        this.model.removeAward(index);
        this.model.trickleUpChange();

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

      addNewAward: function(e) {
        var container = this.$("section.project");
        var awardEl = this.$(".award-container.new");

        var newAward = awardEl[0].cloneNode(true);
        // remove award search because cloning doesn't work on the event listeners
        newAward.querySelector(".award-search-row").remove();
        // clear out all input values in form
        $(newAward)
          .find("form")[0]
          .reset();
        // add award search
        $(newAward)
          .find(".award-search-container")[0]
          .append(this.createAwardSearch());

        container.append(newAward);

        awardEl.removeClass("new");
        awardEl.prepend('<i class="remove icon-remove"></i>');

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

      previewRemove: function(e) {
        $(e.target)
          .parents(".award-container")
          .toggleClass("remove-preview");
      }
    }
  );

  return EMLProjectView;
});
