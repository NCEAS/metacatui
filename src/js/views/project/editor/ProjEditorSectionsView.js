define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectModel',
        "views/project/editor/ProjEditorSectionView",
        "views/project/editor/ProjEditorSettingsView",
        "views/project/editor/ProjEditorDataView",
        "views/project/editor/ProjEditorMdSectionView",
        "text!templates/project/editor/projEditorSections.html",
        "text!templates/project/editor/projEditorSectionLink.html"],
function(_, $, Backbone, Project,
          ProjEditorSectionView, ProjEditorSettingsView, ProjEditorDataView,
          ProjEditorMdSectionView,
          Template, SectionLinkTemplate){

  /**
  * @class ProjEditorSectionsView
  */
  var ProjEditorSectionsView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ProjEditorSections",

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
    * The ProjectModel that is being edited
    * @type {Project}
    */
    model: undefined,

    /**
    * The currently active editor section. e.g. Data, Metrics, Settings, etc.
    * @type {string}
    */
    activeSection: "",

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

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      ".add-section"    : "addSection",
      ".remove-section" : "removeSection",
      ".rename-section" : "renameSection"
    },

    projectIdentifier: "",

    /**
    * Creates a new ProjEditorSectionsView
    * @constructs ProjEditorSectionsView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){
      if(typeof options == "object"){
        this.projectIdentifier = options.projectIdentifier || "";
        this.activeSection = options.activeSection || "";
      }
    },

    /**
    * Renders the ProjEditorSectionsView
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

      // Iterate over each "markdown" section in the ProjectModel `sections`
      var sections = this.model.get("sections");
      _.each(sections, function(section){
        if(section){

          // Create and render and markdown section view
          var sectionView = new ProjEditorMdSectionView({
            model: section
          });
          sectionView.render();
          // Add markdown section container, insert section HTML
          var markdownSectionDiv = $(document.createElement("div"))
            .addClass("tab-pane")
            .addClass("proj-editor-markdown-container")
            .attr("id", sectionView.getName({ linkFriendly: true }))
            .html(sectionView.el);
          this.$(".tab-content").append(markdownSectionDiv);

          // Add the tab to the tab navigation
          this.addSectionLink(sectionView);
          // Add the sections to the list of subviews
          this.subviews.push(sectionView);

        }
      }, this);

      // Render a ProjEditorDataView and corresponding tab
      var dataView = new ProjEditorDataView({
        model: this.model
      });
      dataView.render();
      this.$(".proj-editor-data-container")
          .html(dataView.el)
          .attr("id", dataView.getName({ linkFriendly: true }));
      // Add the tab to the tab navigation
      this.addSectionLink(dataView);
      // Add the data section to the list of subviews
      this.subviews.push(dataView);

      // Render a ProjEditorSectionView for the Metrics section and corresponding tab
      // if the hide metrics view option is not true
      if(this.model.get("hideMetrics") == false){
        var metricsView = new ProjEditorSectionView({
          model: this.model,
          sectionName: "Metrics"
        });
        metricsView.render();
        this.$(".proj-editor-metrics-container")
            .html(metricsView.el)
            .attr("id", metricsView.getName({ linkFriendly: true }));
        // Add the tab to the tab navigation
        this.addSectionLink(metricsView);
        // Add the data section to the list of subviews
        this.subviews.push(metricsView);
      };

      // Add a "Add section" button/tab
      var addSectionView = new ProjEditorSectionView({
        model: this.model,
        sectionName: "AddSection"
      });
      addSectionView.render();
      // Add markdown section container, insert section HTML
      var addSectionDiv = $(document.createElement("div"))
        .addClass("tab-pane")
        .addClass("proj-editor-add-section-container")
        .attr("id", addSectionView.getName({ linkFriendly: true }))
        .html(addSectionView.el);
      this.$(".tab-content").append(addSectionDiv);
      // Add the tab to the tab navigation
      this.addSectionLink(addSectionView);
      // Replace the name "AddSection" with fontawsome "+" icon
      // Note: Select <li> element based on the href attribute of it's child
      // because adding an id to <li> or <a> breaks Bootstrap's tab function
      this.$(".nav-tabs").children().each(function(i, li){
        if($(li).children().attr("href") == "#AddSection"){
          $(li).children().html("<i class='icon icon-plus'></i>");
        };
      });
      this.subviews.push(addSectionView);


      //Render a Settings section
      var settingsView = new ProjEditorSettingsView({
        model: this.model
      });
      settingsView.render();
      this.$(".proj-editor-settings-container")
          .html(settingsView.el)
          .attr("id", settingsView.getName({ linkFriendly: true }));
      this.addSectionLink(settingsView);
      // Use bootstrap's 'pull-right' class to right-align Settings tab
      this.$(".nav-tabs").children().each(function(i, li){
        if($(li).children().attr("href") == "#Settings"){
          $(li).addClass("pull-right");
        };
      });
      // Add the data section to the list of subviews
      this.subviews.push(settingsView);

      // Switch to the active section, if one is specified.
      var activeSection = this.activeSection;
      if(!activeSection){
        activeSection = "Data"
      }
      // Activate the section content
      this.$(".tab-content").children("#"+activeSection).addClass("active");
      // Activate the tab
      this.$(".nav-tabs").children().each(function(i, li){
        if($(li).children().attr("href") == "#"+activeSection){
          $(li).addClass("active")
        };
      });

      // Update path when each tab is clicked and shown
      view = this;
      this.$('a[data-toggle="tab"]').on('shown', function(e){
        view.updatePath(e)
      });

    },

    /**
     * Update the path when tabs are clicked
     * @param {Event} e - The click event on the navigation elements (tabs)
    */
    updatePath: function(e){

      var sectionView = $(e.target).data("view");

      if( typeof sectionView !== "undefined"){
        sectionView.postRender();
      }

      // Get the href of the clicked link
      var linkTarget = $(e.target).attr("href");
      linkTarget = linkTarget.substring(1);

      // Set this view's active section name to the link href
      this.activeSection = linkTarget;

      var projName = this.projectIdentifier;
      var pathName = window.location.pathname;

      //Get the new pathname using the active section
      if( !MetacatUI.root.length || MetacatUI.root == "/" ){
        // If it's a new project, the project name might not be in the URL yet
        if(pathName.indexOf(projName) < 0){
          var newPathName = pathName + "/" + projName + "/" + this.activeSection;
        } else {
          var newPathName = pathName.substring(0, pathName.indexOf(projName)) +
                              projName + "/" + this.activeSection;
        }
      }
      else{
        var newPathName = pathName.substring( pathName.indexOf(MetacatUI.root) + MetacatUI.root.length );
        newPathName = newPathName.substring(0, newPathName.indexOf(projName)) +
                            projName + "/" + this.activeSection;
      }
      //Update the window location
      MetacatUI.uiRouter.navigate( newPathName, { trigger: false } );

    },

    /**
    * Add a link to the given editor section
    * @param {ProjEditorSectionView} sectionView - The view to add a link to
    */
    addSectionLink: function(sectionView){

      this.$(".section-links-container").append(this.sectionLinkTemplate({
        href: "#" + sectionView.getName({ linkFriendly: true }),
        sectionName: sectionView.getName()
      }))

    },



    /**
    * Adds a section and tab to this view and the ProjectModel
    * @param {Event} [e] - (optional) The click event on the Add button
    */
    addSection: function(e){

    },

    /**
    * Removes a section and its tab from this view and the ProjectModel
    * @param {Event} [e] - (optional) The click event on the Remove button
    */
    removeSection: function(e){

    },

    /**
    * Renames a section in the tab in this view and in the ProjectSectionModel
    * @param {Event} [e] - (optional) The click event on the Rename button
    */
    renameSection: function(){

    },

    /**
    * Manually switch to a section subview by making the tab and tab panel active.
    * Navigation between sections is usually handled automatically by the Bootstrap
    * library, but a manual switch may be necessary sometimes
    * @param {string} sectionName - The section to switch to
    */
    switchSection: function(sectionName){

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

  return ProjEditorSectionsView;

});
