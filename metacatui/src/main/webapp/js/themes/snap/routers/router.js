/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/TextView', 'views/DataCatalogView', 'views/RegistryView', 'views/MetadataView', 'views/StatsView', 'views/UserView', 'views/ExternalView', 'views/LdapView'], 				
function ($, _, Backbone, IndexView, TextView, DataCatalogView, RegistryView, MetadataView, StatsView, UserView, ExternalView, LdapView) {
		
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'navigateToDefault',    // the default route
			'about(/:anchorId)'         : 'renderAbout',    // about page anchors
			'help(/:page)(/:anchorId)'  : 'renderHelp',
			'plans'                     : 'renderPlans',    // plans page
			'tools(/:anchorId)'         : 'renderTools',    // tools page
			'data(/mode=:mode)(/query=:query)(/page/:page)' : 'renderData',    // data search page
			'view/*pid'                 : 'renderMetadata', // metadata page
			'profile(/*username)'		: 'renderProfile',
			'external(/*url)'           : 'renderExternal', // renders the content of the given url in our UI
			'logout'                    : 'logout',    		// logout the user
			'signup'          			: 'renderLdap',     // use ldapweb for registration
			'account(/:stage)'          : 'renderLdap',     // use ldapweb for different stages
			'share(/:stage/*pid)'       : 'renderRegistry'  // registry page
		},
		
		helpPages: {
			"search" : "searchTips",
			defaultPage : "searchTips"
		},
		
		initialize: function(){
			this.listenTo(Backbone.history, "routeNotFound", this.navigateToDefault);
			
			appView.indexView = new IndexView();
			appView.textView = new TextView();
			appView.dataCatalogView = new DataCatalogView();
			appView.registryView = new RegistryView();
			appView.metadataView = new MetadataView();
			appView.statsView = new StatsView();
			appView.userView = new UserView();
			appView.externalView = new ExternalView();
			appView.ldapView = new LdapView();
		},
		
		routeHistory: new Array(),
		
		// Will return the last route, which is actually the second to last item in the route history, 
		// since the last item is the route being currently viewed
		lastRoute: function(){
			if((typeof this.routeHistory === "undefined") || (this.routeHistory.length <= 1))
				return false;
			else
				return this.routeHistory[this.routeHistory.length-2];
		},
		
		renderHelp: function(page, anchorId){
			this.routeHistory.push("help");
			appModel.set('anchorId', anchorId);
			
			if(page)
				var pageName = this.helpPages[page];
			else
				var pageName = this.helpPages["defaultPage"]; //default
			
			var options = {
				pageName: pageName,
				anchorId: anchorId
			}
			
			appView.showView(appView.textView, options);
		},

		renderIndex: function (param) {
			this.routeHistory.push("index");
			appView.showView(appView.indexView);
		},
		
		renderAbout: function (anchorId) {
			this.routeHistory.push("about");
			appModel.set('anchorId', anchorId);
			var options = {
					pageName: "about",
					anchorId: anchorId
				}
			
			appView.showView(appView.textView, options);
		},
		
		renderTools: function (anchorId) {
			this.routeHistory.push("tools");
			appModel.set('anchorId', anchorId);
			
			var options = {
					pageName: "tools",
					anchorId: anchorId
				}
			
			appView.showView(appView.textView, options);
		},
		
		renderPlans: function (param) {
			this.routeHistory.push("plans");
		},
		
		renderData: function (mode, query, page) {
			this.routeHistory.push("data");
			appModel.set('page', page);
			
			///Check for the URL parameters
			if(typeof page === "undefined")
				appModel.set("page", 0);
			else
				appModel.set('page', page);
			
			//If a search mode parameter is given
			if((typeof mode !== "undefined") && mode)
				//appModel.set('searchMode', mode)
				appView.dataCatalogView.mode = mode;
			
			//If a query parameter is given
			if((typeof query !== "undefined") && query){
				var customQuery = appSearchModel.get('additionalCriteria');
				customQuery.push(query);
				appSearchModel.set('additionalCriteria', customQuery);
			}
			
			appView.showView(appView.dataCatalogView);
		},
		
		renderMetadata: function (pid) {
			this.routeHistory.push("metadata");
			appModel.set('lastPid', appModel.get("pid"));
			appModel.set('pid', pid);
			appView.metadataView.pid = pid;
			appView.showView(appView.metadataView);
		},
		
		renderProfile: function(username){
			this.closeLastView();
			
			if(!username){
				this.routeHistory.push("summary");
				appView.showView(appView.statsView);
			}
			else{
				this.routeHistory.push("profile");
				appModel.set("profileUsername", username);
				appView.showView(appView.userView);
			}
		},
		
		renderRegistry: function (stage, pid) {
			this.routeHistory.push("registry");
			appView.registryView.stage = stage;
			appView.registryView.pid = pid;
			appView.showView(appView.registryView);
		},
		
		renderLdap: function (stage) {
			this.routeHistory.push("ldap");
			appView.ldapView.stage = stage;
			appView.showView(appView.ldapView);
		},
		
		logout: function (param) {
			//Clear our browsing history when we log out
			this.routeHistory.length = 0;
			appView.registryView.logout();
			//appView.showView(appView.indexView);
		},
		
		renderExternal: function(url) {
			// use this for rendering "external" content pulled in dynamically
			this.routeHistory.push("external");
			appView.externalView.url = url;
			appView.showView(appView.externalView);
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