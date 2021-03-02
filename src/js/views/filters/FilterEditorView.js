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
         * A selector for the element in the template that will contain the input where a 
         * user can select metadata fields for the custom search filter.
         * @type {string}
         */
        fieldsContainerSelector: ".fields-editor",

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
         * fields
         * @type {string}
         */
        filterOptionNotAllowedMessage: "This interface doesn't work with the metadata" +
         "fields you selected. Change the 'filter data by' option to use this interface.",

        /**
         * The list of UI types that a user can select from
         * TODO: Document the Object properties
         * @type {Object[]}
         */
        uiOptions: [
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

            // Create and insert an EDIT button for the filter.
            var editButton = $("<a class='edit-filter-button'>EDIT</a>");
            this.$el.prepend(editButton);

            // Render the editor modal on-the-fly to make the application load faster.
            // No need to create editing modals for filters that a user doesn't edit.
            editButton.on("click", function(){
             view.renderEditorModal.call(view);
            })

            // Save a reference to this view
            this.$el.data("view", this);

            return this
          } catch (error) {
            console.log("Error rendering an EditFilterView. Error details: " + error);
          }
        },

        /**
         * Render and show the modal window that has all the components for editing a
         * filter. This is created on-the-fly because creating these modals all at once in
         * a FilterGroupsView in edit mode takes too much time.
         */
        renderEditorModal : function(){
          try {
            
            // Generate an ID for the modal, used as the href for the button.
            // var filterId = "filter-editor-" + this.cid;
            var view = this;

            // Create and insert the editing modal interface.
            var modalHTML = this.template();
            this.modalEl = $(modalHTML)
            this.$el.append(this.modalEl);

            // Start rendering the metadata field input only after the modal is shown.
            // Otherwise this step slows the rendering down, leaves too much of a delay
            // before the modal appears.
            view.modalEl.off();
            view.modalEl.on("shown", function(){
              view.renderFieldInput()
            });
            view.modalEl.modal("show");

            var saveButton = this.modalEl.find(".save-button");
            var cancelButton = this.modalEl.find(".cancel-button");

            saveButton.off('click')
            saveButton.on('click', function (event) {
              view.modalEl.off("hidden");
              view.modalEl.on("hidden", function () { view.destroyEditorModal() });
              view.modalEl.modal("hide");
              view.addChanges();
            })

            cancelButton.off('click')
            cancelButton.on('click', function (event) {
              view.modalEl.off("hidden");
              view.modalEl.on("hidden", function () { view.destroyEditorModal() })
              view.modalEl.modal("hide");
              // view.cancelChanges();
            })
        

            // Add the UI selection interface
            var filterTypeSelect = this.modalEl.find(".filter-options");

            // Create a filter option for each filter type configured in this view
            this.uiOptions.forEach(function (filterChoice) {
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
            
          }
          catch (error) {
            console.log( 'There was an error rendering the modal in a FilterEditorView' +
              ' Error details: ' + error );
          }
        },

        /**
         * Create and insert the component that is used to edit the fields attribute of a
         * Filter Model. Save it to the view so that the selected fields can be accessed
         * on save.
         */
        renderFieldInput: function(){
          try {
            var view = this;
            var selectedFields = _.clone(view.model.get("fields"));
            view.fieldInput = new QueryFieldSelect({
              selected: selectedFields,
              inputLabel: "Select one or more metadata fields"
              // TODO
              // excludeFields: view.excludeFields,
              // addFields: view.specialFields,
              // separatorText: view.model.get("fieldsOperator")
            })
            // TODO make selectors and classes below configurable in this view
            view.modalEl.find(view.fieldsContainerSelector).append(view.fieldInput.el)
            view.fieldInput.render();
          }
          catch (error) {
            console.log( 'There was an error rendering a fields input in a FilterEditorView' +
              ' Error details: ' + error );
          }
        },

        /**
         * Remove the editing modal window and all associated listeners and data.
         */
        destroyEditorModal : function(){
          try {
            var view = this;
            view.modalEl.off();
            view.modalEl.remove();
          }
          catch (error) {
            console.log( 'There was an error removing a modal in a FilterEditorView' +
              ' Error details: ' + error );
          }
        },

        /**
         * Functions to run when a user clicks the "save" button in the editing modal
         * window. Updates the filter model in the parent Filters collection with all of
         * the new attributes that the user has selected.
         * @param {Object} event The click event
         */
        addChanges: function(event){
          try {
            var selectedUI = _.findWhere(this.uiEditors, { state: "selected" }),
                newModelAttrs = selectedUI.draftModel.toJSON(),
                oldModel = this.model,
                filtersCollection = this.model.collection;

            // Set the new fields
            newModelAttrs.fields = _.clone(this.fieldInput.selected);

            delete newModelAttrs.objectDOM
            delete newModelAttrs.cid

            this.model = filtersCollection.replaceModel(oldModel, newModelAttrs);
          }
          catch (error) {
            console.log( 'There was an error updating a Filter model in a FilterEditorView' +
              ' Error details: ' + error );
          }
        },

        // /**
        //  * Functions to run when a user clicks the "cancel" button in the editing modal window.
        //  * Removes all of the draft models that have been saved to this view.. [WIP]
        //  * @param {Object} event The click event
        //  */
        // cancelChanges: function(event){
          
        // },

        /**
         * Given a filter type, render a view that allows the user to edit the UI
         * properties of the filter model, like placeholder, label, icon, etc
         * @param {string} filterType The name of the filter model type for which this
         * function should render a filterView in UI build mode
         */
        renderFilterOptionsEditor: function(filterType){
          try {
            // TODO: make configurable
            var uiEditorContainer = this.modalEl.find(".ui-options-editor");

            if (!filterType) {
              filterType = this.model.type
            }

            // Find the interface for the given filter type
            var interfaceOption = _.findWhere(
              this.uiOptions, { modelType: filterType }
            );

            if (!interfaceOption){
              return
            }

            var uiEditor = _.clone(interfaceOption)

            if (!this.uiEditors) {
              this.uiEditors = []
            }

            this.uiEditors.forEach(function (uiEditor) {
              uiEditor.state = ""
            })
            // TODO - check if this interface is already in the list of interfaces

            this.uiEditors.push(uiEditor);

            // Save a clone of the current model in the list of UI editors
            uiEditor.state = "selected"
            uiEditor.draftModel = this.model.clone();
            uiEditor.view = uiEditor.uiFunction(uiEditor.draftModel);

            uiEditorContainer.html(uiEditor.view.el)
            uiEditor.view.render();
          }
          catch (error) {
            console.log( 'There was an error rendering a UI editor for a Filter in a FilterEditorView' +
              ' Error details: ' + error );
          }
        },

      })
    return EditFilterView
  });