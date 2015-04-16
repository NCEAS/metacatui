/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/AboutView', 'views/ToolsView', 'views/DataCatalogView', 'views/RegistryView', 'views/MetadataView', 'views/ExternalView', 'views/LdapView', 'views/StatsView', 'views/UserView'], 				
function ($, _, Backbone, IndexView, AboutView, ToolsView, DataCatalogView, RegistryView, MetadataView, ExternalView, LdapView, StatsView, UserView) {

	var indexView = new IndexView();
	var aboutView = aboutView || new AboutView();
	var toolsView = toolsView || new ToolsView();
	var dataCatalogView = new DataCatalogView();
	var registryView = new RegistryView();
	var metadataView = new MetadataView();
	var externalView = new ExternalView();
	var ldapView = new LdapView();
	var statsView = new StatsView();
	var userView = new UserView();
	
	// set the KNB as the only LDAP servicer for this theme
	// NOTE: requires CORS configured on the web server
	appModel.set('ldapwebServiceUrl', 'https://knb.ecoinformatics.org/knb/cgi-bin/ldapweb.cgi');
	
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			'' 							: 'navigateToDefault',    // default is data search page
			'about'                     : 'renderAbout',  // about page
			'about(/:anchorId)'         : 'renderAbout',  // about page anchors
			'plans'                     : 'renderPlans',  // plans page
			'tools(/:anchorId)'         : 'renderTools',  // tools page
			'data(/mode=:mode)(/query=:query)(/page/:page)' : 'renderData',    // data search page
			'view/*pid'                 : 'renderMetadata',    // metadata page
			'profile(/*query)'			: 'renderProfile', //profile page
			'external(/*url)'           : 'renderExternal',    // renders the content of the given url in our UI
			'logout'                    : 'logout',    // logout the user
			'signup'          			: 'renderLdap',    // use ldapweb for registration
			'account(/:stage)'          : 'renderLdap',    // use ldapweb for different stages
			'share(/:stage/*pid)'       : 'renderRegistry'    // registry page
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

		routeToData: function () {
			this.routeHistory.push('data');
			this.navigate("data", {trigger: true});
		},
		
		renderIndex: function (param) {
			this.routeHistory.push('index');
			appView.showView(indexView);
		},
		
		renderAbout: function (anchorId) {
			this.routeHistory.push('about');
			appModel.set('anchorId', anchorId);
			appView.showView(aboutView);
		},
		
		renderPlans: function (param) {
			this.routeHistory.push('plans');
		},
		
		renderTools: function (anchorId) {
			this.routeHistory.push('tools');
			appModel.set('anchorId', anchorId);
			appView.showView(toolsView);
		},
		
		renderData: function (mode, query, page) {
			this.routeHistory.push("data");
			appModel.set('page', page);
			
			//If a search mode parameter is given
			if(mode){
				appModel.set('searchMode', mode)
			}
			
			//If a query parameter is given
			if(query){
				var customQuery = appSearchModel.get('additionalCriteria');
				customQuery.push(query);
				appSearchModel.set('additionalCriteria', customQuery);
			}
			
			appView.showView(dataCatalogView);
		},
		
		renderMetadata: function (pid) {
			this.routeHistory.push('metadata');
			appModel.set('pid', pid);
			metadataView.pid = pid;
			appView.showView(metadataView);
		},
		
		renderProfile: function(username){
			this.closeLastView();
			
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
			this.routeHistory.push('ldap');
			ldapView.stage = stage;
			appView.showView(ldapView);
		},
		
		logout: function (param) {
			//Clear out browsing history when we log out
			this.routeHistory.length = 0;
			
			registryView.logout();
		},
		
		renderExternal: function(url) {
			this.routeHistory.push('external');
			// use this for rendering "external" content pulled in dynamically
			externalView.url = url;
			appView.showView(externalView);
		},
		
		navigateToDefault: function(){
			//Navigate to the default view
			this.navigate(appModel.defaultView, {trigger: true});
		},
		
		closeLastView: function(){
			//Get the last route and close the view
			var lastRoute = _.last(this.routeHistory);
			
			if(lastRoute == "summary")
				statsView.onClose();				
			else if(lastRoute == "profile")
				userView.onClose();
		}
		
	});

	return UIRouter;
});