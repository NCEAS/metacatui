define(['underscore',
        'jquery',
        'backbone',
        'models/portals/PortalModel',
        'models/portals/PortalSectionModel',
        "views/portals/editor/PortEditorSectionView",
        "views/portals/editor/PortEditorSettingsView",
        "views/portals/editor/PortEditorDataView",
        "views/portals/editor/PortEditorMdSectionView",
        "text!templates/portals/editor/portEditorSections.html",
        "text!templates/portals/editor/portEditorMetrics.html",
        "text!templates/portals/editor/portEditorSectionLink.html"],
function(_, $, Backbone, Portal, PortalSection,
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
    className: "port-editor-sections",

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
    portEditDataViewContainer: ".port-editor-data-container",
    /**
    * A jQuery selector for the element that the Metrics section should be inserted into
    * @type {string}
    */
    portEditMetricsContainer:  ".port-editor-metrics-container",
    /**
    * A jQuery selector for the element that the PortEditorSettingsView should be inserted into
    * @type {string}
    */
    portSettingsContainer: ".port-editor-settings-container",
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
    * A jQuery selector for the element that a single section link will be inserted into
    * @type {string}
    */
    sectionLinkContainer: ".section-link-container",
    /**
    * A jQuery selector for the element that the editor sections should be inserted into
    * @type {string}
    */
    sectionsContainer: ".sections-container",

    /**
    * Flag to add section name to URL. Enabled by default.
    * @type {boolean}
    */
    displaySectionInUrl: true,

    /**
    * @borrows PortalEditorView.newPortalTempName as newPortalTempName
    */
    newPortalTempName: "",

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      "click .remove-section" : "removeSection",
      "click .rename-section" : "renameSection",
      "click .show-section"   : "showSection",
      "focusout .section-link[contenteditable=true]"  : "updateName"
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
        .addClass("port-editor-add-section-container")
        .attr("id", addSectionView.getName({ linkFriendly: true }))
        .html(addSectionView.el);

      //Add the section element to this view
      this.$(this.sectionsContainer).append(addSectionDiv);

      //Render the section view
      addSectionView.render();

      // Add the tab to the tab navigation
      this.addSectionLink(addSectionView);

      // Replace the name "AddSection" with fontawsome "+" icon
      this.$(this.sectionLinksContainer)
          .find( this.sectionLinkContainer + "[data-section-name='AddSection']")
          .children()
          .html("<i class='icon icon-plus'></i>");

      // When a sectionOption is clicked in the addSectionView subview,
      // the "addSection" event is triggered.
      var view = this;
      addSectionView.off("addSection");
      addSectionView.on("addSection", function(sectionType){
        view.addSection(sectionType);
      });

      //Add the view to the subviews array
      this.subviews.push(addSectionView);

    },

    /**
    * Render all sections in the editor for each content section in the Portal
    */
    renderContentSections: function(){

      //Get the sections from the Portal
      var sections = this.model.get("sections");

      // Render each markdown (aka "freeform") section already in the PortalModel
      _.each(sections, function(section){

        try{
          if(section){
            this.renderContentSection(section);
          }
        }
        catch(e){
          console.error(e);
        }
      }, this);

      // Render additional section views & links when user adds more freeform pages
      this.stopListening(this.model, "addSection");
      this.listenTo(this.model, "addSection", function(section){
        this.renderContentSection(section);
        this.switchSection(section.get("label").replace(/[^a-zA-Z0-9]/g, "-"));
      });

    },

    /**
    * Render a single markdown section in the editor (sectionView + link)
    */
    renderContentSection: function(section){

        try{
          if(section){
            // Create and render and markdown section view
            var sectionView = new PortEditorMdSectionView({
              model: section,
              // applying the PortalSectionModel label attribute
              // to PortEditorMdSectionView
              sectionName: section.get("label")
            });

            // Add markdown section container, insert section HTML
            var markdownSectionDiv = $(document.createElement("div"))
              .addClass("tab-pane")
              .addClass("port-editor-markdown-container")
              .attr("id", sectionView.getName({ linkFriendly: true }))
              .html(sectionView.el);

            //Insert the PortEditorMdSectionView element into this view
            this.$(this.sectionsContainer).append(markdownSectionDiv);

            //Render the PortEditorMdSectionView
            sectionView.render();

            // Add the tab to the tab navigation
            this.addSectionLink(sectionView, ["Rename", "Delete"]);
            // Add the sections to the list of subviews
            this.subviews.push(sectionView);

          }
        }
        catch(e){
          console.error(e);
        }

    },

    /**
    * Renders a Data section in this view
    */
    renderDataSection: function(){

      try{
        // Render a PortEditorDataView and corresponding tab
        var dataView = new PortEditorDataView({
          model: this.model
        });

        //Insert the subview element into this view
        this.$(this.portEditDataViewContainer)
            .html(dataView.el)
            .attr("id", dataView.getName({ linkFriendly: true }));

        //Render the PortEditorDataView
        dataView.render();

        //Create the menu options for the Data section link
        var menuOptions = [];
        if( this.model.get("hideData") === true ){
          menuOptions.push("Show");
        }
        else{
          menuOptions.push("Hide");
        }

        // Add the tab to the tab navigation
        this.addSectionLink(dataView, menuOptions);

        //When the Data section has been hidden or shown, update the section link
        this.stopListening(this.model, "change:hideData");
        this.listenTo(this.model, "change:hideData", function(){
          //Create the menu options for the Data section link
          var menuOptions = [];
          if( this.model.get("hideData") === true ){
            menuOptions.push("Show");
          }
          else{
            menuOptions.push("Hide");
          }

          this.updateSectionLink(dataView, menuOptions);
        });

        // Add the data section to the list of subviews
        this.subviews.push(dataView);
      }
      catch(e){
        console.error(e);
      }
    },

    /**
    * Renders the Metrics section of the editor
    */
    renderMetricsSection: function(){

      // Render a PortEditorSectionView for the Metrics section if metrics is set
      // to show, and the view hasn't already been rendered.
      if(! this.model.get("hideMetrics") === true && !this.metricsView){

        this.metricsView = new PortEditorSectionView({
          model: this.model,
          sectionName: "Metrics",
          template: this.metricsSectionTemplate
        });

        //Add the view's element to the page
        this.$(this.portEditMetricsContainer)
            .html(this.metricsView.el)
            .attr("id", this.metricsView.getName({ linkFriendly: true }));

        //Render the view
        this.metricsView.render();

        // Add the data section to the list of subviews
        this.subviews.push(this.metricsView);

      }

      //When the metrics section has been toggled, remove or add the link
      this.listenToOnce(this.model, "change:hideMetrics", this.renderMetricsSection);
      this.toggleMetricsLink();

    },

    /**
    * Adds or removes the metrics link depending on the 'hideMetrics' option in
    * the model.
    */
    toggleMetricsLink: function(){

      try{
        // Need a metrics view to exist already if metrics is set to show
        if(!this.metricsView && !this.model.get("hideMetrics") === true){
          this.renderMetricsSection();
        }
        //If hideMetrics has been set to true, remove the link
        if( this.model.get("hideMetrics") === true ){
          this.removeSectionLink(this.metricsView);
        // Otherwise add it
        } else {
          this.addSectionLink(this.metricsView, ["Delete"]);
        }
      }
      catch(e){
        console.error(e);
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
      this.$(this.portSettingsContainer)
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

      // reset the flag during each updatePath call
      this.displaySectionInUrl = true;

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

      if (!e && this.activeSection == this.sectionNames[0])
        this.displaySectionInUrl = false;

      var label         = this.model.get("label") || this.newPortalTempName,
          originalLabel = this.model.get("originalLabel") || this.newPortalTempName,
          section       = this.activeSection,
          pathName      = decodeURIComponent(window.location.pathname)
                          .substring(MetacatUI.root.length)
                          // remove trailing forward slash if one exists in path
                          .replace(/\/$/, "");

      // Add or replace the label and section part of the path with updated values.
      // pathRE matches "/label/section", where the "/section" part is optional
      var pathRE = new RegExp("\\/(" + label + "|" + originalLabel + ")(\\/[^\\/]*)?$", "i");
      newPathName = pathName.replace(pathRE, "") + "/" + label;
      newPathName = this.displaySectionInUrl ? newPathName + "/" + section : newPathName;


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
      this.$(this.sectionsContainer).children().each(function(i, tabPane){
        if($(tabPane).attr("id") == sectionName){
          $(tabPane).addClass("active");
        } else {
          // make sure no other sections are active
          $(tabPane).removeClass("active");
        }
      });

      // Activate the tab
      this.$(this.sectionLinksContainer).children().each(function(i, li){
        if($(li).find(".section-link").attr("href") == "#" + sectionName){
          $(li).addClass("active")
        } else {
          // make sure no other sections are active
          $(li).removeClass("active")
        };
      });

      this.updatePath();

      // Update path when each tab is clicked and shown
      view = this;
      this.$('a[data-toggle="tab"]').off('shown');
      this.$('a[data-toggle="tab"]').on('shown', function(e){
        view.updatePath(e)
      });

    },

    /**
    * Add a link to the given editor section
    * @param {PortEditorSectionView} sectionView - The view to add a link to
    * @param {string[]} menuOptions - An array of menu options for this section. e.g. Rename, Delete
    */
    addSectionLink: function(sectionView, menuOptions){

      try{
        var newLink = this.createSectionLink(sectionView, menuOptions);

        // Make the tab hidden to start
        $(newLink)
          .find(this.sectionLinks)
          .css('max-width','0px')
          .css('opacity','0.2')
          .css('white-space', 'nowrap');

        $(newLink)
          .find(".section-menu-link")
          .css('opacity','0.5')
          .css('transition', 'opacity 0.1s');

        // Find the "+" link to help determine the order in which we should add links
        var addSectionEl = this.$(this.sectionLinksContainer)
                               .find(this.sectionLinkContainer + "[data-section-name='AddSection']")[0];

        // If the new link is for a markdown section
        if($(newLink).data("view").type == "PortEditorMdSection"){
          // Find the last markdown section in the list of links
          var currentLinks = this.$(this.sectionLinksContainer).find("li.section-link-container");
          var i = _.map(currentLinks, function(li){
            return $(li).data("view") ? $(li).data("view").type : "";
          }).lastIndexOf("PortEditorMdSection");
          var lastMdSection = currentLinks[i];
          // Append the new link after the last markdown section, or add it first.
          if (lastMdSection){
            $(lastMdSection).after(newLink);
          } else {
            this.$(this.sectionLinksContainer).prepend(newLink);
          }
        // If not a markdown section and not the Settings section, and if there
        // is already a "+" link, add new link before the "+" link
        } else if (addSectionEl && sectionView.getName()!= "Settings"){
          $(addSectionEl).before(newLink);
        // If the new link is "Settings", or there's no "+" link yet, insert new link last.
        } else {
          this.$(this.sectionLinksContainer).append(newLink);
        }

        // Animate the link to full width / opacity
        $(newLink).find(this.sectionLinks).animate({
            'max-width': "500px",
            overflow: "hidden",
            opacity: 1
          }, {
          duration: 300,
          complete: function(){
            $(newLink)
              .find(".section-menu-link")
              .css('opacity','1')
          }
        });
      }
      catch(e) {
        console.error("Could not add a new section link. Error message: "+ e);
      }

    },

    /**
    * Add a link to the given editor section
    * @param {PortEditorSectionView} sectionView - The view to add a link to
    * @param {string[]} menuOptions - An array of menu options for this section. e.g. Rename, Delete
    * @return {Element}
    */
    createSectionLink: function(sectionView, menuOptions){

      //Create a section link
      var sectionLink = $(this.sectionLinkTemplate({
        href: "#" + sectionView.getName({ linkFriendly: true }),
        sectionName: sectionView.getName(),
        menuOptions: menuOptions || []
      }));

      //Attach the section model to the link
      sectionLink.data({
        model: sectionView.model,
        view:  sectionView
      });

      return sectionLink[0];
    },

    /**
    * Add a link to the given editor section
    * @param {PortEditorSectionView} sectionView - The view to add a link to
    * @param {string[]} menuOptions - An array of menu options for this section. e.g. Rename, Delete
    */
    updateSectionLink: function(sectionView, menuOptions){

      //Create a new link to the section
      var sectionLink = this.createSectionLink(sectionView, menuOptions);

      //Replace the existing link
      this.$(this.sectionLinksContainer).children().each(function(i, link){
        if( $(link).data("view") == sectionView ){
          $(link).replaceWith(sectionLink);
        }
      });
    },

    /**
    * Remove the link to the given section view
    * @param {View} sectionView - The view to remove the link to
    */
    removeSectionLink: function(sectionView){

      // Switch to the default section the user is deleting the active section
      if (sectionView.getName({ linkFriendly: true }) == this.activeSection){
        this.switchSection("AddSection");
      };

      try{
        //Find the section link associated with this section view
        this.$(this.sectionLinksContainer).children().each(function(i, link){
          if( $(link).data("view") == sectionView ){

            //Remove the menu link
            $(link).find(".section-menu-link").remove();
            //Hide the section name link with an animation
            $(link).animate({width: "0px", overflow: "hidden"}, {
              duration: 300,
              complete: function(){
                this.remove();
              }
            });
          }
        });
      }
      catch(e){
        console.error(e);
      }
    },

    /**
    * Adds a section and tab to this view and the PortalModel
    * @param {string} sectionType - The type of section to add
    */
    addSection: function(sectionType){

      try{

        this.model.addSection(sectionType);

        if(typeof sectionType == "string"){

          switch( sectionType.toLowerCase() ){
            case "data":
              // TODO ?
              break;
            case "metrics":
              this.switchSection("Metrics");
              break;
            case "freeform":
            // Do nothing, everything is handled by renderContentSection
            // and renderContentSections. Can't switch section here because
            // for content sections, the section.label is variable.
            case "members":
              // TODO
              // this.switchSection("Members");
              break;
          }

        }
        else{
          return;
        }
      }
      catch(e){
        console.error(e);
      }
    },

    /**
    * Removes a section and its tab from this view and the PortalModel
    * @param {Event} [e] - (optional) The click event on the Remove button
    */
    removeSection: function(e){

      try{

        //Get the PortalSection model for this remove button
        var sectionLink = $(e.target).parents(this.sectionLinkContainer),
            section = sectionLink.data("model");

        //If this section is not a PortalSection model, get the section name
        if( !PortalSection.prototype.isPrototypeOf(section) ){
          section = sectionLink.data("section-name");
        }
        // Processing for markdown sections
        else {
          this.stopListening(this.model, "change:sections");

          // listening to PortalModel to remove the PortalSectionModel object
          this.listenToOnce(this.model, "change:sections", function() {
            try {
              // check for the matching model (section),
              // and retrieve the corresponding sectionView
              // from the subviews object
              var sectionView = this.subviews.find(
                obj => {
                  return obj.model === section;
                }
              );

              // remove the sectionView
              this.removeSectionLink(sectionView);

            } catch (error) {
              console.error(error);
            }
          });
        }

        //If no section was found, exit now
        if( !section ){
          return;
        }

        //Remove this section from the Portal
        this.model.removeSection(section);
      }
      catch(e){
        console.error(e);
        MetacatUI.appView.showAlert("The section could not be deleted. (" + e.message + ")", "alert-error");
      }

    },

    /**
    * Shows a previously-hidden section
    * @param {Event} [e] - (optional) The click event on the Show button
    */
    showSection: function(e){

      try{

        //Get the PortalSection model for this show button
        var sectionLink = $(e.target).parents(this.sectionLinkContainer),
            section = sectionLink.data("model");

        //If this section is not a PortalSection model, get the section name
        if( !PortalSection.prototype.isPrototypeOf(section) ){
          section = sectionLink.data("section-name");
        }

        //If no section was found, exit now
        if( !section ){
          return;
        }

        //Mark this section as shown
        this.model.addSection(section);
      }
      catch(e){
        console.error(e);
        MetacatUI.appView.showAlert("The section could not be shown. (" + e.message + ")", "alert-error");
      }

    },

    /**
    * Renames a section in the tab in this view and in the PortalSectionModel
    * @param {Event} [e] - (optional) The click event on the Rename button
    */
    renameSection: function(e){
      try {
        //Get the PortalSection model for this rename button
        var sectionLink = $(e.target).parents(this.sectionLinkContainer),
            targetLink = sectionLink.children(this.sectionLinks),
            section = sectionLink.data("model");

        // make the text editable
        targetLink.attr("contenteditable", true);

        // add focus to the text
        targetLink.focus();

        //Select the text of the link
        if (window.getSelection && window.document.createRange) {
            var selection = window.getSelection();
            var range = window.document.createRange();
            range.selectNodeContents( targetLink[0] );
            selection.removeAllRanges();
            selection.addRange(range);
        } else if (window.document.body.createTextRange) {
            range = window.document.body.createTextRange();
            range.moveToElementText( targetLink[0] );
            range.select();
        }

      } catch (error) {
        console.error(error);
      }

    },

    /**
     * Update the section label
     *
     * @function updateName
     * @param e The event triggering this method
     */
    updateName: function(e) {
      try {
        //Get the PortalSection model for this rename button
        var sectionLink = $(e.target).parents(this.sectionLinkContainer),
            targetLink = sectionLink.find(this.sectionLinks),
            section = sectionLink.data("model");

        // Remove the content editable attribute
        targetLink.attr("contenteditable", false);

        //If this section is an object of PortalSection model, update the label.
        if( section && PortalSection.prototype.isPrototypeOf(section) ){
          // update the label
          section.set("label", targetLink.text().trim());
        }
        else {
          // TODO: handle the case for non-markdown secions
        }

      } catch (error) {
        console.error(error);
      }
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
