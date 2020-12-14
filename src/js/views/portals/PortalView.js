define(["jquery",
        "underscore",
        "backbone",
        "models/portals/PortalModel",
        "models/UserModel",
        "text!templates/alert.html",
        "text!templates/loading.html",
        "text!templates/portals/portal.html",
        "text!templates/portals/editPortals.html",
        "views/portals/PortalHeaderView",
        "views/portals/PortalDataView",
        "views/portals/PortalSectionView",
        "views/portals/PortalMetricsView",
        "views/portals/PortalMembersView",
        "views/portals/PortalLogosView",
        "views/portals/PortalVisualizationsView",
        "views/SignInView",
    ],
    function($, _, Backbone, Portal, User, AlertTemplate, LoadingTemplate, PortalTemplate, EditPortalsTemplate, PortalHeaderView,
        PortalDataView, PortalSectionView, PortalMetricsView, PortalMembersView, PortalLogosView, PortalVisualizationsView, SignInView) {
        "use_strict";

        /**
        * @class PortalView
        * @classdesc The PortalView is a generic view to render
         * portals, it will hold portal sections
         * @classcategory Views/Portals
         * @extends Backbone.View
         * @constructor
         */
        var PortalView = Backbone.View.extend(
            /** @lends PortalView.prototype */{

            /**
             * The Portal element
             * @type {string}
             */
            el: "#Content",

            /**
             * The type of View this is
             * @type {string}
             */
            type: "Portal",

            /**
             * The currently active section view
             * @type {PortalSectionView}
             */
            activeSection: undefined,

            /**
            * The currently active section label. e.g. Data, Metrics, Settings, etc.
            * @type {string}
            */
            activeSectionLabel: "",

            /**
             * The names of all sections in this portal editor
             * @type {Array}
             */
            sectionNames: [],

            /**
             * The seriesId of the portal document
             * @type {string}
             */
            portalId: "",

            /**
             * The unique short name of the portal
             * @type {string}
             */
            label: "",

            /**
            * Flag to add section name to URL. Enabled by default.
            * @type {boolean}
            */
            displaySectionInUrl: true,

            /**
             * The subviews contained within this view to be removed with onClose
             * @type {Array}
             */
            subviews: new Array(), // Could be a literal object {} */

            /**
             * A Portal Model is associated with this view and gets created during render()
             * @type {Portal}
             */
            model: null,

            /**
             * A User Model is associated with this view for rendering node/user views
             * @type {User}
             */
            userModel: null,

            /* Renders the compiled template into HTML */
            template: _.template(PortalTemplate),
            //A template to display a notification message
            alertTemplate: _.template(AlertTemplate),
            //A template for displaying a loading message
            loadingTemplate: _.template(LoadingTemplate),
            // Template for the 'edit portal' button
            editPortalsTemplate: _.template(EditPortalsTemplate),

            /**
            * A jQuery selector for the element that a single section link will be inserted into
            * @type {string}
            */
            sectionLinkContainer: ".section-link-container",
            /**
            * A jQuery selector for the elements that are links to the individual sections
            * @type {string}
            */
            sectionLinks: ".portal-section-link",
            /**
            * A jQuery selector for the section elements
            * @type {string}
            */
            sectionEls: ".portal-section-view",
            /**
            * A jQuery selection for the element that will contain the Edit button.
            * @type {string}
            * @since 2.14.0
            */
            editButtonContainer: ".edit-portal-link-container",
            /**
             * The events this view will listen to and the associated function to call.
             * @type {Object}
             */
            events: {
              "click .portal-section-link"   : "handleSwitchSection",
              "click .section-links-container" : "toggleSectionLinks"
            },

            /**
             * Is executed when a new PortalView is created
             */
            initialize: function(options) {
                // Set the current PortalView properties
                this.portalId = options.portalId ? options.portalId : undefined;
                this.model = options.model ? options.model : undefined;
                this.nodeView = options.nodeView ? options.nodeView : undefined;
                this.label = options.label ? options.label : undefined;
                this.activeSection = options.activeSection ? options.activeSection : undefined;
                this.activeSectionLabel = options.activeSectionLabel ? options.activeSectionLabel : undefined;
            },

            /**
             * Initial render of the PortalView
             *
             * @return {PortalView} Returns itself for easy function stacking in the app
             */
            render: function() {

                var view = this;

                //Make sure the subviews array is reset
                this.subviews = new Array();

                // Add the overall class immediately so the navbar is styled correctly right away
                $("body").addClass("PortalView");

                this.$el.html(this.loadingTemplate({
                  msg: "Loading..."
                }));

                //Perform specific label checks
                if (!MetacatUI.nodeModel.get("checked")) {
                  this.listenToOnce(MetacatUI.nodeModel, "change:checked", function(){
                    // perform node checks
                    if(view.isNode(view.label)){
                      view.nodeView = true;
                      view.renderAsNode();
                    }
                    else {
                      view.nodeView = false;
                      view.renderAsPortal();
                    }
                  });

                  this.listenToOnce(MetacatUI.nodeModel, "error", function(){
                    this.showError(null, "Couldn't get the DataONE Node info document");
                  });
                }
                else if( MetacatUI.nodeModel.get("error") ){
                  this.showError(null, "Couldn't get the DataONE Node info document");
                }
                else if( this.isNode(this.label) ){
                  this.nodeView = true;
                  this.renderAsNode();
                }
                else if( !this.isNode(this.label) ){
                  this.nodeView = false;
                  this.renderAsPortal();
                }

                return this;
            },

            /**
             * Entry point for portal rendering
             */
            renderAsPortal: function(){

              // At this point we know that the given label is not a
              // repository short identifier

              // Create a new Portal model
              if (this.model === undefined || this.model === null) {
                this.model = new Portal({
                  seriesId: this.portalId,
                  label: this.label
                });
              }

              // When the model has been synced, render the results
              this.stopListening();
              this.listenToOnce(this.model, "sync", this.renderPortal);

              //If the portal isn't found, display a 404 message
              this.listenTo(this.model, "notFound", this.handleNotFound);

              //Listen to errors that might occur during fetch()
              this.listenToOnce(this.model, "error", this.showError);

              //Fetch the model
              this.model.fetch({ objectOnly: true });

            },

            /**
             * Entry point for a repository portal view
             * At this point we know for sure that a given label/username is a repository user
             */
            renderAsNode:function(){
              var view = this;

              //Create a UserModel with the username given
              this.userModel = new User({
                username: view.label
              });
              this.userModel.saveAsNode();
              // get the node Info
              var nodeInfo =  _.find(MetacatUI.nodeModel.get("members"), function(nodeModel) {
                return nodeModel.identifier.toLowerCase() == "urn:node:" + view.label.toLowerCase();
                });
              this.nodeInfo = nodeInfo;
              this.nodeName = this.nodeInfo.name;
              this.portalId = this.nodeInfo.identifier;

              // create a portal model for repository
              this.model = new Portal({
                seriesId: this.portalId,
                label: view.label
              });

              // remove the members section directly from the model
              this.model.removeSection("members");

              this.model.createNodeAttributes(this.nodeInfo);

              //Setting the repo specific statsModel
              var statsSearchModel = this.userModel.get("searchModel").clone();
              statsSearchModel.set("exclude", [], {silent: true}).set("formatType", [], {silent: true});
              MetacatUI.statsModel.set("query", statsSearchModel.getQuery());
              MetacatUI.statsModel.set("searchModel", statsSearchModel);

              if( _.contains(MetacatUI.appModel.get("dataoneHostedRepos"), this.nodeInfo.identifier) ){
                MetacatUI.statsModel.set("mdqImageId", this.nodeInfo.identifier);
              }

              // render repository view as portal view
              this.renderPortal();
            },

            /**
             * Render the Portal view
             */
            renderPortal: function() {

              // Getting the correct portal label and seriesID
              this.label = this.model.get("label");
              this.portalId = this.model.get("seriesId");

              // Remove the listeners that were set during the fetch() process
              this.stopListening(this.model, "notFound", this.handleNotFound);
              this.stopListening(this.model, "error", this.showError);

              //If this is in DataONE Plus Preview Mode, check that the portal is
              // a Plus portal before rendering. Member Node portals are always displayed.
              if( MetacatUI.appModel.get("dataonePlusPreviewMode") && !this.nodeView){
                var sourceMN = this.model.get("datasource");

                //Check if the portal source node is from the active alt repo OR is
                // configured as a Plus portal.
                if( typeof sourceMN != "string" ||
                    (sourceMN != MetacatUI.appModel.get("defaultAlternateRepositoryId") &&
                    !_.findWhere(MetacatUI.appModel.get("dataonePlusPreviewPortals"),
                                 { datasource: sourceMN, seriesId: this.model.get("seriesId") })) ){

                    //Get the name of the source member node
                    var sourceMNName = "original data repository",
                        mnURL        = "";
                    if( typeof sourceMN == "string" ){
                      var sourceMNObject = MetacatUI.nodeModel.getMember(sourceMN);
                      if( sourceMNObject ){
                        sourceMNName = sourceMNObject.name;

                        //If there is a baseURL string
                        if( sourceMNObject.baseURL ){
                          //Parse out the origin of the baseURL string. We want to crop out the /metacat/d1/mn parts.
                          mnURL = sourceMNObject.baseURL.substring(0, sourceMNObject.baseURL.lastIndexOf(".")) +
                                  sourceMNObject.baseURL.substring(sourceMNObject.baseURL.lastIndexOf("."),
                                                                   sourceMNObject.baseURL.indexOf("/", sourceMNObject.baseURL.lastIndexOf(".")));
                        }
                      }
                    }

                    //Show a message that the portal can be found on the repository website.
                    var message = $(document.createElement("h3")).addClass("center stripe");
                    message.text("The " + this.model.get("name") + " " + MetacatUI.appModel.get("portalTermSingular") +
                              " can be viewed in the ");

                    if(mnURL){
                      message.append( $(document.createElement("a"))
                                        .attr("href", mnURL)
                                        .attr("target", "_blank")
                                        .text(sourceMNName) );
                    }
                    else{
                      message.append(sourceMNName);
                    }

                    this.$el.html(message);

                    return;
                }
              }

                // Insert the overall portal template
                this.$el.html(this.template(this.model.toJSON()));

                // Render the header view
                this.headerView = new PortalHeaderView({
                    model: this.model,
                    nodeView: this.nodeView
                });
                this.headerView.render();
                this.subviews.push(this.headerView);

                // only displaying the edit button for non-repository profiles
                if (!this.nodeView){
                  // Add edit button if user is authorized
                  this.insertOwnerControls();
                }

                // Render the content sections
                _.each(this.model.get("sections"), function(section){
                  this.addSection(section);
                }, this);

                // Render the Data section
                if( this.model.get("hideData") !== true ) {
                    this.sectionDataView = new PortalDataView({
                        model: this.model,
                        sectionName: "Data",
                        id: "Data",
                        nodeView: this.nodeView
                    });
                    this.subviews.push(this.sectionDataView);

                    this.$("#portal-sections").append(this.sectionDataView.el);

                    //Render the section view and add it to the page
                    this.sectionDataView.render();

                    this.addSectionLink( this.sectionDataView );
                }

                //Render the metrics section link
                if ( this.model.get("hideMetrics") !== true ) {

                  //Create a PortalMetricsView
                  this.metricsView = new PortalMetricsView({
                    model: this.model,
                    id: this.model.get("metricsLabel"),
                    uniqueSectionName: this.model.get("metricsLabel"),
                    nodeView: this.nodeView,
                    nodeName: this.nodeName
                  });

                  this.subviews.push(this.metricsView);
                  this.$("#portal-sections").append(this.metricsView.el);

                  this.metricsView.render();

                  this.addSectionLink( this.metricsView );

                }

                // Render the members section
                if ( this.model.get("hideMembers") !== true &&
                     (this.model.get("associatedParties").length || this.model.get("acknowledgments"))){

                    this.sectionMembersView = new PortalMembersView({
                        model: this.model,
                        id: "Members",
                        sectionName: "Members"
                    });
                    this.subviews.push(this.sectionMembersView);

                    this.$("#portal-sections").append(this.sectionMembersView.el);

                    //Render the section view and add it to the page
                    this.sectionMembersView.render();

                    this.addSectionLink( this.sectionMembersView );
                }

                // Render the logos at the bottom of the portal page
                var ackLogos = this.model.get("acknowledgmentsLogos") || [];
                if( ackLogos.length ){
                  this.logosView = new PortalLogosView();
                  this.logosView.logos = ackLogos;
                  this.subviews.push(this.logosView);
                  this.logosView.render();
                  this.$(".portal-view").append(this.logosView.el);
                }

                // Re-order the section tabs according the the portal editor's preference,
                // if one has been set
                try {
                  var pageOrder = this.model.get("pageOrder");
                  if(pageOrder && pageOrder.length){
                    var linksContainer = this.el.querySelector("#portal-section-tabs"),
                        sortableLinks = this.el.querySelectorAll("#portal-section-tabs .section-link-container"),
                        sortableLinksArray = Array.prototype.slice.call(sortableLinks, 0);
                    // sort the links according the pageOrder
                    sortableLinksArray.sort(function(a,b){
                      var aName = $(a).text();
                      var bName = $(b).text();
                      var aIndex = pageOrder.indexOf(aName);
                      var bIndex = pageOrder.indexOf(bName);
                      // If the label can't be found in the list of labels, place it at the end
                      if(bIndex === -1){
                        return +1
                      }
                      if(aIndex === -1){
                        return -1
                      }
                      // Sort backwards, because we use preprend
                      return bIndex - aIndex;
                    })
                    // Rearrange the links in the DOM
                    for (i = 0; i < sortableLinksArray.length; ++i) {
                      linksContainer.prepend(sortableLinksArray[i]);
                    }
                  }
                } catch (error) {
                  console.log("Error re-arranging tabs according to the pageOrder option. Error message: " + error)
                }

                //Switch to the active section
                this.switchSection();
                
                //Scroll to an inner-page link if there is one specified
                if( window.location.hash && this.$(window.location.hash).length ){
                  MetacatUI.appView.scrollTo(this.$(window.location.hash));
                }

                // Save reference to this view
                var view = this;

                // On mobile, hide section tabs a moment after page loads so
                // users notice where they are
                setTimeout(function () {
                  view.toggleSectionLinks();
                }, 700);

                // On mobile where the section-links-container is set to fixed,
                // hide the portal navigation element when user scrolls down,
                // show again when the user scrolls up.
                MetacatUI.appView.prevScrollpos = window.pageYOffset;
                $(window).on("scroll", "", undefined, this.handleScroll);

            },

            /**
             * toggleSectionLinks - show or hide the section links nav. Used for
             * mobile/small screens only.
             */
            toggleSectionLinks: function(){
              try{
                // Only toggle the section links on mobile. On mobile, the
                // ".show-sections-toggle" is visible.
                if(this.$(".show-sections-toggle").is(":visible")){
                  this.$("#portal-section-tabs").slideToggle();
                }
              } catch(e){
                console.log("Failed to toggle section links, error message: " + e);
              }
            },

            /*
             * Checks the authority for the logged in user for this portal and
             * inserts control elements onto the page for the user to interact
             * with the portal. So far, this is just an 'edit portal' button.
             */
            insertOwnerControls: function(){

              // Insert the button into the navbar
              var container = $(this.editButtonContainer);

              var model = this.model;

              this.listenToOnce(this.model, "change:isAuthorized", function(){
                if(!model.get("isAuthorized")){
                  return false;
                } else {
                  container.html(
                    this.editPortalsTemplate({
                      editButtonText: "Edit " + MetacatUI.appModel.get('portalTermSingular'),
                      pathToEdit: MetacatUI.root + "/edit/"+ MetacatUI.appModel.get("portalTermPlural") +"/" + model.get("label")
                    })
                  );
                }
              });

              this.model.checkAuthority("write");
            },

            /**
             * Update the window location path with the active section name
             * @param {boolean} [showSectionLabel] - If true, the section label will be added to the path
            */
            updatePath: function(showSectionLabel){

              var label         = this.model.get("label") || this.newPortalTempName,
                  originalLabel = this.model.get("originalLabel") || this.newPortalTempName,
                  pathName      = decodeURIComponent(window.location.pathname)
                                  .substring(MetacatUI.root.length)
                                  // remove trailing forward slash if one exists in path
                                  .replace(/\/$/, "");

              // Add or replace the label and section part of the path with updated values.
              // pathRE matches "/label/section", where the "/section" part is optional
              var pathRE = new RegExp("\\/(" + label + "|" + originalLabel + ")(\\/[^\\/]*)?$", "i");
              newPathName = pathName.replace(pathRE, "") + "/" + label;

              if( showSectionLabel && this.activeSection ){
                newPathName += "/" + this.activeSection.uniqueSectionLabel;
              }

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
              this.sectionNames = sectionNames
            },

            /**
            * Manually switch to a section subview by making the tab and tab panel active.
            * Navigation between sections is usually handled automatically by the Bootstrap
            * library, but a manual switch may be necessary sometimes
            * @param {PortalSectionView} [sectionView] - The section view to switch to. If not given, defaults to the activeSection set on the view.
            */
            switchSection: function(sectionView){

              //Create a flag for whether the section label should be shown in the URL
              var showSectionLabelInURL = true;

              // If no section view is given, use the active section in the view.
              if( !sectionView ){
                //Use the sectionView set already
                if( this.activeSection ){
                  var sectionView = this.activeSection;
                }
                //Or find the section view by name, which may have been passed through the URL
                else if( this.activeSectionLabel ){
                  var sectionView = this.getSectionByLabel(this.activeSectionLabel);
                }
              }

              //If no section view was indicated, just default to the first visible one
              if( !sectionView ){
                var sectionView = this.$(this.sectionLinkContainer).first().data("view");

                //If we are defaulting to the first section, don't show the section label in the URL
                showSectionLabelInURL = false;

                //If there are no section views on the page at all, exit now
                if( !sectionView ){
                  return;
                }
              }

              // Update the activeSection set on the view
              this.activeSection = sectionView;


              // Activate the section content
              this.$(this.sectionEls).each(function(i, contentEl){
                if($(contentEl).data("view") == sectionView){
                  $(contentEl).addClass("active");
                } else {
                  // make sure no other sections are active
                  $(contentEl).removeClass("active");
                }
              });

              // Activate the link to the content
              this.$(this.sectionLinkContainer).each(function(i, linkEl){
                if( $(linkEl).data("view") == sectionView ){
                  $(linkEl).addClass("active")
                } else {
                  // make sure no other sections are active
                  $(linkEl).removeClass("active")
                };
              });

              //If the section view has post-render functionality, execute it now
              if( typeof sectionView.postRender == "function" ){
                sectionView.postRender();
              }

              if (!this.nodeView) {
                //Update the location path with the new section name
                this.updatePath(showSectionLabelInURL);
              }


            },

            /**
            * When a section link has been clicked, switch to that section
            * @param {Event} e - The click event on the section link
            */
            handleSwitchSection: function(e){

              e.preventDefault();

              var sectionView = $(e.target).parents(this.sectionLinkContainer).first().data("view");

              if( sectionView ){
                this.switchSection(sectionView);

                // If the user clicks a link and is not near the top of the page
                // (i.e. on mobile), scroll to the top of the section content.
                // Otherwise it might look like the page hasn't changed (e.g.
                // when focus is on the footer)
                if(window.pageYOffset > this.$("#portal-sections").offset().top){
                  MetacatUI.appView.scrollTo(this.$("#portal-sections"));
                }

              }

            },

            /**
            * Returns the section view that has a label matching the one given.
            * @param {string} label - The label for the section
            * @return {PortalSectionView|false} - Returns false if a matching section view isn't found
            */
            getSectionByLabel: function(label){

              //If no label is given, exit
              if(!label){
                return;
              }

              //Find the section view whose unique label matches the given label. Case-insensitive matching.
              return _.find( this.subviews, function(view){
                if( typeof view.uniqueSectionLabel == "string" ){
                  return view.uniqueSectionLabel.toLowerCase() == label.toLowerCase();
                }
                else{
                  return false;
                }
              });
            },

            /**
            * Creates and returns a unique label for the given section. This label is just used in the view,
            * because portal sections can have duplicate labels. But unique labels need to be used for navigation in the view.
            * @param {PortEditorSection} sectionModel - The section for which to create a unique label
            * @return {string} The unique label string
            */
            getUniqueSectionLabel: function(sectionModel){
              //Get the label for this section
              var sectionLabel = sectionModel.get("label").replace(/[^a-zA-Z0-9 ]/g, "").replace(/ /g, "-"),
                  unalteredLabel = sectionLabel,
                  sectionLabels = this.sectionLabels || [],
                  i = 2;

              //Concatenate a number to the label if this one already exists
              while( sectionLabels.includes(sectionLabel) ){
                sectionLabel = unalteredLabel + i;
                i++;
              }

              return sectionLabel;
            },

            /**
             * Creates a PortalSectionView to display the content in the given portal
             * section. Also creates a navigation link to the section.
             *
             * @param {PortalSectionModel} sectionModel - The section to render in this view
             */
            addSection: function(sectionModel){

              //If this is a visualization Section, render it differently with PortalVizSectionView
              if( sectionModel.get("sectionType") == "visualization" ){
                this.addVizSection(sectionModel);
                return;
              }
              //All other portal section types are rendered with the basic PortalSectionView
              else{
                //Create a new PortalSectionView
                var sectionView = new PortalSectionView({
                  model: sectionModel
                });

                //Render the section
                sectionView.render();

                //Add the section view to this portal view
                this.$("#portal-sections").append(sectionView.el);

                this.addSectionLink( sectionView );

                //Create a unique label for this section and save it
                var uniqueLabel = this.getUniqueSectionLabel(sectionModel);
                //Set the unique section label for this view
                sectionView.uniqueSectionLabel = uniqueLabel;

                this.subviews.push(sectionView);
              }

            },

            /**
             * Creates a PortalSectionView to display the content in the given portal
             * section. Also creates a navigation link to the section.
             * @param {PortalVizSectionModel} sectionModel - The visualization section to render in this view
             *
             */
            addVizSection: function(sectionModel){

              //Create a new PortalSectionView
              var sectionView = new PortalVisualizationsView({
                model: sectionModel
              });

              //Render the section
              sectionView.render();

              //Add the section view to this portal view
              this.$("#portal-sections").append(sectionView.el);

              this.addSectionLink( sectionView );

              //Create a unique label for this section and save it
              var uniqueLabel = this.getUniqueSectionLabel(sectionModel);

              //Set the unique section label for this view
              sectionView.uniqueSectionLabel = uniqueLabel;

              this.subviews.push(sectionView);

            },

            /**
             * Add a link to a section of this portal page
             * @param {PortalSectionView} sectionView - The view to add a link to
             */
            addSectionLink: function(sectionView){

              var label = sectionView.getName();
              var hrefLabel = sectionView.getName({ linkFriendly: true });

              //Create a navigation link
              this.$("#portal-section-tabs").append(
                $(document.createElement("li"))
                  .addClass("section-link-container")
                  .data("view", sectionView)
                  .append( $(document.createElement("a"))
                             .text(label)
                             .attr("href", "#" + hrefLabel )
                             .attr("data-toggle", "tab")
                             .addClass("portal-section-link")
                             .data("view", sectionView)));

            },

            /**
            * Handles the case where the PortalModel is fetched and nothing is found.
            */
            handleNotFound: function(){

              var view = this;

              //If the user is NOT logged in OR
              // if the user is logged in, and the last fetch was done with user credentials, then this Portal is either not accessible or non-existent
              if( MetacatUI.appUserModel.get("checked") && !MetacatUI.appUserModel.get("loggedIn") ||
                  (MetacatUI.appUserModel.get("checked") && MetacatUI.appUserModel.get("loggedIn") && this.model.get("fetchedWithAuth")) ){

                //Check if there is an indexing queue, because this model may still be indexing
                var onError = function(){
                    //If the request to the monitor/status API fails, then show the not-found message
                    view.showNotFound.call(view);
                  },
                  onSuccess = function(sizeOfQueue){

                    if( sizeOfQueue > 0 ){
                      //Show a warning message about the index queue
                      MetacatUI.appView.showAlert(
                        "<p>We couldn't find a data portal named \" <span id='portal-view-not-found-name'></span>" +
                          "\".</p><p><i class='icon icon-exclamation-sign'></i> If this portal was created in the last few minutes, it may still be processing, since there are currently <b>" + sizeOfQueue +
                          "</b> submissions in the queue.</p>",
                        "alert-warning",
                        view.$el
                      );
                      view.$(".loading").remove();

                      view.$("#portal-view-not-found-name").text(view.label || view.portalId);
                    }
                    else{
                      //If the size of the queue is 0, then show the not-found message
                      view.showNotFound.call(view);
                    }

                  }

                //Get the size of the index queue
                MetacatUI.appLookupModel.getSizeOfIndexQueue(onSuccess, onError);

              }
              //If the user IS logged in and we haven't fetched the model with user authentication yet
              else if( MetacatUI.appUserModel.get("checked") && MetacatUI.appUserModel.get("loggedIn") ){
                //Fetch again now that the user is logged in
                this.model.fetch();
              }
              //If the user login status is unknown, because authentication is still pending
              else if( !MetacatUI.appUserModel.get("checked") ){
                //Wait for the authentication to be checked, and then start this function over again
                this.listenToOnce(MetacatUI.appUserModel, "change:checked", this.handleNotFound);
              }

            },

            /**
             * If the given portal doesn't exist, display a Not Found message.
             */
            showNotFound: function(){

              var notFoundMessage = "The data portal \"<span id='portal-view-not-found-name'></span>" +
                                    "\" doesn't exist.",
                  notification = this.alertTemplate({
                    classes: "alert-error",
                    msg: notFoundMessage,
                    includeEmail: true
                  });

              this.$el.html(notification);

              this.$("#portal-view-not-found-name").text(this.label || this.portalId);

            },

            /**
            * Show an error message in this view
            * @param {SolrResult} model
            * @param {XMLHttpRequest.response|string} reponse
            */
            showError: function(model, response){

              try {
                var errorMsg = "",
                  errorClass = "alert-error",
                  icon = "frown",
                  portalTerm = MetacatUI.appModel.get("portalTermSingular") || "portal",
                  errorTitle = "Something went wrong displaying this " + portalTerm + ".";

                // For errors resulting from authorization errors, use a friendlier and more
                // helpful error message than the default message returned from fetch
                if(response && response.status == 401){
                  errorTitle = 'You need permission to view this ' + portalTerm + ".";
                  errorClass = "alert-info";
                  icon = "lock"
                  // Make a suggestion of how to fix the error based on whether the user is logged in or not.
                  if(!MetacatUI.appUserModel.get("loggedIn")){
                    // If not logged in, suggest that the user signs in
                    errorMsg = '<strong><a href="' +
                      MetacatUI.appModel.get('signInUrlOrcid') + window.location.href +
                      '">Sign in</a></strong> to see if you have already been given access to view this ' +
                      portalTerm +'.';
                  } else {
                    // If signed in, suggest that the user contacts that portal owner
                    errorMsg = "Contact the owner of this " + portalTerm + " to request access."
                  }
                // For all other types of errors
                } else {
                  if( response && response.responseText ){
                    errorMsg = "Error details: " + $(response.responseText).text();
                  }
                  if( typeof response == "string" ){
                    errorMsg = "Error details: " + response;
                  }
                }

                if(errorMsg){
                  errorMsg = "<p>" + errorMsg + "</p>"
                }

                //Show the error message
                MetacatUI.appView.showAlert(
                  "<h4><i class='icon icon-" + icon +"'></i>" + errorTitle + "</h4>" + errorMsg,
                  errorClass + " portal-alert-container",
                  this.$el,
                  0,
                  { includeEmail: true }
                );

                //Remove the loading message from this view
                this.$el.find(".loading").remove();
              } catch (error) {
                console.log("There was a problem trying to display the error message in the Portal View. Error details:" + error);
              }

            },

            /**
            * This function is called whenever the window is scrolled.
            */
            handleScroll: function() {
              var menu = $(".section-links-container")[0],
                  menuHeight = $(menu).height(),
                  hiddenHeight = (menuHeight * -1);
              var currentScrollPos = window.pageYOffset;
              if(MetacatUI.appView.prevScrollpos > currentScrollPos) {
                //Get the height of any menu that may be displayed at the bottom of the page, too

                menu.style.bottom = "0px";
              } else {
                menu.style.bottom = hiddenHeight +"px";
              }
              MetacatUI.appView.prevScrollpos = currentScrollPos;
            },

            /**
             * This function is called when the app navigates away from this view.
             * Any clean-up or housekeeping happens at this time.
             */
            onClose: function() {
                //Remove each subview from the DOM and remove listeners
                _.invoke(this.subviews, "remove");

                this.subviews = new Array();

                //Remove all listeners
                this.stopListening();

                //Reset the active alternate repository
                //MetacatUI.appModel.set("activeAlternateRepositoryId", null);

                //Delete the metrics view from this view
                delete this.sectionMetricsView;
                //Delete the model from this view
                delete this.model;

                //Remove the scroll listener
                $(window).off("scroll", "", this.handleScroll);

                $("body").removeClass("PortalView");

                $("#editPortal").remove();

                this.undelegateEvents();
            },

            // checks if the label is a repository
            isNode: function(username){

              if (username === undefined){
                this.showNotFound();
                return;
              }
              var model = this;
              var node = _.find(MetacatUI.nodeModel.get("members"), function(nodeModel) {
                  return nodeModel.shortIdentifier.toLowerCase() == (username).toLowerCase();
                });

              return (node && (node !== undefined))
            }
        });

        return PortalView;
    });
