/*global define */
define(['jquery',
				'underscore',
				'backbone',
				'bootstrap',
				'models/ProjectModel',
				'models/SolrResult',
				'models/DataONEObject',
				'views/DataCatalogView',
				'text!templates/project.html',
				'text!templates/projectHeader.html',
				'text!templates/about.html'],
	function($, _, Backbone, Bootstrap, Project, SolrResult, DataONEObject, DataCatalogView, ProjectTemplate, ProjectHeaderTemplate, testTemplate) {
	'use strict';

	// Our overall **AppView** is the top-level piece of UI.
	var ProjectView = Backbone.View.extend({

		el: '#Content',
		headerContainer: "#project-header-container",
		searchContainer: "#project-search-container",
		descriptionContainer: "#project-description-container",
		personnelContainer: "#project-personnel-container",

		type: "Project",

		template: _.template(ProjectTemplate),
		headerTemplate: _.template(ProjectHeaderTemplate),

		initialize: function () {
			this.DataCatalogView = new DataCatalogView();
			this.projectId = MetacatUI.appModel.get("projectId")

		},

		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering
		// and event handling to sub views
		render: function () {

			MetacatUI.appModel.set('headerType', 'default');

			this.getProjectModel(this.projectId);

			return this;
		},

		getProjectModel: function(projectId){

			this.model = new Project({ id: projectId });
			this.listenTo(this.model, 'change', this.renderProjectMetadata);
			this.model.fetch();

			MetacatUI.proj = this;
		},

		renderProjectMetadata: function(){

			this.$el.html(this.template());

			//Insert project header with title/synopsis
			this.insertHeader();

			//Insert project search
			//this.insertProjectSearch();

			//Insert project description
			this.insertProjectDescription();

			//Insert primary project personnel
			this.insertProjectPersonnel();

			MetacatUI.proj = this.model;

			//this.DataCatalogView.setElement(this.$('#Content')).render();
		},


		insertHeader: function() {
			this.$(this.headerContainer).html(this.headerTemplate({
				title : this.model.get('title'),
				synopsis : this.model.get('synopsis'),
				logo: 'http://salmon-net.org/wp-content/uploads/2018/04/SASAP-logo-higher-res-5x5-150x150.jpg'
			}));
		},

		insertProjectSearch: function(){
			//TODO change this to custom project search
			this.DataCatalogView.setElement(this.$(this.searchContainer)).render();
		},

		//TODO will need to parse markdown
		insertProjectDescription: function() {
			this.$(this.descriptionContainer).html(
				this.model.get('projectDescription')
			);
		},

		insertProjectPersonnel: function() {
			var container = this.$(this.personnelContainer);
			container.append("<h4 class='member-title'>Project Members</h4>");

			var personnelList = this.model.get('personnel');

			var primaryList = _.filter(personnelList, function(personnel){ return personnel.get("role").includes("primary") });
			MetacatUI.pi = primaryList;

			//TODO make this into columns, will probably need to iterate on index and add new rows as needed
			_.each(primaryList, function(personnel){
				container.append("<div><strong>" + personnel.get("givenName") + "</strong>, "
				+ personnel.get("positionName") + "<br>" + "Contact: " + personnel.get("email") + "</div>")
				//container.append("<div><strong>" + personnel.get("positionName") + "</strong></div>")
			});
		}

	});
	return ProjectView;
});
