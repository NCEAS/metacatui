/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone'], 				
function ($, _, Backbone) {
		
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'navigateToDefault',    // the default route
			'view/*pid'                 : 'renderMetadata', // metadata page
			'logout'                    : 'logout',    		// logout the user
			'signout'                   : 'logout',    		// logout the user
			'signup'          			: 'renderLdap',     // use ldapweb for registration
			"signinldaperror"			: "renderLdapSignInError",
			'external(/*url)'           : 'renderExternal', // renders the content of the given url in our UI
			'account(/:stage)'          : 'renderLdap',     // use ldapweb for different stages
			'share(/:stage/*pid)'       : 'renderRegistry'  // registry page
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
		
		renderIndex: function (param) {
			this.routeHistory.push("index");
			
			if(!appView.indexView){
				require(["views/IndexView"], function(IndexView){
					appView.indexView = new IndexView();
					appView.showView(appView.indexView);					
				});
			}
			else
				appView.showView(appView.indexView);
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
		
		renderLdap: function (stage) {
			this.routeHistory.push("ldap");
			
			if(!appView.ldapView){
				require(["views/LdapView"], function(LdapView){
					appView.ldapView = new LdapView();
					appView.ldapView.stage = stage;
					appView.showView(appView.ldapView);
				});
			}else{
				appView.ldapView.stage = stage;
				appView.showView(appView.ldapView);
			}
		},
		
		renderLdapSignInError: function(){
			this.routeHistory.push("signinldaperror");
			
			if(!appView.signInView){
				require(['views/SignInView'], function(SignInView){
					appView.signInView = new SignInView({ el: "#Content"});
					appView.signInView.ldapError = true;
					appView.showView(appView.signInView);
				});
			}
			else{
				appView.signInView.ldapError = true;
				appView.showView(appView.signInView);
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
		}
		
	});

	return UIRouter;
});