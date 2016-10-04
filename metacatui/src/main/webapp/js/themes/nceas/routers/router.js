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
		
		
		renderRegistry: function (stage, pid) {
			this.routeHistory.push("registry");
			
			if(!MetacatUI.appView.registryView){
				require(['views/RegistryView'], function(RegistryView){
					MetacatUI.appView.registryView = new RegistryView();
					MetacatUI.appView.registryView.stage = stage;
					MetacatUI.appView.registryView.pid = pid;
					MetacatUI.appView.showView(MetacatUI.appView.registryView);
				});
			}
			else{
				MetacatUI.appView.registryView.stage = stage;
				MetacatUI.appView.registryView.pid = pid;
				MetacatUI.appView.showView(MetacatUI.appView.registryView);
			}
		},
		
		renderLdap: function (stage) {
			this.routeHistory.push("ldap");
			
			if(!MetacatUI.appView.ldapView){
				require(["views/LdapView"], function(LdapView){
					MetacatUI.appView.ldapView = new LdapView();
					MetacatUI.appView.ldapView.stage = stage;
					MetacatUI.appView.showView(MetacatUI.appView.ldapView);
				});
			}else{
				MetacatUI.appView.ldapView.stage = stage;
				MetacatUI.appView.showView(MetacatUI.appView.ldapView);
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
		}
		
	});

	return UIRouter;
});