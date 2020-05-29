/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone'],
function ($, _, Backbone) {

  /**
  * @class UIRouter
  * @classdesc MetacatUI Router
  * @extends Backbone.Router
  * @constructor
  */
	var UIRouter = Backbone.Router.extend(
    /** @lends UIRouter.prototype */{
		routes: {
			''                          : 'navigateToDefault',         // the default route
			'about(/:anchorId)(/)'         : 'renderAbout',        // about page anchors
			'help(/:page)(/:anchorId)(/)'  : 'renderHelp',
			'data/my-data(/page/:page)(/)' : 'renderMyData',    // data search page
			'data(/mode=:mode)(/query=:query)(/page/:page)(/)' : 'renderData',    // data search page
			'profile(/*username)(/s=:section)(/s=:subsection)(/)' : 'renderProfile',
			'my-profile(/s=:section)(/s=:subsection)(/)' : 'renderMyProfile',
			'my-account(/)'                   : 'renderUserSettings',
			'external(/*url)(/)'           : 'renderExternal',     // renders the content of the given url in our UI
			'quality(/s=:suiteId)(/:pid)(/)' : 'renderMdqRun', // MDQ page
			'logout(/)'                    : 'logout',          // logout the user
			'signout(/)'                   : 'logout',          // logout the user
			'signin(/)'					: 'renderTokenSignIn',
		},

		helpPages: {
			"search" : "searchTips",
			defaultPage : "searchTips"
		},

		initialize: function(){
			this.listenTo(Backbone.history, "routeNotFound", this.navigateToDefault);

			// This route handler replaces the route handler we had in the
			// routes table before which was "view/*pid". The * only finds URL
			// parts until the ? but DataONE PIDs can have ? in them so we need
			// to make this route more inclusive.
			this.route(/^view\/(.*)$/, "renderMetadata");

			//Track the history of pathnames
			this.on("route", this.trackPathName);

			// Clear stale JSONLD and meta tags
			this.on("route", this.clearJSONLD);
			this.on("route", this.clearHighwirePressMetaTags);
		},

		//Keep track of navigation movements
		routeHistory: new Array(),
		pathHistory: new Array(),

		// Will return the last route, which is actually the second to last item in the route history,
		// since the last item is the route being currently viewed
		lastRoute: function(){
			if((typeof this.routeHistory === "undefined") || (this.routeHistory.length <= 1))
				return false;
			else
				return this.routeHistory[this.routeHistory.length-2];
		},

		trackPathName: function(e){
			if(_.last(this.pathHistory) != window.location.pathname)
				this.pathHistory.push(window.location.pathname);
		},

		//If the user or app cancelled the last route, call this function to revert the window location pathname back to the correct value
		undoLastRoute: function(){
			this.routeHistory.pop();

			//Remove the last route and pathname from the history
			if(_.last(this.pathHistory) == window.location.pathname)
				this.pathHistory.pop();

			//Change the pathname in the window location back
			this.navigate(_.last(this.pathHistory), {replace: true});
		},

		renderMdqRun: function (suiteId, pid) {
			this.routeHistory.push("quality");

			if (!MetacatUI.appView.mdqRunView) {
				require(["views/MdqRunView"], function(MdqRunView) {
					MetacatUI.appView.mdqRunView = new MdqRunView();
					MetacatUI.appView.mdqRunView.suiteId = suiteId;
					MetacatUI.appView.mdqRunView.pid = pid;
					MetacatUI.appView.showView(MetacatUI.appView.mdqRunView);
				});
			} else {
				MetacatUI.appView.mdqRunView.suiteId = suiteId;
				MetacatUI.appView.mdqRunView.pid = pid;
				MetacatUI.appView.showView(MetacatUI.appView.mdqRunView);
			}
		},

		renderText: function(options){
			if(!MetacatUI.appView.textView){
				require(['views/TextView'], function(TextView){
					MetacatUI.appView.textView = new TextView();
					MetacatUI.appView.showView(MetacatUI.appView.textView, options);
				});
			}
			else
				MetacatUI.appView.showView(MetacatUI.appView.textView, options);
		},

		renderHelp: function(page, anchorId){
			this.routeHistory.push("help");
			MetacatUI.appModel.set('anchorId', anchorId);

			if(page)
				var pageName = this.helpPages[page];
			else
				var pageName = this.helpPages["defaultPage"]; //default

			var options = {
				pageName: pageName,
				anchorId: anchorId
			}

			this.renderText(options);
		},

		renderAbout: function (anchorId) {
			this.routeHistory.push("about");
			MetacatUI.appModel.set('anchorId', anchorId);
			var options = {
					pageName: "about",
					anchorId: anchorId
				}

			this.renderText(options);
		},

		renderData: function (mode, query, page) {
			this.routeHistory.push("data");

			///Check for a page URL parameter
			if((typeof page === "undefined") || !page)
				MetacatUI.appModel.set("page", 0);
			else if(page == 0)
				MetacatUI.appModel.set('page', 0);
			else
				MetacatUI.appModel.set('page', page-1);

			//Check for a query URL parameter
			if((typeof query !== "undefined") && query){
        MetacatUI.appSearchModel.set('additionalCriteria', [query]);
			}

			if(!MetacatUI.appView.dataCatalogView){
				require(['views/DataCatalogView'], function(DataCatalogView){
					MetacatUI.appView.dataCatalogView = new DataCatalogView();

					//Check for a search mode URL parameter
					if((typeof mode !== "undefined") && mode)
						MetacatUI.appView.dataCatalogView.mode = mode;

					MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
				});
			}
			else{
				//Check for a search mode URL parameter
				if((typeof mode !== "undefined") && mode)
					MetacatUI.appView.dataCatalogView.mode = mode;

				MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
			}
		},

		renderMyData: function(page){
			//Only display this is the user is logged in
			if(!MetacatUI.appUserModel.get("loggedIn") && MetacatUI.appUserModel.get("checked")) this.navigate("data", { trigger: true });
			else if(!MetacatUI.appUserModel.get("checked")){
				var router = this;

				this.listenToOnce(MetacatUI.appUserModel, "change:checked", function(){

					if(MetacatUI.appUserModel.get("loggedIn"))
						router.renderMyData(page);
					else
						this.navigate("data", { trigger: true });
				});

				return;
			}

			this.routeHistory.push("data");

			///Check for a page URL parameter
			if(typeof page === "undefined")
				MetacatUI.appModel.set("page", 0);
			else
				MetacatUI.appModel.set('page', page);

			if(!MetacatUI.appView.dataCatalogView){
				require(['views/DataCatalogView'], function(DataCatalogView){
					MetacatUI.appView.dataCatalogView = new DataCatalogView();
					MetacatUI.appView.dataCatalogView.searchModel = MetacatUI.appUserModel.get("searchModel").clone();
					MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
				});
			}
			else{
				MetacatUI.appView.dataCatalogView.searchModel = MetacatUI.appUserModel.get("searchModel").clone();
				MetacatUI.appView.showView(MetacatUI.appView.dataCatalogView);
			}
		},

		renderMetadata: function (pid) {
			pid = decodeURIComponent(pid);

			this.routeHistory.push("metadata");
			MetacatUI.appModel.set('lastPid', MetacatUI.appModel.get("pid"));

			var seriesId;

			//Check for a seriesId
			if(MetacatUI.appModel.get("useSeriesId") && (pid.indexOf("version:") > -1)){
				seriesId = pid.substr(0, pid.indexOf(", version:"));

				pid = pid.substr(pid.indexOf(", version: ") + ", version: ".length);
			}

			//Save the id in the app model
			MetacatUI.appModel.set('pid', pid);

			if(!MetacatUI.appView.metadataView){
				require(['views/MetadataView'], function(MetadataView){
					MetacatUI.appView.metadataView = new MetadataView();

					//Send the id(s) to the view
					MetacatUI.appView.metadataView.seriesId = seriesId;
					MetacatUI.appView.metadataView.pid = pid;

					MetacatUI.appView.showView(MetacatUI.appView.metadataView);
				});
			}
			else{
				//Send the id(s) to the view
				MetacatUI.appView.metadataView.seriesId = seriesId;
				MetacatUI.appView.metadataView.pid = pid;

				MetacatUI.appView.showView(MetacatUI.appView.metadataView);
			}
		},

		renderProfile: function(username, section, subsection){
			this.closeLastView();

			var viewChoice;

			if(!username || !MetacatUI.appModel.get("enableUserProfiles")){
				this.routeHistory.push("summary");

				// flag indicating /profile view
				var viewOptions = { nodeSummaryView: true };

				if(!MetacatUI.appView.statsView){

					require(['views/StatsView'], function(StatsView){
						MetacatUI.appView.statsView = new StatsView({
							userType: "repository"
						});

						MetacatUI.appView.showView(MetacatUI.appView.statsView, viewOptions);
					});
				}
				else
					MetacatUI.appView.showView(MetacatUI.appView.statsView, viewOptions);
			}
			else{
				this.routeHistory.push("profile");
				MetacatUI.appModel.set("profileUsername", username);

				if(section || subsection){
					var viewOptions = { section: section, subsection: subsection }
				}

				if(!MetacatUI.appView.userView){

					require(['views/UserView'], function(UserView){
						MetacatUI.appView.userView = new UserView();

						MetacatUI.appView.showView(MetacatUI.appView.userView, viewOptions);
					});
				}
				else
					MetacatUI.appView.showView(MetacatUI.appView.userView, viewOptions);
			}
		},

		renderMyProfile: function(section, subsection){
			if(MetacatUI.appUserModel.get("checked") && !MetacatUI.appUserModel.get("loggedIn"))
				this.renderTokenSignIn();
			else if(!MetacatUI.appUserModel.get("checked")){
				this.listenToOnce(MetacatUI.appUserModel, "change:checked", function(){
					if(MetacatUI.appUserModel.get("loggedIn"))
						this.renderProfile(MetacatUI.appUserModel.get("username"), section, subsection);
					else
						this.renderTokenSignIn();
				});
			}
			else if(MetacatUI.appUserModel.get("checked") && MetacatUI.appUserModel.get("loggedIn")){
				this.renderProfile(MetacatUI.appUserModel.get("username"), section, subsection);
			}
		},

		logout: function (param) {
			//Clear our browsing history when we log out
			this.routeHistory.length = 0;

			if(((typeof MetacatUI.appModel.get("tokenUrl") == "undefined") || !MetacatUI.appModel.get("tokenUrl")) && !MetacatUI.appView.registryView){
				require(['views/RegistryView'], function(RegistryView){
					MetacatUI.appView.registryView = new RegistryView();
					if(MetacatUI.appView.currentView.onClose)
						MetacatUI.appView.currentView.onClose();
					MetacatUI.appUserModel.logout();
				});
			}
			else{
				if(MetacatUI.appView.currentView.onClose)
					MetacatUI.appView.currentView.onClose();
				MetacatUI.appUserModel.logout();
			}
		},

		renderTokenSignIn: function(){
			this.routeHistory.push("signin");

			if(!MetacatUI.appView.signInView){
				require(["views/SignInView"], function(SignInView){
					MetacatUI.appView.signInView = new SignInView({ el: "#Content", fullPage: true });
					MetacatUI.appView.showView(MetacatUI.appView.signInView);
				});
			}
			else
				MetacatUI.appView.showView(MetacatUI.appView.signInView);
		},

		renderExternal: function(url) {
			// use this for rendering "external" content pulled in dynamically
			this.routeHistory.push("external");

			if(!MetacatUI.appView.externalView){
				require(['views/ExternalView'], function(ExternalView){
					MetacatUI.appView.externalView = new ExternalView();
					MetacatUI.appView.externalView.url = url;
					MetacatUI.appView.showView(MetacatUI.appView.externalView);
				});
			}
			else{
				MetacatUI.appView.externalView.url = url;
				MetacatUI.appView.showView(MetacatUI.appView.externalView);
			}
		},

    /**
     * Render the portal view based on the given name, id, or section
     */
     renderPortal: function(portalId, portalSection) {
       // Add the overall class immediately so the navbar is styled correctly right away
 			 $("body").addClass("PortalView");
       // Look up the portal document seriesId by its registered name if given
       if ( portalSection ) {
         this.routeHistory.push(MetacatUI.appModel.get("portalTermPlural") + "/" + label + "/" + portalSection);
       }
       else{
         this.routeHistory.push(MetacatUI.appModel.get("portalTermPlural") + "/" + label);
       }

       require(['views/portals/PortalView'], function(PortalView){
         MetacatUI.appView.portalView = new PortalView({
             label: label,
             activeSectionLabel: portalSection
         });
         MetacatUI.appView.showView(MetacatUI.appView.portalView);
       });
      },

		/*
		* Gets an array of route names that are set on this router.
		* @return {Array} - An array of route names, not including any special characters
		*/
		getRouteNames: function(){

			var router = this;

		  var routeNames = _.map(Object.keys(this.routes), function(routeName){

				return router.getRouteName(routeName);

			});

			//The "view" route is not included in the route hash (it is set up during initialize),
			// so we have to manually add it here.
			routeNames.push("view");

			return routeNames;

		},

		/*
		* Gets the route name based on the route pattern given
		* @param {string} routePattern - A string that represents the route pattern e.g. "view(/pid)"
		* @return {string} - The name of the route without any pattern special characters e.g. "view"
		*/
		getRouteName: function(routePattern){

			var specialChars = ["/", "(", "*", ":"];

			_.each(specialChars, function(specialChar){

				var substring = routePattern.substring(0, routePattern.indexOf(specialChar));

				if( substring && substring.length < routePattern.length ){
					routePattern = substring;
				}

			});

			return routePattern;

		},

		navigateToDefault: function(){
			//Navigate to the default view
			this.navigate(MetacatUI.appModel.defaultView, {trigger: true});
		},

		closeLastView: function(){
			//Get the last route and close the view
			var lastRoute = _.last(this.routeHistory);

			if(lastRoute == "summary")
				MetacatUI.appView.statsView.onClose();
			else if(lastRoute == "profile")
				MetacatUI.appView.userView.onClose();
		},

		clearJSONLD: function() {
			$("#jsonld").remove();
		},

		clearHighwirePressMetaTags: function() {
			$("head > meta[name='citation_title']").remove()
			$("head > meta[name='citation_authors']").remove()
			$("head > meta[name='citation_publisher']").remove()
			$("head > meta[name='citation_date']").remove()
		}

	});

	return UIRouter;
});
