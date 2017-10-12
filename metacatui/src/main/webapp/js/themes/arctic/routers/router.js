/*global Backbone */
'use strict';

define(['jquery', 'underscore', 'backbone'], 				
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
			"signinsuccess"             : "renderSignInSuccess",
			'share(/*pid)'              : 'renderEditor', // registry page
			'submit(/*pid)'             : 'renderEditor', // registry page
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

			if(!MetacatUI.appView.textView){
				require(['views/TextView'], function(TextView){
					MetacatUI.appView.textView = new TextView();
					MetacatUI.appView.showView(MetacatUI.appView.textView, options);
				});
			}
			else
				MetacatUI.appView.showView(MetacatUI.appView.textView, options);
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
				var customQuery = MetacatUI.appSearchModel.get('additionalCriteria');
				customQuery.push(query);
				MetacatUI.appSearchModel.set('additionalCriteria', customQuery);
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
			this.routeHistory.push("metadata");
			MetacatUI.appModel.set('lastPid', MetacatUI.appModel.get("pid"));

			//Get the full identifier from the window object since Backbone filters out URL parameters starting with & and ?
			pid = window.location.hash.substring(window.location.hash.indexOf("/")+1);
			
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

			if(!username || !MetacatUI.appModel.get("userProfiles")){
				this.routeHistory.push("summary");

				if(!MetacatUI.appView.statsView){
					require(["views/StatsView"], function(StatsView){
						MetacatUI.appView.statsView = new StatsView();

						MetacatUI.appView.showView(MetacatUI.appView.statsView);
					});
				}
				else
					MetacatUI.appView.showView(MetacatUI.appView.statsView);
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
				this.listenToOnce(appUserModel, "change:checked", function(){
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
		
		/*
          Renders the editor view given a root package identifier,
          or a metadata identifier.  If the latter, the corresponding
          package identifier will be queried and then rendered.
        */
		renderEditor: function (pid) {
			this.routeHistory.push("submit");
			
			if( ! MetacatUI.appView.editorView ){
				require(['views/EditorView'], function(EditorView) {
					MetacatUI.appView.editorView = new EditorView({pid: pid});
					MetacatUI.appView.editorView.pid = pid;
					MetacatUI.appView.showView(MetacatUI.appView.editorView);
				});
                
			} else {
				MetacatUI.appView.editorView.pid = pid;
				MetacatUI.appView.showView(MetacatUI.appView.editorView);
                
			}
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

		logout: function (param) {
			//Clear our browsing history when we log out
			this.routeHistory.length = 0;

			if(((typeof MetacatUI.appModel.get("tokenUrl") == "undefined") || !MetacatUI.appModel.get("tokenUrl")) && !MetacatUI.appView.registryView){
				require(['views/RegistryView'], function(RegistryView){
					MetacatUI.appView.registryView = new RegistryView();
					
					if(MetacatUI.appView.currentView && MetacatUI.appView.currentView.onClose)
						MetacatUI.appView.currentView.onClose();
					
					MetacatUI.appUserModel.logout();
				});
			}
			else{
				if(MetacatUI.appView.currentView && MetacatUI.appView.currentView.onClose)
					MetacatUI.appView.currentView.onClose();
				
				MetacatUI.appUserModel.logout();
			}
		},

		renderTokenSignIn: function(){
			this.routeHistory.push("signin");

			if(!MetacatUI.appView.signInView){
				require(['views/SignInView'], function(SignInView){
					MetacatUI.appView.signInView = new SignInView({ el: "#Content"});
					MetacatUI.appView.showView(MetacatUI.appView.signInView);
				});
			}
			else{
				MetacatUI.appView.showView(MetacatUI.appView.signInView);
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
		}

	});

	return UIRouter;
});
