/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone'], 				
function ($, _, Backbone) {
		
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'navigateToDefault',    // the default route
			'help(/:page)(/:anchorId)'  : 'renderHelp',
			'data/my-data(/page/:page)' : 'renderMyData',    // data search page
			'data(/mode=:mode)(/query=:query)(/page/:page)' : 'renderData',    // data search page
			'view/*pid'                 : 'renderMetadata', // metadata page
			'profile(/*username)(/s=:section)(/s=:subsection)' : 'renderProfile',
			'external(/*url)'           : 'renderExternal', // renders the content of the given url in our UI
			'logout'                    : 'logout',    		// logout the user
			'signout'                   : 'logout',    		// logout the user
			'signin'					: "renderRegistry",
			'account(/:stage)'          : 'renderLdap',     // use ldapweb for different stages
			'share(/:stage/*pid)'       : 'renderRegistry'  // registry page
		},
		
		helpPages: {
			"search" : "searchTips",
			defaultPage : "searchTips"
		},
		
		initialize: function(){
			// set the KNB as the only LDAP servicer for this theme
			// NOTE: requires CORS configured on the web server
			MetacatUI.appModel.set('ldapwebServiceUrl', 'https://knb.ecoinformatics.org/knb/cgi-bin/ldapweb.cgi');
			
			this.listenTo(Backbone.history, "routeNotFound", this.navigateToDefault);
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
		
		renderData: function (mode, query, page) {
			this.routeHistory.push("data");
			
			//Check for a page URL parameter
			if(typeof page === "undefined")
				MetacatUI.appModel.set("page", 0);
			else
				MetacatUI.appModel.set('page', page);

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
			
			if(lastRoute == "summary")
				MetacatUI.appView.statsView.onClose();				
			else if(lastRoute == "profile")
				MetacatUI.appView.userView.onClose();
		}
		
	});

	return UIRouter;
});			