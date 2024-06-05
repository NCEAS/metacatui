/*global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "models/filters/ChoiceFilter",
  "views/filters/FilterView",
  "text!templates/filters/choiceFilter.html",
], function ($, _, Backbone, ChoiceFilter, FilterView, Template) {
  "use strict";

  /**
   * @class ChoiceFilterView
   * @classdesc Render a view of a single ChoiceFilter model
   * @classcategory Views/Filters
   * @extends FilterView
   */
  var ChoiceFilterView = FilterView.extend(
    /** @lends ChoiceFilterView.prototype */ {
      /**
       * A ChoiceFilter model to be rendered in this view
       * @type {ChoiceFilter} */
      model: null,

      /**
       * @inheritdoc
       */
      modelClass: ChoiceFilter,

      className: "filter choice",

      template: _.template(Template),

      /**
       * When this view is in "uiBuilder" mode, the class name for the handles on each choice
       * row that the user can click and drag to re-order
       * @type {string}
       */
      choiceHandleClass: "handle",

      /**
       * The class to add to the element that a user should click to remove a choice
       * value and label when this view is in "uiEditor" mode
       * @since 2.17.0
       * @type {string}
       */
      removeChoiceClass: "remove-choice",

      /**
       * A function that creates and returns the Backbone events object.
       * @return {Object} Returns a Backbone events object
       */
      events: function () {
        try {
          var events = FilterView.prototype.events.call(this);
          events["change select"] = "handleChange";
          var removeClass = "." + this.removeChoiceClass;
          events["click " + removeClass] = "removeChoice";
          events["mouseover " + removeClass] = "previewRemoveChoice";
          events["mouseout " + removeClass] = "previewRemoveChoice";
          return events;
        } catch (error) {
          console.log(
            "There was an error creating the events object for a ChoiceFilterView" +
              " Error details: " +
              error,
          );
        }
      },

      render: function () {
        var view = this;

        // Renders the template and inserts the FilterEditorView if the mode is uiBuilder
        FilterView.prototype.render.call(this);

        var placeHolderText = this.model.get("placeholder");
        var select = this.$("select");

        if (this.mode === "uiBuilder") {
          // If this is the filter view where the user can edit the filter UI options,
          // like the label, placeholder text, and choices, then render the inputs
          // for these options.

          // The ignore-changes class prevents the editor footer from showing on keypress
          var placeholderInput = $(
            '<input placeholder="placeholder" class="' +
              this.uiInputClass +
              ' placeholder ignore-changes" data-category="placeholder" value="' +
              (placeHolderText ? placeHolderText : "") +
              '" />',
          );
          // Replace the select element with the placeholder text element
          placeholderInput.insertAfter(select);

          // Create the interface for a user to edit the value-label choice options
          var choicesEditor = this.createChoicesEditor();
          view.$el.append(choicesEditor);
        } else {
          // For regular search filter views, or the edit filter view, render the dropdown
          // interface

          //Create the placeholder text for the dropdown menu

          //If placeholder text is already provided in the model, use it
          //If not, create placeholder text using the model label
          if (!placeHolderText) {
            if (this.model.get("label")) {
              //If the label starts with a vowel, use "an"
              var vowels = ["a", "e", "i", "o", "u"];
              if (
                _.contains(
                  vowels,
                  this.model.get("label").toLowerCase().charAt(0),
                )
              ) {
                placeHolderText = "Choose an " + this.model.get("label");
              }
              //Otherwise use "a"
              else {
                placeHolderText = "Choose a " + this.model.get("label");
              }
            }
          }

          //Create the default option
          var defaultOption = $(document.createElement("option"))
            .attr("value", "")
            .text(placeHolderText);
          select.append(defaultOption);

          //Create an option element for each choice listen in the model
          _.each(
            this.model.get("choices"),
            function (choice) {
              select.append(
                $(document.createElement("option"))
                  .attr("value", choice.value)
                  .text(choice.label),
              );
            },
            this,
          );

          //When the ChoiceFilter is changed, update the choice list in the UI
          this.listenTo(this.model, "change:values", this.updateChoices);
          this.listenTo(this.model, "remove", this.updateChoices);
        }
      },

      /**
       * Create the set of inputs where a use can select label-value pairs for the regular
       * choice filter view
       * @since 2.17.0
       */
      createChoicesEditor: function () {
        try {
          var view = this;
          this.choicesEditor = $("<div class='choices-editor'></div>");
          var choicesEditorText = $(
            "<p class='modal-instructions'>Allow people to select from the following search terms</p>",
          );
          var choiceEditorError = $(
            "<p class='notification error' data-category='choices' style='display: none'></p>",
          );
          var labelContainer = $(
            "<div class='choice-editor unsortable'></div>",
          );

          this.choicesEditor.append(
            choicesEditorText,
            choiceEditorError,
            labelContainer,
          );

          labelContainer.append(
            "<p class='ui-builder-container-text choice-label subtle'>Enter the text to display</p>",
          );
          labelContainer.append(
            "<p class='ui-builder-container-text choice-value subtle'>Enter the text to search for</p>",
          );

          _.each(
            this.model.get("choices"),
            function (choice) {
              var choiceEditorEl = this.createChoiceEditor(choice);
              this.choicesEditor.append(choiceEditorEl);
            },
            this,
          );

          // Create a blank choice at the end
          this.addEmptyChoiceEditor();

          // Initialize choice drag and drop to re-order functionality
          require(["sortable"], function (Sortable) {
            Sortable.create(view.choicesEditor[0], {
              direction: "vertical",
              easing: "cubic-bezier(1, 0, 0, 1)",
              animation: 200,
              handle: "." + view.choiceHandleClass,
              draggable: ".choice-editor:not(.unsortable)",
              onUpdate: function (evt) {
                // When the choice order is changed, update the filter model
                view.updateModelChoices();
              },
            });
          });

          return this.choicesEditor;
        } catch (error) {
          console.log(
            "There was an error creating choices editor in a ChoiceFilterView" +
              " Error details: " +
              error,
          );
        }
      },

      /**
       * Create a row where a user can input a value and label for a single choice.
       * @since 2.17.0
       */
      createChoiceEditor: function (choice) {
        try {
          if (!choice) {
            return;
          }

          var view = this;

          // Create the choice container
          var choiceContainer = $("<div class='choice-editor'></div>");

          // Create the click and drag handle
          var handle = $(
            '<span class="' +
              view.choiceHandleClass +
              '">' +
              '<i class= "icon icon-ellipsis-vertical" ></i>' +
              '<i class="icon icon-ellipsis-vertical"></i>' +
              "</span >",
          );
          choiceContainer.append(handle);

          // Create inputs for "value" and "label", insert them in the container
          for (const [attrName, attrValue] of Object.entries(choice)) {
            var inputEl = $("<input>").attr({
              // The ignore-changes class prevents the editor footer from showing on keypress
              class: "ignore-changes choice-input choice-" + attrName,
              value: attrValue,
              "data-category": attrName,
            });
            // Update the values in the model when the user focuses out of an input
            inputEl.on("blur", function () {
              view.updateModelChoices.call(view);
            });
            choiceContainer.append(inputEl);
          }

          // Create the remove "X" button. Save references to the parent choice container so
          // that we can remove it from the view when the button is clicked
          var removeButton = $(
            "<i class='icon icon-remove " +
              this.removeChoiceClass +
              "' title='Remove this choice'></i>",
          ).data({
            choiceEl: choiceContainer,
          });

          // Insert the remove button into the choice container
          choiceContainer.append(removeButton);
          return choiceContainer;
        } catch (error) {
          console.log(
            "There was an error  ChoiceFilterView" + " Error details: " + error,
          );
        }
      },

      /**
       * Create an empty choice editor row
       * @since 2.17.0
       */
      addEmptyChoiceEditor: function () {
        try {
          var view = this;
          var choice = {
            label: "",
            value: "",
          };
          var choiceEditorEl = this.createChoiceEditor(choice);
          this.choicesEditor.append(choiceEditorEl);

          // Don't let users remove or sort the new choice entry fields until some text has
          // been entered
          var removeButton = choiceEditorEl.find("." + this.removeChoiceClass);
          var handle = choiceEditorEl.find("." + this.choiceHandleClass);
          removeButton.hide();
          handle.hide();
          choiceEditorEl.addClass("unsortable");
          // The inputs for value and label
          var inputs = choiceEditorEl.find("input");

          var onInputChange = function () {
            choiceEditorEl.removeClass("unsortable");
            removeButton.show();
            handle.show();
            view.addEmptyChoiceEditor();
            inputs.off("input", onInputChange);
          };
          inputs.on("input", onInputChange);
        } catch (error) {
          console.log(
            "There was an error creating a choice editor in a ChoiceFilterView" +
              " Error details: " +
              error,
          );
        }
      },

      /**
       * Indicate to the user that the choice value and label inputs will be removed when
       * they hover over the remove button.
       * @since 2.17.0
       */
      previewRemoveChoice: function (e) {
        try {
          var normalOpacity = 1.0,
            previewOpacity = 0.2,
            speed = 120;

          var removeEl = $(e.target);
          var subElements = removeEl.data("choiceEl").children().not(removeEl);

          if (e.type === "mouseover") {
            subElements.fadeTo(speed, previewOpacity);
            $(removeEl).fadeTo(speed, normalOpacity);
          }
          if (e.type === "mouseout") {
            subElements.fadeTo(speed, normalOpacity);
            $(removeEl).fadeTo(speed, previewOpacity);
          }
        } catch (error) {
          console.log(
            "Error showing a preview of the removal of a Choice editor in a " +
              "Choice Filter View, details: " +
              error,
          );
        }
      },

      /**
       * Remove a choice editor row and the corresponding label-value pair from the choice
       * Filter Model (TODO)
       * @since 2.17.0
       * @param {Object} e The click event object
       */
      removeChoice: function (e) {
        try {
          var choiceEl = $(e.target).data("choiceEl");

          // See how many choice elements there are (subtract one because the label elements
          // are within a choice-editor element)
          var numChoices = this.$el.find(".choice-editor").length - 1;

          // Don't allow removing the last choice element. Empty the last element and hide the
          // remove button instead.
          if (numChoices <= 1) {
            choiceEl.find("input").val("");
          } else {
            // Remove the choice editor element from the view, plus any listeners
            choiceEl.off();
            choiceEl.remove();
          }
          // Update the choices in the model
          this.updateModelChoices();
        } catch (error) {
          console.log(
            "There was an error removing a choice editor in the ChoiceFilterView" +
              " Error details: " +
              error,
          );
        }
      },

      /**
       * Update the choices attribute in the choiceFilter model based on the values in the
       * choices editor
       * @since 2.17.0
       */
      updateModelChoices: function () {
        try {
          // The array of label-value pairs that will be set on the choiceFilter model.
          var newChoices = [];

          // Find each choice editor container, and find the values from the two inputs
          // within.
          this.$el.find(".choice-editor").each(function () {
            var choiceEditor = $(this);
            var valueEl = choiceEditor.find("[data-category='value']");
            var labelEl = choiceEditor.find("[data-category='label']");
            if (valueEl.length && labelEl.length) {
              var newValue = valueEl[0].value;
              var newLabel = labelEl[0].value;
              // TODO: validate the label/value here and show error if choice is not
              // complete.
              if (!newValue && !newLabel) {
                // Don't add empty choices to the model
                return;
              } else {
                newChoices.push({
                  label: newLabel,
                  value: newValue,
                });
              }
            }
          });
          // Replace the choices in the model with the new array with new values
          this.model.set("choices", newChoices);
        } catch (error) {
          console.log(
            "There was an error updating the choices in a ChoiceFilterView" +
              " Error details: " +
              error,
          );
        }
      },

      /**
       * Updates the value set on the ChoiceFilter Model associated with this view.
       * The filter value is grabbed from the select element in this view.
       *
       */
      updateModel: function () {
        //Get the new value from the text input
        var newValue = this.$("select").val();

        //Get the current values array from the model
        var currentValue = this.model.get("values");

        //If the ChoiceFilter allows multiple values to be added,
        // add the new choice to the values array
        if (this.model.get("chooseMultiple")) {
          //Duplicate the current values array
          var newValuesArray = currentValue.slice(0);

          //Add the new value to the array
          newValuesArray.push(newValue);

          //Set the new values array on the model
          this.model.set("values", newValuesArray);
        }
        //If multiple choices are not allowed,
        else {
          //Replace the first index of the array with the new value
          var newValuesArray = currentValue.slice(0);
          newValuesArray[0] = newValue;

          //Set the new values array on the model
          this.model.set("values", newValuesArray);
        }
      },

      /**
       * Update the choices in the select dropdown menu based on which choices are
       * currently selected
       */
      updateChoices: function () {
        //Enable all the choices
        this.$("option").prop("disabled", false);

        //Get the currently-selected choices
        var selectedChoices = this.model.get("values");

        _.each(
          selectedChoices,
          function (choice) {
            //Find each choice in the dropdown menu and disable it
            this.$("option[value='" + choice + "']").prop("disabled", true);
          },
          this,
        );
      },

      /**
       * Show validation errors. This is used for filters that are in "UIBuilder" mode.
       * @param {Object} errors The error messages associated with each attribute that has
       * an error, passed from the Filter model validation function.
       */
      showValidationErrors: function (errors) {
        try {
          var view = this;
          // Select the messages container for the choice error (added in the template)
          var messageContainer = view.el.querySelector(
            ".notification[data-category='choices']",
          );

          // Show errors for label, placeholder, etc (elements common to all FilterViews)
          FilterView.prototype.showValidationErrors.call(this, errors);

          // Show errors in the choices editor
          var inputs = this.choicesEditor.find("input");

          // Add error styling to all the choices inputs. Remove error styling (and input
          // listeners) from all inputs when there is text in at least one of them
          var handleInput = function () {
            inputs.each(function (i, input) {
              view.hideInputError(input, messageContainer);
              input.removeEventListener("input", handleInput);
            });
          };
          if (inputs.length) {
            inputs.each(function (i, input) {
              view.showInputError(input);
              input.addEventListener("input", handleInput);
            });
          }
        } catch (error) {
          console.log(
            "There was an error showing validation errors in a FilterView" +
              ". Error details: " +
              error,
          );
        }
      },
    },
  );
  return ChoiceFilterView;
});
