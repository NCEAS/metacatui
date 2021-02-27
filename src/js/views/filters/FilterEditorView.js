/*global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter',
  'views/searchSelect/QueryFieldSelectView',
  'views/filters/FilterView',
  'views/filters/ChoiceFilterView',
  'views/filters/DateFilterView',
  'views/filters/ToggleFilterView',
  'text!templates/filters/filterEditor.html'],
  function ($, _, Backbone, Filter, QueryFieldSelect, FilterView, ChoiceFilterView, DateFilterView, ToggleFilterView, Template) {
    'use strict';

    // TODO: add screenshot
    /**
    * @class EditFilterView
    * @classdesc Creates a view of an editor for a custom search filter
    * @classcategory Views/Filters
    * @since 2.15.0
    * @name EditFilterView
    * @extends Backbone.View
    * @constructor
    */
    var EditFilterView = Backbone.View.extend(
    /** @lends EditFilterView.prototype */{

        /**
         * A Filter model to be rendered and edited in this view
         * @type {Filter}
         */
        model: null,

        /**
         * The HTML classes to use for this view's element
         * @type {string}
         */
        className: "filter-editor",

        /**
         * References to the template for this view. HTML files are converted to
         * Underscore.js templates
         * @type {Underscore.Template}
         */
        template: _.template(Template),

        /**
         * The path to the directory that contains the SVG files which are used like an
         * icon to represent each UI type
         * @type {string}
         */
        svgDir: "templates/filters/filterIcons/",

        /**
         * The message to show when a filter type doesn't work with the selected metadata
         * fields.
         * @type {string}
         */
        filterOptionNotAllowedMessage: "This interface doesn't work with the metadata" +
         "fields you selected. Change the 'filter data by' option to use this interface.",

        /**
         * The list of UI types that a user can select from
         * TODO: Document the Object properties
         * @type {Object[]}
         */
        filterTypeOptions: [
          {
            label: "Free text",
            modelType: "Filter",
            svgFile: "filter.svg",
            description: "Allow people to search using any text they enter",
            uiFunction: function(model){
              return new FilterView({
                model: model,
                mode: "uiBuilder"
              });
            }
          },
          {
            label: "Dropdown",
            modelType: "ChoiceFilter",
            svgFile: "choice.svg",
            description: "Allow people to select a search term from a list of options",
            uiFunction: function(model){
              return new ChoiceFilterView({
                model: model,
                mode: "uiBuilder"
              });
            }
          },
          {
            label: "Year slider",
            modelType: "DateFilter",
            svgFile: "number.svg",
            description: "Let people search for a range of years",
            uiFunction: function(model){
              return new DateFilterView({
                model: model,
                mode: "uiBuilder"
              });
            }
          },
          {
            label: "Toggle",
            modelType: "ToggleFilter",
            svgFile: "toggle.svg",
            description: "Let people add or remove a single, specific search term",
            uiFunction: function(model){
              return new ToggleFilterView({
                model: model,
                mode: "uiBuilder"
              });
            }
          }
        ],

        /**
         * Executed when this view is created
         * @param  {} options
         */
        initialize: function (options) {

          try {
            if (!options || typeof options != "object") {
              var options = {};
            }

            this.model = options.model || new Filter({ isUIFilterType: true });

          } catch (error) {
            console.log("Error creating an EditFilterView. Error details: " + error);
          }

        },

        /**
         * Render the view
         */
        render: function () {
          try {

            // Save a reference to this view
            var view = this;

            // Generate an ID for the modal, used as the href for the button.
            var filterId = "filter-editor-" + this.cid

            // Create an EDIT button for the filter.
            var editButton = $("<a class='edit-filter-button'>EDIT</a>")
              .attr('href', "#" + filterId)
              .attr('data-toggle', 'modal');
            this.$el.prepend(editButton);

            // Create the editing modal interface
            var modalHTML = this.template({
              id: filterId
            });
            this.modalEl = $(modalHTML)
            this.$el.append(this.modalEl);

            // Add the field selection input
            var selectedFields = this.model.get("fields");
            this.fieldInput = new QueryFieldSelect({
              selected: selectedFields,
              inputLabel: "Select one or more metadata fields"
              // TODO
              // excludeFields: this.excludeFields,
              // addFields: this.specialFields,
              // separatorText: this.model.get("fieldsOperator")
            })
            // TODO make selectors and classes below configurable in this view
            this.modalEl.find(".fields-editor").append(this.fieldInput.el)
            this.fieldInput.render()

            // Add the UI selection interface
            var filterTypeSelect = $("<div class='filter-options'></div>")

            // Create a filter option for each filter type configured in this view
            this.filterTypeOptions.forEach(function (filterChoice) {
              var filterOption = $("<div class='filter-option'></div>")
                .attr("data-filter-type", filterChoice.filterType)
                .append("<h5 class='filter-option-label'>" + filterChoice.label + "</h5>");
              var svgPath = 'text!' + this.svgDir + filterChoice.svgFile;
              require([svgPath], function (svgString) {
                filterOption.append(svgString)
              });
              filterOption.tooltip({
                title: filterChoice.description, delay: {
                  show: 900,
                  hide: 50
                }
              })
              filterTypeSelect.append(filterOption)
            }, this);
            
            // TODO: make configurable
            this.modalEl.find(".interface-selector").append(filterTypeSelect)

            this.renderFilterOptionsEditor()

            // TODO: pass a clone of the model to use as a draft for each filter type.
            // update the filterGroup with the replacement model when user clicks "SAVE"

            var saveButton = this.modalEl.find("#save-" + filterId);
            var cancelButton = this.modalEl.find("#cancel-" + filterId);

            saveButton.off('click')
            saveButton.on('click', function (event) {
              // TODO
              // view.modalEl.off("hidden", function(){ view.updateModel() }, this);
              // view.modalEl.on("hidden", function(){ iew.updateModel() }, this);
              view.modalEl.modal("hide");
            })

            cancelButton.off('click')
            cancelButton.on('click', function (event) {
              // TODO
              // view.modalEl.off("hidden", function(){ view.render() })
              // view.modalEl.on("hidden", function(){ view.render() })
              view.modalEl.modal("hide")
            })

            // Save a reference to this view
            this.$el.data("view", this);

            return this
          } catch (error) {
            console.log("Error rendering an EditFilterView. Error details: " + error);
          }
        },

        /**
         * Given a filter type, render a view that allows the user to edit the UI
         * properties of the filter model, like placeholder, label, icon, etc
         * @param {string} filterType The name of the filter model type for which this
         * function should render a filterView in UI build mode
         */
        renderFilterOptionsEditor: function(filterType){
          // TODO: make configurable
          var uiEditorContainer = this.modalEl.find(".ui-options-editor");

          if(!filterType){
            filterType = this.model.type
          }

          // Find the interface for the given filter type
          var interfaceOption = _.findWhere(this.filterTypeOptions, { modelType: filterType})

          var editFilter = interfaceOption.uiFunction(this.model)
          uiEditorContainer.html(editFilter.el)
          editFilter.render();
        },

      })
    return EditFilterView
  });