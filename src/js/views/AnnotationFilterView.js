define(
  [
    "jquery",
    "underscore",
    "backbone",
    "bioportal",
  ],
  function(
    $, _, Backbone, Bioportal,
  ) {

    /**
     * @class AnnotationFilter
     * @classdesc A view that renders an annotation filter interface, which uses
     * the bioportal tree search to select ontology terms.
     * @extends Backbone.View
     * @constructor
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
        className: "annotation-filter",
        
        /**        
         * The selector for the element that will show/hide the annotation
         * popover interface when clicked.
         * @type {string}        
         */         
        popoverTriggerSelector: "",
        
        /**        
         * The URL that indicates the concept where the tree should start        
         */         
        startingRoot: "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType",

        /**
         * Creates a new AnnotationFilterView
         * @param {Object} options - A literal object with options to pass to the view
         */
        initialize: function(options) {
          try {

            // Get all the options and apply them to this view
            if (typeof options == "object") {
              var optionKeys = Object.keys(options);
              _.each(optionKeys, function(key, i) {
                this[key] = options[key];
              }, this);
            }

          } catch (e) {
            console.log("Failed to initialize an Annotation Filter View, error message:", e);
          }
        },

        /**        
         * render - Render the view
         *          
         * @return {AnnotationFilter}  Returns the view
         */
        render: function() {
          try {
            
            if(!MetacatUI.appModel.get("bioportalAPIKey")){
              console.log("A bioportal key is required for the Annotation Filter View. Please set a key in the MetacatUI config. The view will not render.");
              return
            }

            this.$el.append('<div id="bioportal-tree"></div>');
            this.popoverContainer = $('<div id="bioportal-popover" data-category="annotation"></div>');
            $("body").append(this.popoverContainer);
            this.setUpTree();
            this.setListeners();

            return this

          } catch (e) {
            console.log("Failed to render an Annotation Filter View, error message: " + e);
          }
        },

        /**        
         * setUpTree - Create the HTML for the annotation tree
         */
        setUpTree: function() {

          try {
            var view = this;

            this.treeEl = $("#bioportal-tree").NCBOTree({
              apikey: MetacatUI.appModel.get("bioportalAPIKey"),
              ontology: "ECSO",
              width: "400",
              startingRoot: view.startingRoot
            });

            // Make a container for the tree and nav buttons
            var contentPlus = $("<div></div>");
            this.jumpUpButton = $("<button class='icon icon-level-up tooltip-this' id='jumpUp' data-trigger='hover' data-title='Go up to parent' data-placement='top'></button>");
            this.resetButton = $("<button class='icon icon-undo tooltip-this' id='resetTree' data-trigger='hover' data-title='Reset tree' data-placement='top'></button>");
            $(contentPlus).append(view.jumpUpButton);
            $(contentPlus).append(view.resetButton);
            $(contentPlus).append(view.treeEl);

            $(this.popoverTriggerSelector).popover({
              html: true,
              placement: "bottom",
              trigger: "manual",
              content: contentPlus,
              container: "#bioportal-popover"
            }).on("click", function() {
              if ($($(this).data().popover.options.content).is(":visible")) {
                // Detach the tree from the popover so it doesn't get removed by Bootstrap
                $(this).data().popover.options.content.detach();
                // Hide the popover
                $(this).popover("hide");
              } else {
                // Get the popover content
                var content = $(this).data().popoverContent ||
                  $(this).data().popover.options.content.detach();
                // Cache it
                $(this).data({
                  popoverContent: content
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
            console.log("Failed to set up an annotation tree, error message: " + e);
          }

        },
        
        /**        
         * setListeners - Sets listeners on the tree elements. Must be run
         * after the tree HTML is created.
         */         
        setListeners: function(){
          var view = this;
          this.treeEl.off();
          this.jumpUpButton.off();
          this.resetButton.off();
          this.treeEl.on("afterSelect", function(event, classId, prefLabel, selectedNode) {
            view.selectConcept.call(view, event, classId, prefLabel, selectedNode)
          });
          this.treeEl.on("afterJumpToClass", function(event, classId) {
            view.afterJumpToClass.call(view, event, classId);
          });
          this.treeEl.on("afterExpand", function() {
            view.afterExpand.call(view)
          });
          this.jumpUpButton.on("click", function(){
            view.jumpUp.call(view);
          });
          this.resetButton.on("click", function(){
            view.resetTree.call(view);
          });
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
        selectConcept: function(event, classId, prefLabel, selectedNode) {

          try {
            
            var view = this;
            
            // Get the concept info
            var item = {
              value: classId,
              label: prefLabel,
              filterLabel: prefLabel,
              desc: ""
            }

            // Trigger an event so that the parent view can update filters, etc.
            this.trigger("annotationSelected", event, item);

            // Hide the hover
            $(selectedNode).trigger("mouseout");

            // Hide the popover
            var annotationFilterEl = $(this.popoverTriggerSelector);
            annotationFilterEl.trigger("click");

            // Reset the tree for next search
            var tree = this.treeEl.data("NCBOTree");
            var options = tree.options();
            $.extend(options, {
              startingRoot: view.startingRoot
            });
            tree.changeOntology("ECSO");

            // Prevent default action
            return false;
            
          } catch (e) {
            console.log("Failed to select an annotation concept, error message: " + e);
          }

        },
        
        /**        
         * afterExpand - Actions to perform when the user expands a concept in
         * the tree
         */         
        afterExpand: function() {
          try {
            // Ensure tooltips are activated
            $(".tooltip-this").tooltip();
          } catch (e) {
            console.log("Failed to initialize tooltips in the annotation filter, error message: " + e);
          }
        },
        
        /**        
         * afterJumpToClass - Called when a user searches for and selects a
         * concept from the search results
         *          
         * @param  {type} event   The jump to class event
         * @param  {type} classId The ID for the selected concept (a URL)
         */         
        afterJumpToClass: function(event, classId) {
          
          try {
            var view = this;
            // Re-root the tree at this concept
            var tree = this.treeEl.data("NCBOTree");
            var options = tree.options();
            $.extend(options, {
              startingRoot: classId
            });

            // Force a re-render
            tree.init();

            // Ensure the tooltips are activated
            $(".tooltip-this").tooltip();
            
          } catch (e) {
            console.log("Failed to re-render the annotation filter after jump to class, error message: " + e);
          }

        },
        
        /**               
         * jumpUp -  Jumps up to the parent concept in the UI
         *          
         * @return {boolean}  Returns false 
         */         
        jumpUp: function() {

          try {
            // Re-root the tree at the parent concept of the root
            var view = this,
                tree = this.treeEl.data("NCBOTree"),
                options = tree.options(),
                startingRoot = options.startingRoot;

            if (startingRoot == view.startingRoot) {
              return false;
            }

            var parentId = $("a[data-id='" + encodeURIComponent(startingRoot) + "'").attr("data-subclassof");

            // Re-root
            $.extend(options, {
              startingRoot: parentId
            });

            // Force a re-render
            tree.init();

            // Ensure the tooltips are activated
            $(".tooltip-this").tooltip();

            return false;
            
          } catch (e) {
            console.log("Failed to jump to parent concept in the annotation filter, error message: " + e);
          }

        },

        /**        
         * resetTree - Collapse all expanded concepts
         *          
         * @return {boolean}  Returns false
         */         
        resetTree: function() {

          try {
            
            var view = this;

            // Re-root the tree at the original concept
            var tree = this.treeEl.data("NCBOTree");
            var options = tree.options();

            // Re-root
            $.extend(options, {
              startingRoot: view.startingRoot
            });

            // Force a re-render
            tree.init();

            // Ensure the tooltips are activated
            $(".tooltip-this").tooltip();

            return false;
          } catch (e) {
            console.log("Failed to reset the annotation filter tree, error message: " + e);
          }

        },

      });
  });
