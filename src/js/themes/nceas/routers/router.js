/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone'],
function ($, _, Backbone) {

	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'navigateToDefault',    // the default route
			'logout'                    : 'logout',    		// logout the user
			'signout'                   : 'logout',    		// logout the user
			'signup'          			: 'renderTokenSignIn',     // use ldapweb for registration
			"signinldaperror"			: "renderLdapSignInError",
			'external(/*url)'           : 'renderExternal', // renders the content of the given url in our UI
			'share(/*pid)'       		: 'renderEditor',  // metadata Editor
			'submit(/*pid)'       		: 'renderEditor',  // metadata Editor
			'drafts' : 'renderDrafts'
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

		//If the user or app cancelled the last route, call this function to revert
		// the window location pathname back to the correct value
		undoLastRoute: function(){
			this.routeHistory.pop();

			//Remove the last route and pathname from the history
			if(_.last(this.pathHistory) == window.location.pathname)
				this.pathHistory.pop();

			//Change the pathname in the window location back
			this.navigate(_.last(this.pathHistory), {replace: true});
		},

		renderIndex: function (param) {
			this.routeHistory.push("index");

			if(!MetacatUI.appView.indexView){
				require(["views/IndexView"], function(IndexView){
					MetacatUI.appView.indexView = new IndexView();
					MetacatUI.appView.showView(MetacatUI.appView.indexView);
				});
			}
			else
				MetacatUI.appView.showView(MetacatUI.appView.indexView);
		},

		renderMetadata: function (pid) {
			this.routeHistory.push("metadata");
			MetacatUI.appModel.set('lastPid', MetacatUI.appModel.get("pid"));

			var seriesId;

			//Check for a seriesId
			if(pid.indexOf("version:") > -1){
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

		/*
    * Renders the editor view given a root package identifier,
    * or a metadata identifier.  If the latter, the corresponding
    * package identifier will be queried and then rendered.
    */
		renderEditor: function (pid) {

			//If there is no EML211EditorView yet, create one
			if( ! MetacatUI.appView.eml211EditorView ){

				var router = this;

				//Load the EML211EditorView file
				require(['views/metadata/EML211EditorView'], function(EML211EditorView) {
					//Add the submit route to the router history
					router.routeHistory.push("submit");

					//Create a new EML211EditorView
					MetacatUI.appView.eml211EditorView = new EML211EditorView({pid: pid});

					//Set the pid from the pid given in the URL
					MetacatUI.appView.eml211EditorView.pid = pid;

					//Render the EML211EditorView
					MetacatUI.appView.showView(MetacatUI.appView.eml211EditorView);
				});

			}
			// If the EML211EditorView already exists, check if we need to show a confirmation alert
			else {

					//Set the pid from the pid given in the URL
					MetacatUI.appView.eml211EditorView.pid = pid;

					//Add the submit route to the router history
					this.routeHistory.push("submit");

					//Render the Editor View
					MetacatUI.appView.showView(MetacatUI.appView.eml211EditorView);

			}
		},

		renderDrafts: function() {
			require(['views/DraftsView'], function(DraftsView){
				MetacatUI.appView.draftsView = new DraftsView();
				MetacatUI.appView.showView(MetacatUI.appView.draftsView);
			});
		 },

		renderLdapSignInError: function(){
			this.routeHistory.push("signinldaperror");

			if(!MetacatUI.appView.signInView){
				require(['views/SignInView'], function(SignInView){
					MetacatUI.appView.signInView = new SignInView({ el: "#Content"});
					MetacatUI.appView.signInView.ldapError = true;
					MetacatUI.appView.showView(MetacatUI.appView.signInView);
				});
			}
			else{
				MetacatUI.appView.signInView.ldapError = true;
				MetacatUI.appView.showView(MetacatUI.appView.signInView);
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
