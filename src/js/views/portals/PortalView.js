define(["jquery",
        "underscore",
        "backbone",
        "models/portals/PortalModel",
        "models/Search",
        "models/Stats",
        "text!templates/alert.html",
        "text!templates/loading.html",
        "text!templates/portals/portal.html",
        "text!templates/portals/editPortals.html",
        "views/portals/PortalHeaderView",
        "views/portals/PortalDataView",
        "views/portals/PortalSectionView",
        "views/portals/PortalMembersView",
        "views/StatsView",
        "views/portals/PortalLogosView"
    ],
    function($, _, Backbone, Portal, SearchModel, StatsModel, AlertTemplate, LoadingTemplate, PortalTemplate, EditPortalsTemplate, PortalHeaderView,
        PortalDataView, PortalSectionView, PortalMembersView, StatsView, PortalLogosView) {
        "use_strict";
        /* The PortalView is a generic view to render
         * portals, it will hold portal sections
         */
        var PortalView = Backbone.View.extend({

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

            /* Renders the compiled template into HTML */
            template: _.template(PortalTemplate),
            //A template to display a notification message
            alertTemplate: _.template(AlertTemplate),
            //A template for displaying a loading message
            loadingTemplate: _.template(LoadingTemplate),
            // Template for the 'edit portal' button
            editPortalsTemplate: _.template(EditPortalsTemplate),

            /**
             * The events this view will listen to and the associated function to call.
             * @type {Object}
             */
            events: {
              "click #metrics-link" : "renderMetricsView"
            },

            /**
             * Creates a new PortalView
             * @constructs PortalView
             */
            initialize: function(options) {
                // Set the current PortalView properties
                this.portalId = options.portalId ? options.portalId : undefined;
                this.label = options.label ? options.label : undefined;
                this.activeSection = options.activeSection ? options.activeSection : undefined;
            },

            /**
             * Initial render of the PortalView
             *
             * @return {PortalView} Returns itself for easy function stacking in the app
             */
            render: function() {

                $("body").addClass("PortalView");

                this.$el.html(this.loadingTemplate({
                  msg: "Loading..."
                }));

                // Create a new Portal model
                this.model = new Portal({
                    seriesId: this.portalId,
                    label: this.label
                });

                // When the model has been synced, render the results
                this.stopListening();
                this.listenToOnce(this.model, "sync", this.renderPortal);

                //If the portal isn't found, display a 404 message
                this.listenToOnce(this.model, "notFound", this.showNotFound);

                //Listen to errors that might occur during fetch()
                this.listenToOnce(this.model, "error", this.showError);

                //Fetch the model
                this.model.fetch({ objectOnly: true });

                return this;
            },

            /**
             * Render the Portal view
             */
            renderPortal: function() {

              // Getting the correct portal label and seriesID
              this.label = this.model.get("label");
              this.portalId = this.model.get("seriesId");

              //Remove the listeners thatt were set during the fetch() process
              this.stopListening(this.model, "notFound", this.showNotFound);
              this.stopListening(this.model, "error", this.showError);

                // Insert the overall portal template
                this.$el.html(this.template(this.model.toJSON()));

                //Render the header view
                this.headerView = new PortalHeaderView({
                    model: this.model
                });
                this.headerView.render();
                this.subviews.push(this.headerView);

                //Render the content sections
                _.each(this.model.get("sections"), function(section){
                  this.addSection(section);
                }, this);

                // Render the Data section
                if( this.model.get("hideData") !== true ) {
                    this.sectionDataView = new PortalDataView({
                        model: this.model,
                        id: "Data",
                        sectionName: "Data"
                    });
                    this.subviews.push(this.sectionDataView);

                    this.$("#portal-sections").append(this.sectionDataView.el);

                    //Render the section view and add it to the page
                    this.sectionDataView.render();

                    this.addSectionLink( this.sectionDataView );
                }

                //Render the metrics section link
                if ( this.model.get("hideMetrics") !== true ) {
                  //Create a navigation link
                  this.$("#portal-section-tabs").append(
                    $(document.createElement("li"))
                      .addClass("section-link-container")
                      .append( $(document.createElement("a"))
                                 .text("Metrics")
                                 .addClass("portal-section-link")
                                 .attr("id", "metrics-link")
                                 .attr("href", "#Metrics" )
                                 .attr("data-toggle", "tab")));

                  this.$("#portal-sections").append( $(document.createElement("div"))
                                                      .attr("id", "Metrics")
                                                      .addClass("tab-pane") );
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

                //Switch to the active section
                this.switchSection();

                //Render the logos at the bottom of the portal page
                var ackLogos = this.model.get("acknowledgmentsLogos") || [];
                this.logosView = new PortalLogosView();
                this.logosView.logos = ackLogos;
                this.subviews.push(this.logosView);
                this.logosView.render();
                this.$(".portal-view").append(this.logosView.el);

                //Scroll to an inner-page link if there is one specified
                if( window.location.hash && this.$(window.location.hash).length ){
                  MetacatUI.appView.scrollTo(this.$(window.location.hash));
                }

                // Add edit button if user is authorized
                this.insertOwnerControls();

            },

            /*
             * Checks the authority for the logged in user for this portal and
             * inserts control elements onto the page for the user to interact
             * with the portal. So far, this is just an 'edit portal' button.
             */
            insertOwnerControls: function(){

              // Insert the button into the navbar
              var container = $(".edit-portal-link-container");

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

              var label = this.label,
                  seriesId = this.portalId,
                  pathName = decodeURIComponent(window.location.pathname),
                  section  = this.activeSection;

              //Get the new pathname using the active section
              if( !MetacatUI.root.length || MetacatUI.root == "/" ){
                // If it's a new portal, the portal name might not be in the URL yet
                // Or if navigation is via seriesId - remove the seriesId and display the portal name
                if(pathName.indexOf(label) < 0){
                  if (pathName.indexOf(seriesId) > 0)
                  {
                    // Remove the seriesId and the forward slash
                    pathName = pathName.substring(0, pathName.indexOf(seriesId))
                              .replace(/\/$/, "");;
                  }
                  var newPathName = pathName + "/" + label;
                  newPathName = this.displaySectionInUrl ? newPathName + "/" + section : newPathName;

                } else {
                  var newPathName = pathName.substring(0, pathName.indexOf(label)) +
                                      label;
                  newPathName = this.displaySectionInUrl ? newPathName + "/" + section : newPathName;

                }
              }
              else{
                var newPathName = pathName.substring( pathName.indexOf(MetacatUI.root) + MetacatUI.root.length );
                newPathName = newPathName.substring(0, newPathName.indexOf(label)) +
                                    label ;
                newPathName = this.displaySectionInUrl ? newPathName + "/" + section : newPathName;

              }
              //Update the window location
              MetacatUI.uiRouter.navigate( newPathName, { trigger: false } );

            },

            /**
             * Gets a list of section names from tab elements and updates the
             * sectionNames attribute on this view.
             */
            updateSectionNames: function() {

              // Get the section names from the tab elements
              var sectionNames = [];
              this.$(".portal-section-link")
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
             * @param {string} [sectionName] - The section to switch to. If not given, defaults to the activeSection set on the view.
             */
            switchSection: function(sectionName){

              // Make sure the list of section names is up to date
              this.updateSectionNames();

              //If there are no sections in this portal, exit now
              if( !this.sectionNames.length ){
                return;
              }

              // If no section name is given, use the active section in the view.
              // If there's also no activeSection, then default to an empty string,
              // which will set the navigation to the first section listed
              if( !sectionName ){
                var sectionName = this.activeSection || ""
              }

              // Match the section name to the list of section names on the view
              // Allow case insensitive navigation to sections
              i = this.sectionNames
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

              // Render the metrics section if user navigated directly there
              if( sectionName == "Metrics" ){
                this.renderMetricsView();
              }

              // Activate the section content
              this.$(".tab-content").children("#" + sectionName).addClass("active");

              // Activate the tab
              this.$(".nav-tabs").children().each(function(i, li){
                if($(li).children().attr("href") == "#" + sectionName){
                  var sectionView = $(li).find("a").data("view");
                  if( typeof sectionView !== "undefined"){
                    sectionView.postRender();
                  }
                  $(li).addClass("active")
                };
              });

              // Update the path with the new active section
              this.updatePath();

              // Update path when each tab is clicked and shown
              view = this;
              this.$('a[data-toggle="tab"]').on('shown', function(e){
                view.updatePath(e)
              });

            },

            /**
             * Creates a PortalSectionView to display the content in the given portal
             * section. Also creates a navigation link to the section.
             *
             * @param {PortalSectionModel} sectionModel - The section to render in this view
             */
            addSection: function(sectionModel){

              //Create a new PortalSectionView
              var sectionView = new PortalSectionView({
                model: sectionModel
              });

              //Render the section
              sectionView.render();

              //Add the section view to this portal view
              this.$("#portal-sections").append(sectionView.el);

              this.addSectionLink( sectionView );

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
                  .append( $(document.createElement("a"))
                             .text(label)
                             .attr("href", "#" + hrefLabel )
                             .attr("data-toggle", "tab")
                             .addClass("portal-section-link")
                             .data("view", sectionView)));

            },

            /**
             * Render the metrics section
             */
            renderMetricsView: function() {

              try{

                if( this.model.get("hideMetrics") == true ) {
                  return;
                }

                //If this subview is already rendered, exit
                if( this.sectionMetricsView ){
                  return;
                }

                //Add a loading message to the metrics tab since it can take a while for the metrics query to be sent
                this.$("#Metrics").html(this.loadingTemplate({
                  msg: "Getting metrics..."
                }));

                // If the search results haven't been fetched yet, wait.
                if( !this.model.get("searchResults").header ){
                  this.listenToOnce( this.model.get("searchResults"), "sync", this.renderMetricsView );
                  return;
                }

                // If there are no datasets in the portal collection
                if(this.model.get("searchResults").header.get("numFound") == 0 ){
                      // The description for when there is no data in the collection
                  var description = "There are no datasets in " + this.model.get("label") + " yet.",
                      // use a dummy-ID to create a 'no-activity' metrics view
                      allIDs = "0";
                }

                // For portals with data in the collection
                else {
                      // The description to use for a portal with data
                  var description = "A summary of all datasets from " + this.model.get("label"),
                      // Get all the facet counts from the search results collection
                      facetCounts = this.model.get("allSearchResults").facetCounts,
                      //Get the id facet counts
                      idFacets = facetCounts? facetCounts.id : [],
                      //Get the documents facet counts
                      documentsFacets = facetCounts? facetCounts.documents : [],
                      //Start an array to hold all the ids
                      allIDs = [];

                  //If there are resource map facet counts, get all the ids
                  if( idFacets && idFacets.length ){

                    //Merge the id and documents arrays
                    var allFacets = idFacets.concat(documentsFacets);

                    //Get all the ids, which should be every other element in the
                    // facets array
                    for( var i=0; i < allFacets.length; i+=2 ){
                      allIDs.push( allFacets[i] );
                    }
                  }

                }

                // Create a search model that filters by all the data object Ids
                var statsSearchModel = new SearchModel({
                  idOnly: allIDs,
                  formatType: [],
                  exclude: []
                });

                // Create a StatsModel
                var statsModel = new StatsModel({
                  query: statsSearchModel.getQuery(),
                  searchModel: statsSearchModel,
                  supportDownloads: false
                });

                // Add a stats view
                this.sectionMetricsView = new StatsView({
                    title: "Statistics and Figures",
                    description: description,
                    el: "#Metrics",
                    model: statsModel
                });

                this.sectionMetricsView.render();
                this.subviews.push(this.sectionMetricsView);

              }
              catch(e){
                console.log("Failed to render the metrics view. Error message: " + e);
              }

            },

            /**
             * If the given portal doesn't exist, display a Not Found message.
             */
            showNotFound: function(){

              var notFoundMessage = "The portal \"" + (this.label || this.portalId) +
                                    "\" doesn't exist.",
                  notification = this.alertTemplate({
                    classes: "alert-error",
                    msg: notFoundMessage,
                    includeEmail: true
                  });

              this.$el.html(notification);

            },

            /**
            * Show an error message in this view
            * @param {SolrResult} model
            * @param {XMLHttpRequest.response} response
            */
            showError: function(model, response){

              //Show the error message
              MetacatUI.appView.showAlert(
                "<h4><i class='icon icon-frown'></i>Something went wrong while displaying this portal.</h4>" +
                "<p>Error details: " +
                $(response.responseText).text() + "</p>",
                "alert-error",
                this.$el
              );

              //Remove the loading message from this view
              this.$el.find(".loading").remove();

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

                //Delete the metrics view from this view
                delete this.sectionMetricsView;
                //Delete the model from this view
                delete this.model;

                $("body").removeClass("PortalView");

                $("#editPortal").remove();
            }
        });

        return PortalView;
    });
