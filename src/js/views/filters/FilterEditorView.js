/*global define */
define(['jquery', 'underscore', 'backbone',
  'models/filters/Filter',
  'models/filters/ChoiceFilter',
  'models/filters/DateFilter',
  'models/filters/ToggleFilter',
  'views/searchSelect/QueryFieldSelectView',
  'views/filters/FilterView',
  'views/filters/ChoiceFilterView',
  'views/filters/DateFilterView',
  'views/filters/ToggleFilterView',
  'text!templates/filters/filterEditor.html'],
  function ($, _, Backbone, Filter, ChoiceFilter, DateFilter, ToggleFilter,
    QueryFieldSelect, FilterView, ChoiceFilterView, DateFilterView, ToggleFilterView,
    Template) {
    'use strict';

    /**
    * @class FilterEditorView
    * @classdesc Creates a view of an editor for a custom search filter
    * @classcategory Views/Filters
    * @screenshot views/filters/FilterEditorView.png
    * @since 2.15.0
    * @name FilterEditorView
    * @extends Backbone.View
    * @constructor
    */
    var FilterEditorView = Backbone.View.extend(
    /** @lends FilterEditorView.prototype */{

        /**
         * A Filter model to be rendered and edited in this view. The Filter model must be
         * part of a Filters collection.
         //  TODO: Add support for boolean and number filters
         * @type {Filter|ChoiceFilter|DateFilter|ToggleFilter}
         */
        model: null,

        /**
         * If rendering an editor for a brand new Filter model, provide the Filters
         * collection instead of the Filter model. A new model will be created and, if the
         * user clicks save, it will be added to this Filters collection.
         * @type {Filters}
         */
        collection: null,

        /**
         * A reference to the PortalEditorView
         * @type {PortalEditorView}
         */
        editorView: undefined,

        /**
         * Set to true if rendering an editor for a brand new Filter model that is not yet
         * part of a Filters collection. If isNew is set to true, then the view requires a
         * Filters model set to the view's collection property. A model will be created.
         */
        isNew: false,

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
         * The classes to use for various elements in this view
         * @type {Object}
         * @property {string} fieldsContainer - the element in the template that
         * will contain the input where a user can select metadata fields for the custom
         * search filter.
         * @property {string} editButton - The button a user clicks to start
         * editing a search filter
         * @property {string} cancelButton - the element in the template that a
         * user clicks to undo any changes made to the filter and close the editing modal.
         * @property {string} saveButton - the element in the template that a user
         * clicks to add their filter changes to the parent Filters collection and close
         * the editing modal.
         * @property {string} deleteButton - the element in the template that a
         * user clicks to remove the Filter model from the Filters collection
         * @property {string} uiBuilderChoicesContainer - The container for the
         * uiBuilderChoices and the associated instruction text
         * @property {string} uiBuilderChoices - The container for each "button" a
         * user can click to switch the filter type
         * @property {string} uiBuilderChoice - The element that acts like a
         * button that switches the filter type
         * @property {string} uiBuilderChoiceActive - The class to add to a
         * uiBuilderChoice buttons when that option is active/selected
         * @property {string} uiBuilderLabel - The label that goes along with the
         * uiBuilderChoice element
         * @property {string} uiBuilderContainer - The element that will be turned
         * into a carousel that switches between each UI Builder view when a user switches
         * the filter type
         * @property {string} modalInstructions - The class to add to the
         * instruction text in the editing modal window
         */
        classes: {
          fieldsContainer: "fields-container",
          editButton: "edit-button",
          cancelButton: "cancel-button",
          saveButton: "save-button",
          deleteButton: "delete-button",
          uiBuilderChoicesContainer: "ui-builder-choices-container",
          uiBuilderChoices: "ui-builder-choices",
          uiBuilderChoice: "ui-builder-choice",
          uiBuilderChoiceActive: "selected",
          uiBuilderLabel: "ui-builder-choice-label",
          uiBuilderContainer: "ui-builder-container",
          modalInstructions: "modal-instructions",
        },

        /**
         * Strings to use to display various messages to the user in this view
         * @property {string} editButton - The text to show in the button a user
         * clicks to open the editing modal window.
         * @property {string} addFilterButton - The text to show in the button a user
         * clicks to add a new search filter and open an editing modal window.
         * @property {string} step1 - The instructions placed just before the fields
         * input
         * @property {string} step2 - The instructions placed after the fields input
         * and before the uiBuilder select
         * @property {string} filterNotAllowed - The message to show when a filter
         * type doesn't work with the selected metadata fields
         * @property {string} saveButton - Text for the button at the bottom of the
         * editing modal that adds the filter model changes to the parent Filters
         * collection and closes the modal
         * @property {string} cancelButton - Text for the button at the bottom of the
         * editing modal that closes the modal window without making any changes.
         * @property {string} deleteButton - Text for the button at the bottom of the
         * editing modal that removes the Filter model from the Filters collection.
         */
        text: {
          editButton: "EDIT",
          addFilterButton: "Add a search filter",
          step1: "Let people filter your data by",
          step2: "...using the following interface",
          filterNotAllowed: "This interface doesn't work with the metadata fields you" +
            " selected. Change the 'filter data by' option to use this interface.",
          saveButton: "Use these filter settings",
          cancelButton: "Cancel",
          deleteButton: "Remove filter"
        },

        /**
         * A function that returns a Backbone events object
         * @return {object} A Backbone events object - an object with the events this view
         * will listen to and the associated function to call.
         */
        events: function () {
          var events = {}
          events["click ." + this.classes.uiBuilderChoice] = "handleFilterIconClick"
          return events
        },

        /**
         * A list of query fields names to exclude from the list of options in the
         * QueryFieldSelectView
         * @type {string[]}
         */
        excludeFields: MetacatUI.appModel.get("collectionQueryExcludeFields"),

        /**
         * An additional field object contains the properties for an additional query
         * field to add to the QueryFieldSelectView that are required to render it
         * correctly. An additional query field is one that does not actually exist in the
         * query service index.
         *
         * @typedef {Object} AdditionalField
         *
         * @property {string} name - A unique ID to represent this field. It must not
         * match the name of any other query fields.
         * @property {string[]} fields - The list of real query fields that this
         * abstracted field will represent. It must exactly match the names of the query
         * fields that actually exist.
         * @property {string} label - A user-facing label to display.
         * @property {string} description - A description for this field.
         * @property {string} category - The name of the category under which to place
         * this field. It must match one of the category names for an existing query
         * field.
         */

        /**
         * A list of additional fields which are not retrieved from the query service
         * index, but which should be added to the list of options in the
         * QueryFieldSelectView. This can be used to add abstracted fields which are a
         * combination of multiple query fields, or to add a duplicate field that has a
         * different label.
         *
         * @type {AdditionalField[]}
         */
        specialFields: [],

        /**
         * The path to the directory that contains the SVG files which are used like an
         * icon to represent each UI type
         * @type {string}
         */
        iconDir: "templates/filters/filterIcons/",

        /**
        * A single type of custom search filter that a user can select. An option
        * represents a specific Filter model type and uses that associated Filter View.
        * @typedef {Object} UIBuilderOption
        * @property {string} label - The user-facing label to show for this option
        * @property {string} modelType - The name of the filter model type that that this
        * UI builder uses
        * @property {string} iconFileName - The file name, including extension, of the
        * SVG icon used to represent this option
        * @property {string} description - A very brief, user-facing description of how
        * this filter works
        * @property {function} modelFunction - A function that takes an optional object
        * with model properties and returns an instance of a model to use for this UI
        * builder
        * @property {function} uiFunction - A function that takes the model as an argument
        * and returns the filter UI builder view for this option
        */

        /**
         * The list of UI types that a user can select from. They will appear in the
         * carousel in the order they are listed here.
         * @type {UIBuilderOption[]}
         */
        uiBuilderOptions: [
          {
            label: "Free text",
            modelType: "Filter",
            iconFileName: "filter.svg",
            description: "Allow people to search using any text they enter",
            modelFunction: function (attrs) {
              return new Filter(attrs)
            },
            uiFunction: function (model) {
              return new FilterView({
                model: model,
                mode: "uiBuilder"
              });
            }
          },
          {
            label: "Dropdown",
            modelType: "ChoiceFilter",
            iconFileName: "choice.svg",
            description: "Allow people to select a search term from a list of options",
            modelFunction: function (attrs) {
              return new ChoiceFilter(attrs)
            },
            uiFunction: function (model) {
              return new ChoiceFilterView({
                model: model,
                mode: "uiBuilder"
              });
            }
          },
          {
            label: "Year slider",
            modelType: "DateFilter",
            iconFileName: "number.svg",
            description: "Let people search for a range of years",
            modelFunction: function (attrs) {
              return new DateFilter(attrs)
            },
            uiFunction: function (model) {
              return new DateFilterView({
                model: model,
                mode: "uiBuilder"
              });
            }
          },
          {
            label: "Toggle",
            modelType: "ToggleFilter",
            iconFileName: "toggle.svg",
            description: "Let people add or remove a single, specific search term",
            modelFunction: function (attrs) {
              return new ToggleFilter(attrs)
            },
            uiFunction: function (model) {
              return new ToggleFilterView({
                model: model,
                mode: "uiBuilder"
              });
            }
          }
        ],

        /**
         * Executed when this view is created
         * @param {object} options - A literal object of options to pass to this view
         * @property {Filter|ChoiceFilter|DateFilter|ToggleFilter} options.model - The
         * filter model to render an editor for. It must be part of a Filters collection.
         */
        initialize: function (options) {
          try {

            if (!options || typeof options != "object") {
              var options = {};
            }

            this.editorView = options.editorView || null;
            
            if (!options.isNew){
              // If this view is an editor for an existing Filter model, check that the model
              // and the Filters collection is provided.
              if (!options.model) {
                console.log("A Filter model is required to render a Filter Editor View");
                return
              }
              if (!options.model.collection) {
                console.log("The Filter model for a FilterEditorView must be part of a" + 
                  " Filters collection");
                return
              }
              // Set the model and collection on the view
              this.model = options.model
              this.collection = options.model.collection
            } else {
              // If this is an editor for a new Filter model, create a default model and
              // make sure there is a Filters collection to add it to
              if (!options.collection) {
                console.log("A Filters collection is required to render a " + 
                  "FilterEditorView for a new Filters model.");
                return
              }
              this.model = new Filter()
              this.collection = options.collection
              this.isNew = true
            }
            

          } catch (error) {
            console.log("Error creating an FilterEditorView. Error details: " + error);
          }
        },

        /**
         * Render the view
         */
        render: function () {
          try {

            // Save a reference to this view
            var view = this;

            // Create and insert an "edit" or a "add filter" button for the filter.
            var buttonText = this.text.editButton,
                buttonClasses = this.classes.editButton,
                buttonIcon = "pencil";
            
            // Text & styling is different for the "add a new filter" button
            if(this.isNew){
              buttonText = this.text.addFilterButton;
              buttonIcon = "plus";
              buttonClasses = buttonClasses + " btn";
              this.$el.addClass("new");
            }
            var editButton = $("<a class='" + buttonClasses + "'>" +
              "<i class='icon icon-" + buttonIcon + " icon-on-left'></i> " +
              buttonText + "</a>");
            this.$el.prepend(editButton);

            // Render the editor modal on-the-fly to make the application load faster.
            // No need to create editing modals for filters that a user doesn't edit.
            editButton.on("click", function () {
              view.renderEditorModal.call(view);
            });

            // Save a reference to this view
            this.$el.data("view", this);
            return this
          } catch (error) {
            console.log("Error rendering an FilterEditorView. Error details: " + error);
          }
        },

        /**
         * Render and show the modal window that has all the components for editing a
         * filter. This is created on-the-fly because creating these modals all at once in
         * a FilterGroupsView in edit mode takes too much time.
         */
        renderEditorModal: function () {
          try {

            // Save a reference to this view
            var view = this;

            // The list of UI Filter Editor options needs to be mutable. We will save the
            // draft filter models, and the associated editor views to this list. Rewrite
            // this.uiBuilders every time the editor modal is re-rendered.
            this.uiBuilders = [];
            this.uiBuilderOptions.forEach(function (opt) {
              this.uiBuilders.push(_.clone(opt))
            }, this);

            // Create and insert the modal window that will contain the editing interface
            var modalHTML = this.template({
              classes: view.classes,
              text: view.text
            });
            this.modalEl = $(modalHTML);
            this.$el.append(this.modalEl);

            // Start rendering the metadata field input only after the modal is shown.
            // Otherwise this step slows the rendering down, leaves too much of a delay
            // before the modal appears.
            this.modalEl.off();
            this.modalEl.on("shown", function (event) {
              view.modalEl.off("shown");
              view.renderFieldInput();
            });
            this.modalEl.modal("show");

            // Add listeners to the modal buttons save or cancel changes
            this.activateModalButtons();

            // Create and insert the "buttons" to switch filter type, and the elements
            // that will contain the UI building interfaces for each filter type.
            this.renderUIBuilders();

            // Select and render the UI Filter Editor for the filter model set on this
            // view.
            this.switchFilterType();

          }
          catch (error) {
            console.log('There was an error rendering the modal in a FilterEditorView' +
              ' Error details: ' + error);
          }
        },

        /**
         * Find the save and cancel buttons in the editing modal window, and add listeners
         * that close the modal and update the Filters collection on save
         */
        activateModalButtons: function () {
          try {
            var view = this;
            // The buttons at the bottom of the modal
            var saveButton = this.modalEl.find("." + this.classes.saveButton),
                cancelButton = this.modalEl.find("." + this.classes.cancelButton),
                deleteButton = this.modalEl.find("." + this.classes.deleteButton);
            // All buttons should hide the modal window
            var hideModal = function(){
              view.modalEl.off("hidden");
              view.modalEl.on("hidden", function () { view.destroyEditorModal() });
              view.modalEl.modal("hide");
            }
            // Add listeners to the modal's "delete", "save", and "cancel" buttons
            saveButton.on('click', function (event) {
              saveButton.off('click');
              hideModal();
              view.addChanges();
              if (view.editorView){
                view.editorView.showControls();
              }
            });
            cancelButton.on('click', function (event) {
              cancelButton.off('click');
              hideModal();
            })
            deleteButton.on('click', function (event) {
              deleteButton.off('click');
              hideModal();
              if(!view.isNew){
                view.collection.remove(view.model)
              }
              if (view.editorView) {
                view.editorView.showControls();
              }
            })
          }
          catch (error) {
            console.log(
              "There was an error activating the modal buttons in a FilterEditorView" +
              ". Error details: " + error
            );
          }
        },

        /**
         * Create and insert the "buttons" to switch filter type and the elements
         * that will contain the UI building interfaces for each filter type.
         */
        renderUIBuilders: function () {
          try {
            var view = this;
            
            // The container for the list of filter icons that allows users to switch
            // between filter types, plus the associated instruction paragraph
            var uiBuilderChoicesContainer = this.modalEl.find("." + this.classes.uiBuilderChoicesContainer);

            // The container for just the icons/buttons
            var uiBuilderChoices = $("<div></div>").addClass(this.classes.uiBuilderChoices);
            uiBuilderChoicesContainer.append(uiBuilderChoices);

            // uiBuilderCarousel will contain all of the UIBuilder views as slides
            this.uiBuilderCarousel = this.modalEl.find("." + this.classes.uiBuilderContainer);

            // The bootstrap carousel plugin requires the carousel slide times to be
            // contained within an inner div with the class 'carousel-inner'
            var carouselInner = $('<div class="carousel-inner"></div>');
            this.uiBuilderCarousel.append(carouselInner);

            // Create a container and button for each uiBuilder option
            this.uiBuilders.forEach(function (uiBuilder) {

              // Create a label button that allows the user to select the given UI

              // Create the button label
              var labelEl = $("<h5>" + uiBuilder.label + "</h5>")
                .addClass(view.classes.uiBuilderLabel);
              // Create the button
              var button = $("<div></div>")
                .addClass(view.classes.uiBuilderChoice)
                .attr("data-filter-type", uiBuilder.modelType)
                .append(labelEl);
              // Insert the uiBuilder icon SVG into the button
              var svgPath = 'text!' + this.iconDir + uiBuilder.iconFileName;
              require([svgPath], function (svgString) {
                button.append(svgString)
              });
              // Add a tooltip with description to the button
              button.tooltip({
                title: uiBuilder.description,
                delay: {
                  show: 900,
                  hide: 50
                }
              })
              // Insert the button into the list of uiBuilder choices
              uiBuilderChoices.append(button);
              // Create and insert the container / carousel slide. The carousel plugin
              // requires slides to have the class 'item'. Save the container to the
              // list of uiBuilder options.
              var uiBuilderContainer = $('<div class="item"></div>');
              carouselInner.append(uiBuilderContainer);

              // Add the button and container to the list of uiBuilders to make it
              // easy to switch between filter types
              uiBuilder.container = uiBuilderContainer;
              uiBuilder.button = button;

            }, this);

            // Initialize the carousel
            this.uiBuilderCarousel.addClass("slide");
            this.uiBuilderCarousel.addClass("carousel");
            this.uiBuilderCarousel.carousel({
              interval: false
            });
            // Need active class on at least one item for carousel to work properly
            this.uiBuilderCarousel.find(".item").first().addClass("active");
          }
          catch (error) {
            console.log(
              'There was an error rendering the UI filter builders in a FilterEditorView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Create and insert the component that is used to edit the fields attribute of a
         * Filter Model. Save it to the view so that the selected fields can be accessed
         * on save.
         */
        renderFieldInput: function () {
          try {
            var view = this;
            var selectedFields = _.clone(view.model.get("fields"));
            view.fieldInput = new QueryFieldSelect({
              selected: selectedFields,
              inputLabel: "Select one or more metadata fields",
              excludeFields: view.excludeFields,
              addFields: view.specialFields,
              separatorText: view.model.get("fieldsOperator"),
            })
            view.modalEl.find("." + view.classes.fieldsContainer).append(view.fieldInput.el)
            view.fieldInput.render();
          }
          catch (error) {
            console.log('There was an error rendering a fields input in a FilterEditorView' +
              ' Error details: ' + error);
          }
        },

        /**
         * Remove the editing modal window and all associated listeners and data.
         */
        destroyEditorModal: function () {
          try {
            var view = this;
            view.modalEl.off();
            view.modalEl.remove();
          }
          catch (error) {
            console.log('There was an error removing a modal in a FilterEditorView' +
              ' Error details: ' + error);
          }
        },

        /**
         * Functions to run when a user clicks the "save" button in the editing modal
         * window. Updates the filter model in the parent Filters collection with all of
         * the new attributes that the user has selected.
         * @param {Object} event The click event
         */
        addChanges: function (event) {
          try {
            var selectedUI = this.currentUIBuilder,
                newModelAttrs = selectedUI.draftModel.toJSON(),
                oldModel = this.model,
                filtersCollection = this.collection;

            // Set the new fields
            newModelAttrs.fields = _.clone(this.fieldInput.selected);

            delete newModelAttrs.objectDOM
            delete newModelAttrs.cid

            this.model = filtersCollection.replaceModel(oldModel, newModelAttrs);
          }
          catch (error) {
            console.log('There was an error updating a Filter model in a FilterEditorView' +
              ' Error details: ' + error);
          }
        },

        /**
         * Function that takes the event when a user clicks on one of the filter type
         * options, gets the name of the desired filter type, and passes it to the switch
         * filter function.
         * @param {object} event The click event
         */
        handleFilterIconClick: function (event) {
          try {

            // Get the new Filter Type from the click event. The name of the new Filter
            // Type is stored as a data attribute in the clicked Filter icon.
            // var filterTypeIcon = 
            var newFilterType = event.currentTarget.dataset.filterType;

            // Pass the Filter Type to the switch filter function
            this.switchFilterType(newFilterType)
          }
          catch (error) {
            console.log('There was an error handling a click event in a FilterEditorView' +
              ' Error details: ' + error);
          }
        },

        /**
         * Switches the current draft Filter model to a different Filter model type.
         * Carries over any common attributes from the previously selected filter type.
         * If no filter type is provided, defaults to type of the view's model
         * @param {string} newFilterType The name of the filter type to switch to
         */
        switchFilterType: function (newFilterType) {
          try {

            var view = this;

            // Use the filter type of the model if none is provided.
            if (!newFilterType) {
              newFilterType = this.model.type
            }

            // Get the properties of the Filter UI Editor for the new filter type.
            var uiBuilder = _.findWhere(this.uiBuilders, { modelType: newFilterType });
            var index = this.uiBuilders.indexOf(uiBuilder);

            // Treat the first Filter in the list of filter UI editor options as the default
            if (!uiBuilder) {
              uiBuilder = this.uiBuilders[0];
              filterType = uiBuilder.modelType
            }

            // Create an object with the properties to pass on to the new draft model
            var newModelAttrs = {}

            // If there is a currently selected UI editor, then find the common model
            // attributes that we should pass on to the new UI editor type
            if (this.currentUIBuilder) {
              newModelAttrs = this.getCommonAttributes(
                this.currentUIBuilder.draftModel,
                newFilterType
              )
            }

            // If a UI editor has already been created for this Filter Type, then just
            // update the pre-existing draft model. This way, if a user has already
            // selected content that is specific to a filter type (e.g. choices for a
            // choiceFilter), that content will still be there when they switch back to
            // it. Otherwise, use a clone of the model set on this view. We will update
            // the actual model in the Filters collection only when the user clicks save.
            if (!uiBuilder.draftModel) {
              if (this.model.type == newFilterType) {
                uiBuilder.draftModel = this.model.clone()
              } else {
                uiBuilder.draftModel = uiBuilder.modelFunction();
              }
            }
            if (Object.keys(newModelAttrs).length) {
              uiBuilder.draftModel.set(newModelAttrs)
            }
            // Save the new selection to the view
            this.currentUIBuilder = uiBuilder;

            // Find the container for this filter type
            var uiBuilderContainer = uiBuilder.container;

            // Create or update view
            this.currentUIBuilder.view = this.currentUIBuilder.uiFunction(uiBuilder.draftModel);
            uiBuilderContainer.html(this.currentUIBuilder.view.el)
            this.currentUIBuilder.view.render();

            // Add the selected/active class to the clicked FilterTypeIcon, remove it from
            // the other icons.
            this.uiBuilders.forEach(function (uiBuilder) {
              uiBuilder.button.removeClass(view.classes.uiBuilderChoiceActive)
            })
            this.currentUIBuilder.button.addClass(view.classes.uiBuilderChoiceActive);

            // Have the carousel slide to the selected uiBuilder container.
            this.uiBuilderCarousel.carousel(index)

          }
          catch (error) {
            console.log(
              'There was an error switching filter types in a FilterEditorView.' +
              ' Error details: ' + error);
          }
        },

        /**
         * Checks for attribute keys that are the same between a given Filter model, and a
         * new Filter model type. Returns an object of model attributes that are relevant
         * to the new Filter model type. The values for this object will be pulled from
         * the given model. objectDOM, cid, and nodeName attributes are always excluded.
         *
         * @param {Filter} filterModel A filter model
         * @param {string} newFilterType The name of the new filter model type
         *
         * @returns {Object} returns the model attributes from the given filterModel that
         * are also relevant to the new Filter model type.
         */
        getCommonAttributes: function (filterModel, newFilterType) {
          try {

            // The filter model attributes that are common to both the current Filter Model
            // and the new Filter Type that we want to create.
            var commonAttributes = {};

            // Given the newFilterType string, get the default attribute names for a new
            // model of that type. 
            var uiBuilder = _.findWhere(this.uiBuilders, { modelType: newFilterType });
            var defaultAttrs = uiBuilder.modelFunction().defaults();
            var defaultAttrNames = Object.keys(defaultAttrs);

            // Check if any of those attribute types exist in the current filter model.
            // If they do, include them in the common attributes object.
            var currentAttrs = filterModel.toJSON();
            defaultAttrNames.forEach(function (attrName) {
              var valueInDraftModel = currentAttrs[attrName];
              if (valueInDraftModel || valueInDraftModel === 0 | valueInDraftModel === false) {
                commonAttributes[attrName] = valueInDraftModel
              }
            }, this);

            // Exclude attributes that shouldn't be passed to a new model, like the
            // objectDOM and the model ID.
            delete commonAttributes.objectDOM
            delete commonAttributes.cid
            delete commonAttributes.nodeName

            // Return the common attributes
            return commonAttributes
          }
          catch (error) {
            console.log(
              'There was an error getting common model attributes in a FilterEditorView' +
              '. Error details: ' + error);
          }
        },

      })
    return FilterEditorView
  });