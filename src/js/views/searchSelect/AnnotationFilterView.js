define(["jquery", "underscore", "backbone", "bioportal"], function (
  $,
  _,
  Backbone,
  Bioportal,
) {
  /**
   * @class AnnotationFilter
   * @classdesc A view that renders an annotation filter interface, which uses
   * the bioportal tree search to select ontology terms.
   * @classcategory Views/SearchSelect
   * @extends Backbone.View
   * @constructor
   * @since 2.14.0
   * @screenshot views/searchSelect/AnnotationFilterView.png
   */
  return Backbone.View.extend(
    /** @lends AnnotationFilterView.prototype */
    {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "AnnotationFilter",

      /**
       * The HTML class names for this view element
       * @type {string}
       */
      className: "filter annotation-filter",

      /**
       * The selector for the element that will show/hide the annotation
       * popover interface when clicked. Searches within body.
       * @type {string}
       */
      popoverTriggerSelector: "",

      /**
       * If set to true, instead of showing the annotation tree interface in
       * a popover, show it in a multi-select input interface, which allows
       * the user to select multiple annotations.
       * @type {boolean}
       */
      multiselect: false,

      /**
       * If true, this filter will be added to the query but will
       * act in the "background", like a default filter
       * @type {boolean}
       * @since 2.22.0
       */
      isInvisible: true,

      /**
       * If set to true, instead of showing the annotation tree interface in
       * a popover, show it on the custom search filter interface, which allows
       * the user to filter search based on the annotations.
       * @type {boolean}
       * @since 2.22.0
       */
      useSearchSelect: false,

      /**
       * The acronym of the ontology or ontologies to render a tree from.
       *
       * Must be an ontology that's present on BioPortal.
       *
       * TODO: Test out comma-separated lists. How does that render?
       * @type {string}
       * @since 2.22.0
       */
      defaultOntology: "ECSO",

      /**
       * The URL that indicates the concept where the tree should start
       * @type {string}
       */
      defaultStartingRoot:
        "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType",

      /**
       * Creates a new AnnotationFilterView
       * @param {Object} options - A literal object with options to pass to the view
       */
      initialize: function (options) {
        try {
          // Get all the options and apply them to this view
          if (typeof options == "object") {
            var optionKeys = Object.keys(options);
            _.each(
              optionKeys,
              function (key, i) {
                // Only override non-null values so we can pass in nulls and
                // still trigger default behavior
                if (typeof options[key] === "undefined") {
                  return;
                }

                this[key] = options[key];
              },
              this,
            );
          }

          // Mix in defaults if needed
          if (!this.ontology) {
            this.ontology = this.defaultOntology;
            this.startingRoot = this.defaultStartingRoot;
          }
        } catch (e) {
          console.log(
            "Failed to initialize an Annotation Filter View, error message:",
            e,
          );
        }
      },

      /**
       * render - Render the view
       *
       * @return {AnnotationFilter}  Returns the view
       */
      render: function () {
        try {
          if (!MetacatUI.appModel.get("bioportalAPIKey")) {
            console.log(
              "A bioportal key is required for the Annotation Filter View. Please set a key in the MetacatUI config. The view will not render.",
            );
            return;
          }

          var view = this;

          if (view.multiselect || view.useSearchSelect) {
            view.createMultiselect();
          } else {
            view.setUpTree();
            view.createPopoverHTML();
            view.setListeners();
          }

          return this;
        } catch (e) {
          console.log(
            "Failed to render an Annotation Filter View, error message: " + e,
          );
        }
      },

      /**
       * setUpTree - Create the HTML for the annotation tree
       */
      setUpTree: function () {
        try {
          var view = this;

          view.treeEl = $('<div id="bioportal-tree"></div>').NCBOTree({
            apikey: MetacatUI.appModel.get("bioportalAPIKey"),
            ontology: view.ontology,
            width: "400",
            startingRoot: view.startingRoot,
          });

          // Make an element that contains the tree and reset/jumpUp buttons
          var buttonProps =
            "data-trigger='hover' data-placement='top' data-container='body' style='margin-right: 3px'";
          view.treeContent = $("<div></div>");
          view.buttonContainer = $(
            '<div class="ncbo-tree-buttons-container"></div>',
          );
          view.jumpUpButton = $(
            "<button class='icon icon-level-up tooltip-this btn' id='jumpUp' data-title='Go up to parent' " +
              buttonProps +
              " ></button>",
          );
          view.resetButton = $(
            "<button class='icon icon-undo tooltip-this btn' id='resetTree' data-title='Reset tree' " +
              buttonProps +
              " ></button>",
          );
          $(view.buttonContainer).append(view.jumpUpButton);
          $(view.buttonContainer).append(view.resetButton);
          $(view.treeContent).append(view.buttonContainer);
          $(view.treeContent).append(view.treeEl);
        } catch (e) {
          console.log(
            "Failed to set up an annotation tree, error message: " + e,
          );
        }
      },

      /**
       * createMultiselect - Create a searchable multi-select interface
       * that includes an annotation filter tree.
       */
      createMultiselect: function () {
        try {
          var view = this;

          require(["views/searchSelect/SearchSelectView"], function (
            SearchSelect,
          ) {
            view.multiSelectView = new SearchSelect({
              placeholderText: view.placeholderText
                ? view.placeholderText
                : "Search for or select a value",
              icon: view.icon,
              separatorText: view.separatorText,
              inputLabel: view.inputLabel,
            });
            view.$el.append(view.multiSelectView.el);
            view.multiSelectView.render();
            // If there are pre-selected values, get the user-facing labels
            // and then update the multiselect
            if (view.selected && view.selected.length) {
              view.getClassLabels.call(view, view.updateMultiselect);
            } else {
              // Otherwise, update the multi-select right away with tree element
              view.updateMultiselect.call(view);
            }

            //Forward the separatorChanged event from the SearchSelectView to this AnnotationFilterView
            //(perhaps this view should have been a subclass?)
            view.multiSelectView.on("separatorChanged", (separatorText) => {
              view.trigger("separatorChanged", separatorText);
            });
          });
        } catch (e) {
          console.log(
            "Failed to create the multi-select interface for an Annotation Filter View, error message: " +
              e,
          );
        }
      },

      /**
       * updateMultiselect - Functions to run once a SearchSelect view has
       * been rendered and inserted into this view, and the labels for any
       * pre-selected annotation values have been fetched. Updates the
       * hidden menu of items and the selected items.
       */
      updateMultiselect: function () {
        try {
          var view = this;

          // Check if this is the first time we are updating this multiselect.
          // If it is, then don't trigger the event that updates the model,
          // because nothing has changed.
          if (view.updateMultiselectTimes === undefined) {
            view.updateMultiselectTimes = 0;
          } else {
            view.updateMultiselectTimes++;
          }

          // Re-init the tree
          view.setUpTree();

          // Re-render the multiselect menu with the new options. These options
          // will be hidden from view, but they must be present in the DOM for
          // the multi-select interface to function correctly.
          // Add an empty item to the list of selected values, so that
          // the dropdown menu is always expandable.
          if (view.options === undefined) {
            view.options = [];
          }
          view.options.push({ value: "" });
          view.multiSelectView.options = view.options;
          view.multiSelectView.updateMenu();
          // Make sure the new menu is attached before updating list of selected
          // annotations
          setTimeout(function () {
            var silent = view.updateMultiselectTimes === 0;
            var newValues = _.reject(view.selected, function (val) {
              return val === "";
            });
            view.multiSelectView.changeSelection(newValues, silent);
          }, 25);

          // Add the annotation tree to the menu content
          view.multiSelectView.$el.find(".menu").append(view.treeContent);
          view.searchInput = view.multiSelectView.$selectUI.find("input");

          // Simulate a search in the annotation tree when the user
          // searches in the multiSelect interface
          view.searchInput.on("keyup", function (e) {
            var treeInput = view.treeContent.find("input.ncboAutocomplete");
            treeInput.val(e.target.value).keydown();
          });

          view.setListeners();
        } catch (e) {
          console.log(
            "Failed to update an annotation filter with selected values, error message: " +
              e,
          );
        }
      },

      /**
       * getClassLabels - Given an array of bioontology IDs set in
       * view.selected, query the bioontology API to find the user-friendly
       * labels (prefLabels)
       *
       * @param  {function} callback A function to call once the labels have
       * been found (or not). The function will be called with the formatted
       * response: an array with an object for each ID with the properties
       * value (the original ID) and label (the user-friendly label, or the
       * value again if no label was found)
       */
      getClassLabels: function (callback) {
        try {
          var view = this;

          if (!view.selected || !view.selected.length) {
            return;
          }

          const ontologyCollection = _.map(view.selected, function (id) {
            return {
              class: id,
              ontology:
                "http://data.bioontology.org/ontologies/" + view.ontology,
            };
          });

          const bioData = JSON.stringify({
            "http://www.w3.org/2002/07/owl#Class": {
              collection: ontologyCollection,
              display: "prefLabel",
            },
          });

          const formatResponse = function (response, success) {
            if (view.options === undefined) {
              view.options = [];
            }
            view.selected.forEach(function (item, index) {
              if (success) {
                var match = _.findWhere(response[Object.keys(response)[0]], {
                  "@id": item,
                });
              } else {
                var match = null;
              }
              view.options[index] = {
                value: item,
                label: match ? match.prefLabel : item,
              };
            });
          };

          // Get the pre-selected values
          $.ajax({
            type: "POST",
            url: "http://data.bioontology.org/batch?display_context=false",
            headers: {
              Authorization:
                "apikey token=" + MetacatUI.appModel.get("bioportalAPIKey"),
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            processData: false,
            data: bioData,
            crossDomain: true,
            timeout: 5000,
            success: function (response) {
              formatResponse(response, true);
              callback.call(view);
            },
            error: function (response) {
              console.log(
                "Error finding class labels for the Annotation Filter, error response:",
                response,
              );
              formatResponse(response, false);
              callback.call(view);
            },
          });
        } catch (e) {
          console.log(
            "Failed to fetch labels for bioontology IDs, error message: " + e,
          );
        }
      },

      /**
       * createPopoverHTML - Create the HTML for annotation filters that are
       * displayed as a popup (e.g. in the search catalog)
       *
       * @return {type}  description
       */
      createPopoverHTML: function () {
        try {
          var view = this;
          $("body").append(
            $('<div id="bioportal-popover" data-category="annotation"></div>'),
          );
          $(view.popoverTriggerSelector)
            .popover({
              html: true,
              placement: "bottom",
              trigger: "manual",
              content: view.treeContent,
              container: "#bioportal-popover",
            })
            .on("click", function () {
              if ($($(this).data().popover.options.content).is(":visible")) {
                // Detach the tree from the popover so it doesn't get removed by Bootstrap
                $(this).data().popover.options.content.detach();
                // Hide the popover
                $(this).popover("hide");
              } else {
                // Get the popover content
                var content =
                  $(this).data().popoverContent ||
                  $(this).data().popover.options.content.detach();
                // Cache it
                $(this).data({
                  popoverContent: content,
                });
                // Show the popover
                $(this).popover("show");
                // Insert the tree into the popover content
                $(this).data().popover.options.content = content;

                // Ensure tooltips are activated
                $(".tooltip-this").tooltip();
              }
            });
        } catch (e) {
          console.log(
            "Failed to create popover HTML for an annotation filter, error message: " +
              e,
          );
        }
      },

      /**
       * setListeners - Sets listeners on the tree elements. Must be run
       * after the tree HTML is created.
       */
      setListeners: function () {
        try {
          var view = this;
          view.treeEl.off();
          view.jumpUpButton.off();
          view.resetButton.off();
          view.treeEl.on(
            "afterSelect",
            function (event, classId, prefLabel, selectedNode) {
              view.selectConcept.call(
                view,
                event,
                classId,
                prefLabel,
                selectedNode,
              );
            },
          );
          view.treeEl.on("afterJumpToClass", function (event, classId) {
            view.afterJumpToClass.call(view, event, classId);
          });
          view.treeEl.on("afterExpand", function () {
            view.afterExpand.call(view);
          });
          view.jumpUpButton.on("click", function () {
            view.jumpUp.call(view);
          });
          view.resetButton.on("click", function () {
            view.resetTree.call(view);
          });
          if (view.multiselect) {
            view.treeEl.off("searchItemSelected");
            view.treeEl.on("searchItemSelected", function () {
              view.searchInput.val("");
            });
            view.stopListening(view.multiSelectView, "changeSelection");
            view.listenTo(
              view.multiSelectView,
              "changeSelection",
              function (newValues) {
                // When values are removed, update the interface
                if (newValues != view.selected) {
                  view.selected = newValues;
                  // So that the function doesn't trigger an endless loop
                  delete view.updateMultiselectTimes;
                  view.updateMultiselect();
                }
                view.trigger("changeSelection", newValues);
              },
            );
          }
        } catch (e) {
          console.log(
            "Failed to set listeners in an Annotation Filter View, error message: " +
              e,
          );
        }
      },

      /**
       * selectConcept - Actions that are performed after the user selects
       * a concept from the annotation tree interface. Triggers an event for
       * any parent views, hides and resets the annotation popup.
       *
       * @param  {object} event        The "afterSelect" event
       * @param  {string} classId      The ID for the selected concept (a URL)
       * @param  {string} prefLabel    The label for the selected concept
       * @param  {jQuery} selectedNode The element that was clicked
       */
      selectConcept: function (event, classId, prefLabel, selectedNode) {
        try {
          var view = this;

          // Get the concept info
          var item = {
            value: classId,
            label: prefLabel,
            filterLabel: prefLabel,
            desc: "",
          };

          // Trigger an event so that the parent view can update filters, etc.
          view.trigger("annotationSelected", event, item);

          // Hide the popover
          if (!view.multiselect) {
            var annotationFilterEl = $(view.popoverTriggerSelector);
            annotationFilterEl.trigger("click");
            $(selectedNode).trigger("mouseout");
            view.resetTree();

            // Update the multi-select with the new options
          } else {
            view.options.push(item);
            view.selected.push(item.value);
            view.updateMultiselect();
          }

          // Ensure tooltips are removed
          $("body > .tooltip").remove();

          // Prevent default action
          return false;
        } catch (e) {
          console.log(
            "Failed to select an annotation concept, error message: " + e,
          );
        }
      },

      /**
       * afterExpand - Actions to perform when the user expands a concept in
       * the tree
       */
      afterExpand: function () {
        try {
          // Ensure tooltips are activated
          $(".tooltip-this").tooltip();
        } catch (e) {
          console.log(
            "Failed to initialize tooltips in the annotation filter, error message: " +
              e,
          );
        }
      },

      /**
       * afterJumpToClass - Called when a user searches for and selects a
       * concept from the search results
       *
       * @param  {type} event   The jump to class event
       * @param  {type} classId The ID for the selected concept (a URL)
       */
      afterJumpToClass: function (event, classId) {
        try {
          var view = this;
          // Re-root the tree at this concept
          var tree = view.treeEl.data("NCBOTree");
          var options = tree.options();
          $.extend(options, {
            startingRoot: classId,
          });

          // Force a re-render
          tree.init();

          // Ensure the tooltips are activated
          $(".tooltip-this").tooltip();
        } catch (e) {
          console.log(
            "Failed to re-render the annotation filter after jump to class, error message: " +
              e,
          );
        }
      },

      /**
       * jumpUp -  Jumps up to the parent concept in the UI
       *
       * @return {boolean}  Returns false
       */
      jumpUp: function () {
        try {
          // Re-root the tree at the parent concept of the root
          var view = this,
            tree = view.treeEl.data("NCBOTree"),
            options = tree.options(),
            startingRoot = options.startingRoot;

          if (startingRoot == view.startingRoot) {
            return false;
          }

          var parentId = $(
            "a[data-id='" + encodeURIComponent(startingRoot) + "'",
          ).attr("data-subclassof");

          // Re-root
          $.extend(options, {
            startingRoot: parentId,
          });

          // Force a re-render
          tree.init();

          // Ensure the tooltips are activated
          $(".tooltip-this").tooltip();

          return false;
        } catch (e) {
          console.log(
            "Failed to jump to parent concept in the annotation filter, error message: " +
              e,
          );
        }
      },

      /**
       * resetTree - Collapse all expanded concepts
       *
       * @return {boolean}  Returns false
       */
      resetTree: function () {
        try {
          var view = this;

          // Re-root the tree at the original concept
          var tree = view.treeEl.data("NCBOTree");

          var options = tree.options();

          // Re-root
          $.extend(options, {
            startingRoot: view.startingRoot,
          });

          tree.changeOntology(view.ontology);

          // Force a re-render
          tree.init();

          // Ensure the tooltips are activated
          $(".tooltip-this").tooltip();

          return false;
        } catch (e) {
          console.log(
            "Failed to reset the annotation filter tree, error message: " + e,
          );
        }
      },
    },
  );
});
