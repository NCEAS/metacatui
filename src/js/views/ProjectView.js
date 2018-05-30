/*global define */
define(['jquery',
				'underscore',
				'backbone',
				'bootstrap',
				'models/ProjectModel',
				'models/CollectionModel',
				'models/SolrResult',
				'models/DataONEObject',
				'views/DataCatalogView',
				'text!templates/project.html',
				'text!templates/projectHeader.html',
				'text!templates/about.html'],
	function($, _, Backbone, Bootstrap, Project, Collection, SearchResults, DataONEObject, DataCatalogView, ProjectTemplate, ProjectHeaderTemplate, testTemplate) {
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

		events: {
			"click .nav-tabs a" : "showTab"
		},

		initialize: function () {
			this.projectId = MetacatUI.appModel.get("projectId");
			this.model = new Project();
			this.collectionModel = new Collection();

			return this;
		},

		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering
		// and event handling to sub views
		render: function () {

			MetacatUI.appModel.set('headerType', 'default');

			// Load the project model which contains the collection ID, then get the collection
			this.listenTo(this.model, 'change:projectCollection', this.getCollectionModel);

			// Render the project metadata after both the project model and colelction model have been loaded
			this.listenTo(this.collectionModel, 'change:id', this.renderProjectMetadata);

			this.getModel();

			MetacatUI.col = this.collectionModel;
			return this;
		},

		getModel: function(){
		 	this.model.set("id", this.projectId);
			this.model.fetch();
		},

		getCollectionModel: function(){
			this.collectionModel.set("id", this.model.get("projectCollection"));
			this.collectionModel.fetch();
		},

		renderProjectMetadata: function(){

			this.$el.html(this.template({ id: this.projectId }));

			//Insert project header with title/synopsis
			this.insertHeader();

			//Insert project search
			this.insertProjectSearch();

			//Insert project description
			this.insertProjectDescription();

			//Insert primary project personnel
			this.insertProjectPersonnel();
		},

		insertHeader: function() {
			this.$(this.headerContainer).html(this.headerTemplate({
				title : this.model.get('title'),
				synopsis : this.model.get('synopsis'),
				logo: 'https://dev.nceas.ucsb.edu/knb/d1/mn/v2/object/urn%3Auuid%3A4bb02544-d2d5-436a-9d37-8b77c3c31981'
			}));
		},

		insertProjectSearch: function(){
			//TODO pass Collection definition to catalog view

			var search = this.collectionModel.get('searchModel');
			var results = this.collectionModel.get('searchResults');

			MetacatUI.col2 = this.collectionModel;
			var view = new DataCatalogView({
				el: this.$("#project-search-results"),
				mode: "list",
				//searchModel: search,
			  //resultsModel: results,
				isSubView: true,
				filters : true
			});

			view.render();
			view.$(".auto-height").removeClass("auto-height").css("height", "auto");
		},

		//TODO will need to parse markdown
		insertProjectDescription: function() {
			this.$(this.descriptionContainer).html(
				this.model.get('projectDescription')
			);
		},

		insertProjectPersonnel: function() {
			this.$(this.personnelContainer).prepend("<h4 class='member-title'>Project Members</h4>");

			var personnelList = this.model.get('personnel');
			var primaryList = _.filter(personnelList, function(personnel){ return personnel.get("role").includes("primary") });

			var personnelHTML = "";

			for(var i=0; i<primaryList.length; i++){
				var personnel = primaryList[i];
				if(i%2 == 0) {
					personnelHTML += "<div class='row top-buffer'><div class='span6'><strong>" +
					personnel.get("givenName") + "</strong>, " + personnel.get("positionName") +
					"<br>" + "Contact: " + personnel.get("email") + "</div>";
				} else {
					personnelHTML += "<div class='span6'><strong>" + personnel.get("givenName") +
					"</strong>, " + personnel.get("positionName") + "<br>" +
					"Contact: " + personnel.get("email") + "</div></div>";
				}
			};

		  this.$("#members-list-continer").append(personnelHTML);
		},

		insertProjectLogos: function() {
			var logoList = this.model.get('logos');

		},

		//Need to hook this up - probably grab tabs by their data-section names so we don't have to see a different url
		showTab: function(e){
			e.preventDefault();

			//Get the clicked link
			var link = $(e.target);

			//Remove the active class from all links and add it to the new active link
			this.$(".nav-tabs li").removeClass("active");
			link.parent("li").addClass("active");

			//Hide all the panes and show the correct one
			this.$(".tab-pane").hide();
			this.$(link.attr("href")).show();
		},

	});
	return ProjectView;
});
