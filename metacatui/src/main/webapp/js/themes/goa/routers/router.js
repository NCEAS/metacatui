/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/AboutView', 'views/ToolsView', 'views/DataCatalogView', 'views/RegistryView', 'views/MetadataView', 'views/ExternalView', 'views/LdapView', 'views/StatsView'], 				
function ($, _, Backbone, IndexView, AboutView, ToolsView, DataCatalogView, RegistryView, MetadataView, ExternalView, LdapView, StatsView) {

	var indexView = new IndexView();
	var aboutView = aboutView || new AboutView();
	var toolsView = toolsView || new ToolsView();
	var dataCatalogView = new DataCatalogView();
	var registryView = new RegistryView();
	var metadataView = new MetadataView();
	var externalView = new ExternalView();
	var ldapView = new LdapView();
	var statsView = new StatsView();
	
	// set the KNB as the only LDAP servicer for this theme
	// NOTE: requires CORS configured on the web server
	appModel.set('ldapwebServiceUrl', 'https://knb.ecoinformatics.org/knb/cgi-bin/ldapweb.cgi');
	
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			'' 							: 'routeToData',    // default is data search page
			'about'                     : 'renderAbout',  // about page
			'about(/:anchorId)'         : 'renderAbout',  // about page anchors
			'plans'                     : 'renderPlans',  // plans page
			'tools(/:anchorId)'         : 'renderTools',  // tools page
			'data(/page/:page)(/mode=:mode)(/query=:query)' : 'renderData',    // data search page
			'view/*pid'                 : 'renderMetadata',    // metadata page
			'profile(/*query)'			: 'renderProfile', //profile page
			'external(/*url)'           : 'renderExternal',    // renders the content of the given url in our UI
			'logout'                    : 'logout',    // logout the user
			'signup'          			: 'renderLdap',    // use ldapweb for registration
			'account(/:stage)'          : 'renderLdap',    // use ldapweb for different stages
			'share(/:stage/*pid)'       : 'renderRegistry'    // registry page
		},
		
		routeHistory: new Array(),
		
		// Will return the last route, which is actually the second to last item in the route history, 
		// since the last item is the route being currently viewed
		lastRoute: function(){
			if((this.routeHistory === undefined) || (this.routeHistory.length <= 1)){
				return false;
			}
			
			return this.routeHistory[this.routeHistory.length-2];
		},

		routeToData: function () {
			console.log('Called UIRouter.routeToData()');
			this.routeHistory.push('data');
			this.navigate("data", {trigger: true});
		},
		
		renderIndex: function (param) {
			console.log('Called UIRouter.renderIndex()');
			this.routeHistory.push('index');
			appView.showView(indexView);
		},
		
		renderAbout: function (anchorId) {
			console.log('Called UIRouter.renderAbout()');
			this.routeHistory.push('about');
			appModel.set('anchorId', anchorId);
			appView.showView(aboutView);
		},
		
		renderPlans: function (param) {
			this.routeHistory.push('plans');
			console.log('Called UIRouter.renderPlans()');
		},
		
		renderTools: function (anchorId) {
			console.log('Called UIRouter.renderTools()');
			this.routeHistory.push('tools');
			appModel.set('anchorId', anchorId);
			appView.showView(toolsView);
		},
		
		renderData: function (page, mode, query) {
			console.log('Called UIRouter.renderData()');
			this.routeHistory.push('data');
			appModel.set('page', page);
			if(mode){
				appModel.set('searchMode', mode)
			}
			if(query){
				searchModel.set('customQuery', query);
			}
			appView.showView(dataCatalogView);
		},
		
		renderMetadata: function (pid) {
			console.log('Called UIRouter.renderMetadata()');
			this.routeHistory.push('metadata');
			appModel.set('pid', pid);
			appView.showView(metadataView);
		},
		
		renderProfile: function(query){
			console.log('Called UIRouter.renderProfile()');
			this.routeHistory.push("profile");
			
			//Reset the stats model first
			statsModel.clear().set(statsModel.defaults);			
			if(!query || query.length > 0){
				statsModel.set('query', query);				
			}
			appView.showView(statsView);
		},
		
		renderRegistry: function (stage, pid) {
			console.log('Called UIRouter.renderRegistry()');
			this.routeHistory.push("registry");
			registryView.stage = stage;
			registryView.pid = pid;
			appView.showView(registryView);
		},
		
		renderLdap: function (stage) {
			this.routeHistory.push('ldap');
			console.log('Called UIRouter.renderLdap()');
			ldapView.stage = stage;
			appView.showView(ldapView);
		},
		
		logout: function (param) {
			//Clear out browsing history when we log out
			this.routeHistory.length = 0;
			
			console.log('Called UIRouter.logout()');
			registryView.logout();
			//appView.showView(indexView);
		},
		
		renderExternal: function(url) {
			this.routeHistory.push('external');
			// use this for rendering "external" content pulled in dynamically
			console.log('Called UIRouter.renderExternal()');
			externalView.url = url;
			appView.showView(externalView);
		}
		
	});

	return UIRouter;
});