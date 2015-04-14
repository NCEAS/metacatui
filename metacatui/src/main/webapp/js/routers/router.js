/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/AboutView', 'views/ToolsView', 'views/DataCatalogView', 'views/RegistryView', 'views/MetadataView', 'views/StatsView', 'views/UserView', 'views/ExternalView', 'views/LdapView'], 				
function ($, _, Backbone, IndexView, AboutView, ToolsView, DataCatalogView, RegistryView, MetadataView, StatsView, UserView, ExternalView, LdapView) {

	var indexView = new IndexView();
	var aboutView = aboutView || new AboutView();
	var toolsView = toolsView || new ToolsView();
	var dataCatalogView = new DataCatalogView();
	var registryView = new RegistryView();
	var metadataView = new MetadataView();
	var statsView = new StatsView();
	var userView = new UserView();
	var externalView = new ExternalView();
	var ldapView = new LdapView();
		
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'renderIndex',    // the default route
			'about'                     : 'renderAbout',    // about page
			'about(/:anchorId)'         : 'renderAbout',    // about page anchors
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
		
		initialize: function(){
			this.listenTo(Backbone.history, "routeNotFound", this.navigateToDefault);
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

		renderIndex: function (param) {
			this.routeHistory.push("index");
			appView.showView(indexView);
		},
		
		renderAbout: function (anchorId) {
			this.routeHistory.push("about");
			appModel.set('anchorId', anchorId);
			appView.showView(aboutView);
		},
		
		renderPlans: function (param) {
			this.routeHistory.push("plans");
		},
		
		renderTools: function (anchorId) {
			this.routeHistory.push("tools");
			appModel.set('anchorId', anchorId);
			appView.showView(toolsView);
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
				appModel.set('searchMode', mode)
			
			//If a query parameter is given
			if((typeof query !== "undefined") && query){
				var customQuery = searchModel.get('additionalCriteria');
				customQuery.push(query);
				searchModel.set('additionalCriteria', customQuery);
			}
			
			appView.showView(dataCatalogView);
		},
		
		renderMetadata: function (pid) {
			this.routeHistory.push("metadata");
			appModel.set('lastPid', appModel.get("pid"));
			appModel.set('pid', pid);
			metadataView.pid = pid;
			appView.showView(metadataView);
		},
		
		renderProfile: function(username){
			//Reset the stats model first
			statsModel.clear().set(statsModel.defaults);
			
			if(!username){
				this.routeHistory.push("summary");
				appView.showView(statsView);
			}
			else{
				this.routeHistory.push("profile");
				appModel.set("profileUsername", username);
				appView.showView(userView);
			}
		},
		
		renderRegistry: function (stage, pid) {
			this.routeHistory.push("registry");
			registryView.stage = stage;
			registryView.pid = pid;
			appView.showView(registryView);
		},
		
		renderLdap: function (stage) {
			this.routeHistory.push("ldap");
			ldapView.stage = stage;
			appView.showView(ldapView);
		},
		
		logout: function (param) {
			//Clear our browsing history when we log out
			this.routeHistory.length = 0;
			registryView.logout();
			//appView.showView(indexView);
		},
		
		renderExternal: function(url) {
			// use this for rendering "external" content pulled in dynamically
			this.routeHistory.push("external");
			externalView.url = url;
			appView.showView(externalView);
		},
		
		navigateToDefault: function(){
			//Navigate to the default view
			this.navigate(appModel.defaultView, {trigger: true});
		}
		
	});

	return UIRouter;
});