/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone'],
function ($, _, Backbone) {

	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'renderData',    // the default route
			'data/my-data(/page/:page)' : 'renderMyData',    // data search page
			'data(/mode=:mode)(/query=:query)(/page/:page)' : 'renderData',    // data search page
			'view/*pid'                 : 'renderMetadata', // metadata page
			'profile(/*username)(/s=:section)(/s=:subsection)' : 'renderProfile',
			'my-profile(/s=:section)(/s=:subsection)' : 'renderMyProfile',
			'external(/*url)'           : 'renderExternal', // renders the content of the given url in our UI
			'signout'					: 'logout',
			'signin'					: 'renderTokenSignIn',
			"signinsuccess"           : "renderSignInSuccess",
			'share(/:stage/*pid)'       : 'renderRegistry', // registry page
			'quality(/s=:suiteId)(/:pid)' : 'renderMdqRun', // MDQ page
			'api(/:anchorId)'           : 'renderAPI'       // API page
		},

		helpPages: {
			"search" : "searchTips",
			defaultPage : "searchTips"
		},

		initialize: function(){
			this.listenTo(Backbone.history, "routeNotFound", this.navigateToDefault);

			//Track the history of hashes
			this.on("route", this.trackHash);
		},

		//Keep track of navigation movements
		routeHistory: new Array(),
		hashHistory: new Array(),

		// Will return the last route, which is actually the second to last item in the route history,
		// since the last item is the route being currently viewed
		lastRoute: function(){
			if((typeof this.routeHistory === "undefined") || (this.routeHistory.length <= 1))
				return false;
			else
				return this.routeHistory[this.routeHistory.length-2];
		},

		trackHash: function(e){
			if(_.last(this.hashHistory) != window.location.hash)
				this.hashHistory.push(window.location.hash);
		},

		//If the user or app cancelled the last route, call this function to revert the window location hash back to the correct value
		undoLastRoute: function(){
			this.routeHistory.pop();

			//Remove the last route and hash from the history
			if(_.last(this.hashHistory) == window.location.hash)
				this.hashHistory.pop();

			//Change the hash in the window location back
			this.navigate(_.last(this.hashHistory), {replace: true});
		},

		renderAPI: function (anchorId) {
			this.routeHistory.push("api");

			appModel.set('anchorId', anchorId);
			var options = {
					pageName: "api",
					anchorId: anchorId
			}

			if(!appView.textView){
				require(['views/TextView'], function(TextView){
					appView.textView = new TextView();
					appView.showView(appView.textView, options);
				});
			}
			else
				appView.showView(appView.textView, options);
		},

		renderData: function (mode, query, page) {
			this.routeHistory.push("data");

			///Check for a page URL parameter
			if((typeof page === "undefined") || !page)
				appModel.set("page", 0);
			else if(page == 0)
				appModel.set('page', 0);
			else
				appModel.set('page', page-1);

			//Check for a query URL parameter
			if((typeof query !== "undefined") && query){
				var customQuery = appSearchModel.get('additionalCriteria');
				customQuery.push(query);
				appSearchModel.set('additionalCriteria', customQuery);
			}

			if(!appView.dataCatalogView){
				require(['views/DataCatalogView'], function(DataCatalogView){
					appView.dataCatalogView = new DataCatalogView();

					//Check for a search mode URL parameter
					if((typeof mode !== "undefined") && mode)
						appView.dataCatalogView.mode = mode;

					appView.showView(appView.dataCatalogView);
				});
			}
			else{
				//Check for a search mode URL parameter
				if((typeof mode !== "undefined") && mode)
					appView.dataCatalogView.mode = mode;

				appView.showView(appView.dataCatalogView);
			}
		},

		renderMyData: function(page){
			//Only display this is the user is logged in
			if(!appUserModel.get("loggedIn") && appUserModel.get("checked")) this.navigate("data", { trigger: true });
			else if(!appUserModel.get("checked")){
				var router = this;

				this.listenToOnce(appUserModel, "change:checked", function(){

					if(appUserModel.get("loggedIn"))
						router.renderMyData(page);
					else
						this.navigate("data", { trigger: true });
				});

				return;
			}

			this.routeHistory.push("data");

			///Check for a page URL parameter
			if(typeof page === "undefined")
				appModel.set("page", 0);
			else
				appModel.set('page', page);

			if(!appView.dataCatalogView){
				require(['views/DataCatalogView'], function(DataCatalogView){
					appView.dataCatalogView = new DataCatalogView();
					appView.dataCatalogView.searchModel = appUserModel.get("searchModel").clone();
					appView.showView(appView.dataCatalogView);
				});
			}
			else{
				appView.dataCatalogView.searchModel = appUserModel.get("searchModel").clone();
				appView.showView(appView.dataCatalogView);
			}
		},

		renderMetadata: function (pid) {
			this.routeHistory.push("metadata");
			appModel.set('lastPid', appModel.get("pid"));

			//Get the full identifier from the window object since Backbone filters out URL parameters starting with & and ?
			pid = window.location.hash.substring(window.location.hash.indexOf("/")+1);
			
			var seriesId;

			//Check for a seriesId
			if(appModel.get("useSeriesId") && (pid.indexOf("version:") > -1)){
				seriesId = pid.substr(0, pid.indexOf(", version:"));

				pid = pid.substr(pid.indexOf(", version: ") + ", version: ".length);
			}

			//Save the id in the app model
			appModel.set('pid', pid);

			if(!appView.metadataView){
				require(['views/MetadataView'], function(MetadataView){
					appView.metadataView = new MetadataView();

					//Send the id(s) to the view
					appView.metadataView.seriesId = seriesId;
					appView.metadataView.pid = pid;

					appView.showView(appView.metadataView);
				});
			}
			else{
				//Send the id(s) to the view
				appView.metadataView.seriesId = seriesId;
				appView.metadataView.pid = pid;

				appView.showView(appView.metadataView);
			}
		},

		renderProfile: function(username, section, subsection){
			this.closeLastView();

			var viewChoice;

			if(!username || !appModel.get("userProfiles")){
				this.routeHistory.push("summary");

				if(!appView.statsView){
					require(["views/StatsView"], function(StatsView){
						appView.statsView = new StatsView();

						appView.showView(appView.statsView);
					});
				}
				else
					appView.showView(appView.statsView);
			}
			else{
				this.routeHistory.push("profile");
				appModel.set("profileUsername", username);

				if(section || subsection){
					var viewOptions = { section: section, subsection: subsection }
				}

				if(!appView.userView){

					require(['views/UserView'], function(UserView){
						appView.userView = new UserView();

						appView.showView(appView.userView, viewOptions);
					});
				}
				else
					appView.showView(appView.userView, viewOptions);
			}
		},
		
		renderMyProfile: function(section, subsection){
			if(appUserModel.get("checked") && !appUserModel.get("loggedIn"))
				this.renderTokenSignIn();
			else if(!appUserModel.get("checked")){
				this.listenToOnce(appUserModel, "change:checked", function(){
					if(appUserModel.get("loggedIn"))
						this.renderProfile(appUserModel.get("username"), section, subsection);
					else
						this.renderTokenSignIn();
				});
			}
			else if(appUserModel.get("checked") && appUserModel.get("loggedIn")){
				this.renderProfile(appUserModel.get("username"), section, subsection);
			}
		},

		renderRegistry: function (stage, pid) {
			this.routeHistory.push("registry");

			if(!appView.registryView){
				require(['views/RegistryView'], function(RegistryView){
					appView.registryView = new RegistryView();
					appView.registryView.stage = stage;
					appView.registryView.pid = pid;
					appView.showView(appView.registryView);
				});
			}
			else{
				appView.registryView.stage = stage;
				appView.registryView.pid = pid;
				appView.showView(appView.registryView);
			}
		},

		renderMdqRun: function (suiteId, pid) {
			this.routeHistory.push("quality");

			if (!appView.mdqRunView) {
				require(["views/MdqRunView"], function(MdqRunView) {
					appView.mdqRunView = new MdqRunView();
					appView.mdqRunView.suiteId = suiteId;
					appView.mdqRunView.pid = pid;
					appView.showView(appView.mdqRunView);
				});
			} else {
				appView.mdqRunView.suiteId = suiteId;
				appView.mdqRunView.pid = pid;
				appView.showView(appView.mdqRunView);
			}
		},

		logout: function (param) {
			//Clear our browsing history when we log out
			this.routeHistory.length = 0;

			if(((typeof appModel.get("tokenUrl") == "undefined") || !appModel.get("tokenUrl")) && !appView.registryView){
				require(['views/RegistryView'], function(RegistryView){
					appView.registryView = new RegistryView();
					if(appView.currentView.onClose)
						appView.currentView.onClose();
					appUserModel.logout();
				});
			}
			else{
				if(appView.currentView.onClose)
					appView.currentView.onClose();
				appUserModel.logout();
			}
		},

		renderTokenSignIn: function(){
			this.routeHistory.push("signin");

			if(!appView.signInView){
				require(['views/SignInView'], function(SignInView){
					appView.signInView = new SignInView({ el: "#Content"});
					appView.showView(appView.signInView);
				});
			}
			else{
				appView.showView(appView.signInView);
			}
		},

		renderSignInSuccess: function(){
			console.log("renderSignInSuccess");
			$("body").html("Sign-in successful.");
			setTimeout(window.close, 1000);
		},

		renderExternal: function(url) {
			// use this for rendering "external" content pulled in dynamically
			this.routeHistory.push("external");

			if(!appView.externalView){
				require(['views/ExternalView'], function(ExternalView){
					appView.externalView = new ExternalView();
					appView.externalView.url = url;
					appView.showView(appView.externalView);
				});
			}
			else{
				appView.externalView.url = url;
				appView.showView(appView.externalView);
			}
		},

		navigateToDefault: function(){
			//Navigate to the default view
			this.navigate(appModel.defaultView, {trigger: true});
		},

		closeLastView: function(){
			//Get the last route and close the view
			var lastRoute = _.last(this.routeHistory);

			if(lastRoute == "summary")
				appView.statsView.onClose();
			else if(lastRoute == "profile")
				appView.userView.onClose();
		}

	});

	return UIRouter;
});
