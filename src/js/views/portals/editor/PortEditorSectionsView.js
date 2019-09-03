define(['underscore',
        'jquery',
        'backbone',
        'models/portals/PortalModel',
        "views/portals/editor/PortEditorSectionView",
        "views/portals/editor/PortEditorSettingsView",
        "views/portals/editor/PortEditorDataView",
        "views/portals/editor/PortEditorMdSectionView",
        "text!templates/portals/editor/portEditorSections.html",
        "text!templates/portals/editor/portEditorMetrics.html",
        "text!templates/portals/editor/portEditorSectionLink.html"],
function(_, $, Backbone, Portal,
          PortEditorSectionView, PortEditorSettingsView, PortEditorDataView,
          PortEditorMdSectionView,
          Template, MetricsSectionTemplate, SectionLinkTemplate){

  /**
  * @class PortEditorSectionsView
  */
  var PortEditorSectionsView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorSections",

    /**
    * The HTML tag name for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "proj-editor-sections",

    /**
    * The PortalModel that is being edited
    * @type {Portal}
    */
    model: undefined,

    /**
    * The currently active editor section. e.g. Data, Metrics, Settings, etc.
    * @type {string}
    */
    activeSection: "",

    /**
    * The names of all sections in this portal editor
    * @type {Array}
    */
    sectionNames: [],

    /**
    * The subviews contained within this view to be removed with onClose
    * @type {Array}
    */
    subviews: new Array(),

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),
    sectionLinkTemplate: _.template(SectionLinkTemplate),
    metricsSectionTemplate: _.template(MetricsSectionTemplate),

    /**
    * A jQuery selector for the element that the PortEditorDataView should be inserted into
    * @type {string}
    */
    projEditDataViewContainer: ".proj-editor-data-container",
    /**
    * A jQuery selector for the element that the Metrics section should be inserted into
    * @type {string}
    */
    projEditMetricsContainer:  ".proj-editor-metrics-container",
    /**
    * A jQuery selector for the element that the PortEditorSettingsView should be inserted into
    * @type {string}
    */
    projSettingsContainer: ".proj-editor-settings-container",
    /**
    * A jQuery selector for the elements that are links to the individual sections
    * @type {string}
    */
    sectionLinks: ".section-link",
    /**
    * A jQuery selector for the element that the section links should be inserted into
    * @type {string}
    */
    sectionLinksContainer: ".section-links-container",
    /**
    * A jQuery selector for the element that the editor sections should be inserted into
    * @type {string}
    */
    sectionsContainer: ".sections-container",

    /**
    * @borrows PortalEditorView.newPortalTempName as newPortalTempName
    */
    newPortalTempName: "",

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      ".add-section"    : "addSection",
      ".remove-section" : "removeSection",
      ".rename-section" : "renameSection"
    },

    /**
    * Creates a new PortEditorSectionsView
    * @constructs PortEditorSectionsView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){
      if(typeof options == "object"){
        this.activeSection = options.activeSection || "";
        this.newPortalTempName = options.newPortalTempName || "";
      }
    },

    /**
    * Renders the PortEditorSectionsView
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

      //Render a Section View for each content section in the Portal
      this.renderContentSections();

      //Render the Data section
      this.renderDataSection();

      //Render the Metrics section
      this.renderMetricsSection();

      //Render the Add Section tab
      this.renderAddSection();

      //Render the Settings
      this.renderSettings();

      //Switch to the active section
      this.switchSection();

    },

    /**
    * Render a section for adding a new section
    */
    renderAddSection: function(){

      // Add a "Add section" button/tab
      var addSectionView = new PortEditorSectionView({
        model: this.model,
        sectionName: "AddSection"
      });

      // Add markdown section container, insert section HTML
      var addSectionDiv = $(document.createElement("div"))
        .addClass("tab-pane")
        .addClass("proj-editor-add-section-container")
        .attr("id", addSectionView.getName({ linkFriendly: true }))
        .html(addSectionView.el);

      //Add the section element to this view
      this.$(this.sectionsContainer).append(addSectionDiv);

      //Render the section view
      addSectionView.render();

      // Add the tab to the tab navigation
      this.addSectionLink(addSectionView);

      // Replace the name "AddSection" with fontawsome "+" icon
      // Note: Select <li> element based on the href attribute of it's child
      // because adding an id to <li> or <a> breaks Bootstrap's tab function
      this.$(this.sectionLinksContainer).children().each(function(i, li){
        if($(li).children().attr("href") == "#AddSection"){
          $(li).children().html("<i class='icon icon-plus'></i>");
        };
      });

      //Add the view to the subviews array
      this.subviews.push(addSectionView);

    },

    /**
    * Render a section in the editor for each content section in the Portal
    */
    renderContentSections: function(){

      //Get the sections from the Portal
      var sections = this.model.get("sections");

      // Iterate over each "markdown" section in the PortalModel `sections`
      _.each(sections, function(section){
        if(section){

          // Create and render and markdown section view
          var sectionView = new PortEditorMdSectionView({
            model: section
          });

          // Add markdown section container, insert section HTML
          var markdownSectionDiv = $(document.createElement("div"))
            .addClass("tab-pane")
            .addClass("proj-editor-markdown-container")
            .attr("id", sectionView.getName({ linkFriendly: true }))
            .html(sectionView.el);

          //Insert the PortEditorMdSectionView element into this view
          this.$(this.sectionsContainer).append(markdownSectionDiv);

          //Render the PortEditorMdSectionView
          sectionView.render();

          // Add the tab to the tab navigation
          this.addSectionLink(sectionView);
          // Add the sections to the list of subviews
          this.subviews.push(sectionView);

        }
      }, this);

    },

    /**
    * Renders a Data section in this view
    */
    renderDataSection: function(){
      // Render a PortEditorDataView and corresponding tab
      var dataView = new PortEditorDataView({
        model: this.model
      });

      //Insert the subview element into this view
      this.$(this.projEditDataViewContainer)
          .html(dataView.el)
          .attr("id", dataView.getName({ linkFriendly: true }));

      //Render the PortEditorDataView
      dataView.render();

      // Add the tab to the tab navigation
      this.addSectionLink(dataView);

      // Add the data section to the list of subviews
      this.subviews.push(dataView);
    },

    /**
    * Renders the Metrics section of the editor
    */
    renderMetricsSection: function(){
      // Render a PortEditorSectionView for the Metrics section and corresponding tab
      // if the hide metrics view option is not true
      if(this.model.get("hideMetrics") !== true){

        //Create a PortEditorSectionView for the Metrics section
        var metricsView = new PortEditorSectionView({
          model: this.model,
          sectionName: "Metrics",
          template: this.metricsSectionTemplate
        });

        //Add the view's element to the page
        this.$(this.projEditMetricsContainer)
            .html(metricsView.el)
            .attr("id", metricsView.getName({ linkFriendly: true }));

        //Render the view
        metricsView.render();

        // Add the tab to the tab navigation
        this.addSectionLink(metricsView);

        // Add the data section to the list of subviews
        this.subviews.push(metricsView);
      }
    },

    /**
    * Renders the Settings section of the editor
    */
    renderSettings: function(){

      //Create a PortEditorSettingsView
      // Pass on the 'newPortalTempName', so that it can be used as a
      // restricted label during label validation
      var settingsView = new PortEditorSettingsView({
        model: this.model,
        newPortalTempName: this.newPortalTempName
      });

      //Add the PortEditorSettingsView element to this view
      this.$(this.projSettingsContainer)
          .html(settingsView.el)
          .attr("id", settingsView.getName({ linkFriendly: true }));

      //Render the PortEditorSettingsView
      settingsView.render();

      this.addSectionLink(settingsView);

      // Use bootstrap's 'pull-right' class to right-align Settings tab
      this.$(this.sectionLinksContainer).children().each(function(i, li){
        if($(li).children().attr("href") == "#Settings"){
          $(li).addClass("pull-right");
        };
      });

      // Add the data section to the list of subviews
      this.subviews.push(settingsView);

    },

    /**
     * Update the path when tabs are clicked
     * @param {Event} [e] - The click event on the navigation elements (tabs)
    */
    updatePath: function(e){

      if(e){
        var sectionView = $(e.target).data("view");
        if( typeof sectionView !== "undefined"){
          sectionView.postRender();
        }

        // Get the href of the clicked link
        var linkTarget = $(e.target).attr("href");
        linkTarget = linkTarget.substring(1);

        // Set this view's active section name to the link href
        this.activeSection = linkTarget;
      }

      var label         = this.model.get("label") || this.newPortalTempName,
          originalLabel = this.model.get("originalLabel") || this.newPortalTempName,
          section       = this.activeSection,
          pathName      = window.location.pathname
                          .substring(MetacatUI.root.length)
                          // remove trailing forward slash if one exists in path
                          .replace(/\/$/, "");

      // Add or replace the label and section part of the path with updated values.
      // pathRE matches "/label/section", where the "/section" part is optional
      var pathRE = new RegExp("\\/(" + label + "|" + originalLabel + ")(\\/[^\\/]*)?$", "i");
      newPathName = pathName.replace(pathRE, "") + "/" + label + "/" + section;

      // Update the window location
      MetacatUI.uiRouter.navigate( newPathName, { trigger: false } );

    },

    /**
    * Gets a list of section names from tab elements and updates the
    * sectionNames attribute on this view.
    */
    updateSectionNames: function() {

      // Get the section names from the tab elements
      var sectionNames = [];
      this.$(this.sectionLinks)
        .each(function(i, anchorEl){
          sectionNames[i] = $(anchorEl)
                              .attr("href")
                              .substring(1)
        });

      // Set the array of sectionNames on the view
      this.sectionNames = sectionNames;
    },

    /**
    * Manually switch to a section subview by making the tab and tab panel active.
    * Navigation between sections is usually handled automatically by the Bootstrap
    * library, but a manual switch may be necessary sometimes
    * @param {string} [sectionName] - The section to switch to. If not given, defaults to the activeSection set on the view.
    */
    switchSection: function(sectionName){

      // Make sure the list of section names is up to date
      this.updateSectionNames();

      // If no section name is given, use the active section in the view.
      // If there's also no activeSection, then default to an empty string,
      // which will set the navigation to the first section listed
      if( !sectionName ){
        var sectionName = this.activeSection || ""
      }

      // Match the section name to the list of section names on the view
      // Allow case insensitive navigation to sections
      var i = this.sectionNames
              .map(v => v.toLowerCase())
              .indexOf(
                sectionName.toLowerCase()
              );

      // If there was a match
      if(i>=0){
        sectionName = this.sectionNames[i];
      //Otherwise, switch to the first section listed
      } else {
        if(this.sectionNames.length){
          sectionName = this.sectionNames[0]
        }
      }

      // Update the activeSection set on the view for consistency with the path
      // and with capitalization
      this.activeSection = sectionName;

      // Activate the section content
      this.$(this.sectionsContainer).children("#" + sectionName).addClass("active");

      // Activate the tab
      this.$(this.sectionLinksContainer).children().each(function(i, li){
        if($(li).children().attr("href") == "#" + sectionName){
          $(li).addClass("active")
        };
      });

      this.updatePath();

      // Update path when each tab is clicked and shown
      view = this;
      this.$('a[data-toggle="tab"]').on('shown', function(e){
        view.updatePath(e)
      });

    },

    /**
    * Add a link to the given editor section
    * @param {PortEditorSectionView} sectionView - The view to add a link to
    */
    addSectionLink: function(sectionView){

      this.$(this.sectionLinksContainer).append(this.sectionLinkTemplate({
        href: "#" + sectionView.getName({ linkFriendly: true }),
        sectionName: sectionView.getName()
      }))

    },

    /**
    * Adds a section and tab to this view and the PortalModel
    * @param {Event} [e] - (optional) The click event on the Add button
    */
    addSection: function(e){

    },

    /**
    * Removes a section and its tab from this view and the PortalModel
    * @param {Event} [e] - (optional) The click event on the Remove button
    */
    removeSection: function(e){

    },

    /**
    * Renames a section in the tab in this view and in the PortalSectionModel
    * @param {Event} [e] - (optional) The click event on the Rename button
    */
    renameSection: function(){

    },

    /**
     * This function is called when the app navigates away from this view.
     * Any clean-up or housekeeping happens at this time.
     */
    onClose: function() {
        //Remove each subview from the DOM and remove listeners
        _.invoke(this.subviews, "remove");

        this.subviews = new Array();
    }

  });

  return PortEditorSectionsView;

});
