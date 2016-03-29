/*global define */
define(['jquery',
        'jqueryui',
		'underscore', 
		'backbone',
		'gmaps',
		'fancybox',
		'../../components/zeroclipboard/ZeroClipboard.min',
		'models/PackageModel',
		'models/SolrResult',
		'views/ProvChartView',
		'views/MetadataIndexView',
		'views/ExpandCollapseListView',
		'views/ProvStatementView',
		'views/PackageTableView',
		'views/AnnotatorView',
		'views/CitationView',
		'text!templates/metadata.html',
		'text!templates/dataSource.html',
		'text!templates/publishDOI.html',
		'text!templates/newerVersion.html',
		'text!templates/loading.html',
		'text!templates/metadataControls.html',
		'text!templates/usageStats.html',
		'text!templates/downloadButton.html',
		'text!templates/downloadContents.html',
		'text!templates/alert.html',
		'text!templates/editMetadata.html',
		'text!templates/dataDisplay.html',
		'text!templates/map.html'
		], 				
	function($, $ui, _, Backbone, gmaps, fancybox, ZeroClipboard, Package, SolrResult, 
			 ProvChart, MetadataIndex, ExpandCollapseList, ProvStatement, PackageTable, 
			 AnnotatorView, CitationView, MetadataTemplate, DataSourceTemplate, PublishDoiTemplate, 
			 VersionTemplate, LoadingTemplate, ControlsTemplate, UsageTemplate, DownloadButtonTemplate, 
			 DownloadContentsTemplate, AlertTemplate, EditMetadataTemplate, DataDisplayTemplate, 
			 MapTemplate, AnnotationTemplate) {
	'use strict';

	
	var MetadataView = Backbone.View.extend({
		
		subviews: [],
		
		pid: null,
		seriesId: null,
		
		model: new SolrResult(),
		packageModels: new Array(),

		el: '#Content',
		metadataContainer: "#metadata-container",
		citationContainer: "#citation-container",
		tableContainer:    "#table-container",
		controlsContainer: "#metadata-controls-container",
		ownerControlsContainer: "#owner-controls-container",
		breadcrumbContainer: "#breadcrumb-container",
		parentLinkContainer: "#parent-link-container",
		dataSourceContainer: "#data-source-container",
		
		type: "Metadata",
		
		//Templates
		template: _.template(MetadataTemplate),
		alertTemplate: _.template(AlertTemplate),
		doiTemplate: _.template(PublishDoiTemplate),
		usageTemplate: _.template(UsageTemplate),
		versionTemplate: _.template(VersionTemplate),
		loadingTemplate: _.template(LoadingTemplate),
		controlsTemplate: _.template(ControlsTemplate),
		dataSourceTemplate: _.template(DataSourceTemplate),
		downloadButtonTemplate: _.template(DownloadButtonTemplate),
		downloadContentsTemplate: _.template(DownloadContentsTemplate),
		editMetadataTemplate: _.template(EditMetadataTemplate),
		dataDisplayTemplate: _.template(DataDisplayTemplate),
		mapTemplate: _.template(MapTemplate),
				
		objectIds: [],
				
		// Delegated events for creating new items, and clearing completed ones.
		events: {
			"click #publish"             : "publish",
			"mouseover .highlight-node"  : "highlightNode",
			"mouseout  .highlight-node"  : "highlightNode"
		},
		
		initialize: function (options) {
			if((options === undefined) || (!options)) var options = {};

			this.pid = options.pid || options.id || appModel.get("pid") || null;
			
			if(typeof options.el !== "undefined")
				this.setElement(options.el);			
		},
				
		// Render the main metadata view
		render: function () {

			this.stopListening();
			
			appModel.set('headerType', 'default');
			this.showLoading("Loading...");
						
			//Reset various properties of this view first
			this.classMap = new Array();
			this.subviews = new Array();
			this.model.set(this.model.defaults);
			this.packageModels = new Array();
			
			// get the pid to render
			if(!this.pid)
				this.pid = appModel.get("pid");
			
			this.listenTo(appUserModel, "change:loggedIn", this.render);
						
			this.getModel();	
						
			return this;
		},
		
		/*
		 * Retrieves information from the index about this object, given the id (passed from the URL)
		 * When the object info is retrieved from the index, we set up models depending on the type of object this is
		 */
		getModel: function(pid){
			//Get the pid and sid
			if((typeof pid === "undefined") || !pid) var pid = this.pid;
			if((typeof this.seriesId !== "undefined") && this.seriesId) var sid = this.seriesId;

			var viewRef = this;
			
			//Get the package ID 
			this.model.set({ id: pid, seriesId: sid });
			var model = this.model;
			
			this.listenToOnce(model, "change", function(model){
					
				if(model.get("formatType") == "METADATA"){
					viewRef.model = model;
					viewRef.renderMetadata();
				}
				else if(model.get("formatType") == "DATA"){
					if(model.get("isDocumentedBy")){
						viewRef.pid = _.first(model.get("isDocumentedBy"));
						viewRef.getModel(viewRef.pid);
					}
					else
						viewRef.renderMetadataFromIndex();
				}
				else if(model.get("formatType") == "RESOURCE"){
					var packageModel = new Package({ id: model.get("id") });
					packageModel.on("complete", function(){
						viewRef.model = packageModel.getMetadata();
						viewRef.pid = viewRef.model.get("id");
						//viewRef.packageModels.push(packageModel);
						viewRef.renderMetadata();
						
						if(viewRef.model.get("resourceMap"))
							viewRef.getPackageDetails(viewRef.model.get("resourceMap"));	
					});
					packageModel.getMembers();
					return;
				}
				
				//Get the package information
				viewRef.getPackageDetails(model.get("resourceMap"));
				
			});
			this.listenToOnce(model, "404", this.showNotFound);
			model.getInfo();			
		},
		
		renderMetadata: function(){
			var pid = this.pid,
				view = this;
			
			this.hideLoading();
			//Load the template which holds the basic structure of the view
			this.$el.html(this.template());
			//Insert the breadcrumbs
			this.insertBreadcrumbs();
			//Insert the citation
			this.insertCitation();
			//Insert the data source logo
			this.insertDataSource();
			// is this the latest version? (includes DOI link when needed)
			this.showLatestVersion();
			//Insert package table if the package details haven't been inserted yet
			this.insertPackageDetails();
			//Insert controls
			this.insertControls();
			this.insertOwnerControls();

			//Show loading icon in metadata section
			this.$(this.metadataContainer).html(this.loadingTemplate({ msg: "Retrieving metadata ..." }));
			
			// Check for a view service in this appModel
			if((appModel.get('viewServiceUrl') !== undefined) && (appModel.get('viewServiceUrl'))) 
				var endpoint = appModel.get('viewServiceUrl') + pid;
					
			if(endpoint && (typeof endpoint !== "undefined")){
				var viewRef = this;
				var loadSettings = {
						url: endpoint,
						success: function(response, status, xhr) {						
							//Our fallback is to show the metadata details from the Solr index
							if (status=="error") 
								viewRef.renderMetadataFromIndex();
							else{
								//Check for a response that is a 200 OK status, but is an error msg
								if((response.length < 250) && (response.indexOf("Error transforming document") > -1)){
									viewRef.renderMetadataFromIndex();
									return;
								}
								
								//Mark this as a metadata doc with no stylesheet, or one that is at least different than usual EML and FGDC
								if(response.indexOf('id="Metadata"') == -1){
									viewRef.$el.addClass("container no-stylesheet");
									viewRef.renderMetadataFromIndex();
									return;
								}
								
								//Now show the response from the view service
								view.$(view.metadataContainer).html(response);
								
								//Add a map of the spatial coverage
								if(gmaps) viewRef.insertSpatialCoverageMap();
								
								//viewRef.insertDataSource();
								viewRef.alterMarkup();
								
								viewRef.setUpAnnotator();
							}
						},
						error: function(xhr, textStatus, errorThrown){
							view.renderMetadataFromIndex();
						}
				}
				
				$.ajax(_.extend(loadSettings, appUserModel.createAjaxSettings()));
			}
			else this.renderMetadataFromIndex();	
		},

		/* If there is no view service available, then display the metadata fields from the index */
		renderMetadataFromIndex: function(){
			var metadataFromIndex = new MetadataIndex({ 
				pid: this.pid, 
				parentView: this 
				});
			this.subviews.push(metadataFromIndex);
			
			//Add the metadata HTML
			this.$(this.metadataContainer).html(metadataFromIndex.render().el);
			
			//Add a map of the spatial coverage
			if(gmaps) this.insertSpatialCoverageMap();
			
			// render annotator from index content, too
			this.setUpAnnotator();			
		},
		
		removeCitation: function(){
			var citation = "",
				citationEl = null;
			
			//Find the citation element
			if(this.$(".citation").length > 0){
				//Get the text for the citation
				citation = this.$(".citation").text();
				
				//Save this element in the view
				citationEl = this.$(".citation");
			}
			//Older versions of Metacat (v2.4.3 and older) will not have the citation class in the XSLT. Find the citation another way 
			else{
				//Find the DOM element with the citation
				var wells = this.$('.well'),
					viewRef = this;		
				
				//Find the div.well with the citation. If we never find it, we don't insert the list of contents
				_.each(wells, function(well){
					if(!citationEl && ($(well).find('#viewMetadataCitationLink').length > 0) || ($(well).children(".row-fluid > .span10 > a"))){
						
						//Save this element in the view
						citationEl = well;
						
						//Mark this in the DOM for CSS styling
						$(well).addClass('citation');	
						
						//Save the text of the citation
						citation = $(well).text();
					}
				});
				
		    	//Remove the unnecessary classes that are used in older versions of Metacat (2.4.3 and older)
		    	var citationText = $(citationEl).find(".span10");
				$(citationText).removeClass("span10").addClass("span12");
			}
			
			//Set the document title to the citation
			appModel.set("title", citation);
			
			citationEl.remove();
			
		},
		
		insertBreadcrumbs: function(){
			
			var breadcrumbs = $(document.createElement("ol"))
						      .addClass("breadcrumb")
						      .append($(document.createElement("li"))
						    		  .addClass("home")
						    		  .append($(document.createElement("a"))
						    				  .attr("href", "#")
						    				  .addClass("home")
						    				  .text("Home")))
		    				  .append($(document.createElement("li"))
		    						  .addClass("search")
						    		  .append($(document.createElement("a"))
						    				  .attr("href", "#data/page/" + appModel.get("page"))
						    				  .addClass("search")
						    				  .text("Search")))
		    				  .append($(document.createElement("li"))
						    		  .append($(document.createElement("a"))
						    				  .attr("href", "#" + Backbone.history.fragment)
						    				  .addClass("inactive")
						    				  .text("Metadata")));
			
			if(uiRouter.lastRoute() == "data"){
				$(breadcrumbs).prepend($(document.createElement("a"))
						         .attr("href", "#data/page/" + appModel.get("page"))
						         .attr("title", "Back")
						         .addClass("back")
						         .text(" Back to search")
						         .prepend($(document.createElement("i"))
						        		  .addClass("icon-angle-left")));
				$(breadcrumbs).find("a.search").addClass("inactive");
			}
			
			this.$(this.breadcrumbContainer).html(breadcrumbs);
		},
		
		showNotFound: function(){
			//If we haven't checked the logged-in status of the user yet, wait a bit until we show a 404 msg, in case this content is their private content
			if(!appUserModel.get("checked")){
				this.listenToOnce(appUserModel, "change:checked", this.showNotFound);
				return;
			}
			
			if(!this.model.get("notFound")) return;
			
			var msg = "<h4>Nothing was found for one of the following reasons:</h4>" +
					  "<ul class='indent'>" +
					  	  "<li>The ID '" + this.pid  + "' does not exist.</li>" +
						  "<li>You do not have permission to view this content.</li>" +
						  "<li>The content was removed because it was invalid or inappropriate.</li>" +
					  "</ul>";
			this.hideLoading();
			this.showError(msg);
		},
		
		getPackageDetails: function(packageIDs){			
			var viewRef = this;
			
			var completePackages = 0;

			//This isn't a package, but just a lonely metadata doc...
			if(!packageIDs || !packageIDs.length){
				var thisPackage = new Package({ id: null, members: [this.model] });
				thisPackage.flagComplete();
				this.packageModels = [thisPackage];
				this.insertPackageDetails(thisPackage);
			}
			else{
				_.each(packageIDs, function(thisPackageID, i){
					
					//Create a model representing the data package
					var thisPackage = new Package({ id: thisPackageID });

					//Listen for any parent packages
					viewRef.listenToOnce(thisPackage, "change:parentPackageMetadata", viewRef.insertParentLink);

					//When the package info is fully retrieved
					viewRef.listenToOnce(thisPackage, 'complete', function(thisPackage){
	
						//When all packages are fully retrieved
						completePackages++;
						if(completePackages >= packageIDs.length){
							var latestPackages = _.filter(viewRef.packageModels, function(m){
								return(!m.get("obsoletedBy"));
							});
							viewRef.packageModels = latestPackages;
							viewRef.insertPackageDetails(latestPackages);
						}
					});
	
					//Save the package in the view
					viewRef.packageModels.push(thisPackage);
										
					//Get the members
					thisPackage.getMembers({getParentMetadata: true });	
				});	
			}
		},
		
		alterMarkup: function(){
			//Find the taxonomic range and give it a class for styling - for older versions of Metacat only (v2.4.3 and older)
			if(!this.$(".taxonomicCoverage").length)
				this.$('h4:contains("Taxonomic Range")').parent().addClass('taxonomicCoverage');
			
			//Remove the title section (redundant)
			var title = this.$(".control-group.title");
			if(!title.length){
				//Try to find the title label
				var titleLabel = this.$("label:contains('Titlell')");
				if(titleLabel.length && (titleLabel.text() == "Title")) 
					title = titleLabel.parents(".control-group");
				
				//Try to find the element with the title text
				if(!title.length){
					title = this.$(".controls:contains('" + this.model.get("title") + "')");
					if(title.length) title = title.parents(".control-group");
				}
			}
			if(title.length) title.detach();
			
		},
		
		/*
		 * Inserts a table with all the data package member information and sends the call to display annotations
		 */
		insertPackageDetails: function(packageModel){				
			if(this.$(".download-contents").length > 0) return;
			
			var viewRef = this;
						
			//Get the entity names from this page/metadata
			this.getEntityNames(this.packageModels);
			
			var latestPackages = _.filter(this.packageModels, function(m){
				return(!m.get("obsoletedBy"));
			});
			
			_.each(latestPackages, function(packageModel){

				//If the package model is not complete, don't do anything
				if(!packageModel.complete) return viewRef;
				
				//Insert a package table for each package in viewRef dataset
				if(packageModel.getNestedPackages().length > 0){
					var title = 'Current Data Set (1 of ' + (packageModel.getNestedPackages().length + 1) + ') <span class="subtle">Package: ' + packageModel.get("id") + '</span>';
					viewRef.insertPackageTable(packageModel, { title: title });
					
					_.each(packageModel.getNestedPackages(), function(nestedPackage, i, list){
						var title = 'Nested Data Set (' + (i+2) + ' of ' + (list.length+1) + ') <span class="subtle">Package: ' + nestedPackage.get("id") + '</span> <a href="#view/' + nestedPackage.get("id") + '">(View this dataset <i class="icon icon-external-link-sign icon-on-right"></i> ) </a>';
						viewRef.insertPackageTable(nestedPackage, { title: title, nested: true });
					});
					viewRef.getEntityNames(packageModel.getNestedPackages());

				}
				else{
					var title = packageModel.get("id") ? '<span class="subtle">Package: ' + packageModel.get("id") + '</span>' : "";
					title = "Files in this dataset " + title;
					viewRef.insertPackageTable(packageModel, {title: title});
				}
				
				//Remove the extra download button returned from the XSLT since the package table will have all the download links
				$("#downloadPackage").remove();
			    
			    //Show the provenance trace for viewRef package			
				if(packageModel.get("provenanceFlag") == "complete") 
					viewRef.drawProvCharts(packageModel);
				else{
					viewRef.listenToOnce(packageModel, "change:provenanceFlag", viewRef.drawProvCharts);
					packageModel.getProvTrace();
				}
			});
			
			//Collapse the table list after the first table
			var additionalTables = $(this.$("#additional-tables-for-" + this.cid)),
				numTables = additionalTables.children(".download-contents").length;
			if(numTables > 0){
				var expandIcon = $(document.createElement("i")).addClass("icon icon-level-down"),
					expandLink = $(document.createElement("a"))
								.attr("href", "#")
								.addClass("toggle-slide toggle-display-on-slide")
								.attr("data-slide-el", "additional-tables-for-" + this.cid)
								.text("Show " + numTables + " nested datasets")
								.prepend(expandIcon),
					collapseLink = $(document.createElement("a"))
								.attr("href", "#")
								.addClass("toggle-slide toggle-display-on-slide")
								.attr("data-slide-el", "additional-tables-for-" + this.cid)
								.text("Hide nested datasets")
								.hide(),
					expandControl = $(document.createElement("div")).addClass("expand-collapse-control").append(expandLink, collapseLink);
				
				additionalTables.before(expandControl);
			}
			
			//If this metadata doc is not in a package, but is just a lonely metadata doc...
			if(!this.packageModels.length){
				viewRef.insertPackageTable(this.model);
			}
			
			//Now insert the data details sections 
			this.insertDataDetails();
						
		    return this;
		},
		
		insertPackageTable: function(packageModel, options){
			var viewRef = this;
			
			if(options){
				var title = options.title || "";
				var nested = (typeof options.nested === "undefined")? false : options.nested;
			}
			else
				var title = "", nested = false;
			
			if(typeof packageModel === "undefined") return;
			
			//** Draw the package table **//	
			var tableView = new PackageTable({ 
				model: packageModel, 
				currentlyViewing: this.pid, 
				parentView: this,
				title: title,
				nested: nested
			});
			
			//Get the package table container
			var tablesContainer = this.$(this.tableContainer);
			
			//After the first table, start collapsing them
			var numTables = $(tablesContainer).find("table.download-contents").length;
			if(numTables == 1){
				var tableContainer = $(document.createElement("div")).attr("id", "additional-tables-for-" + this.cid);
				tableContainer.hide();
				$(tablesContainer).append(tableContainer);
			}
			else if(numTables > 1)
				var tableContainer = this.$("#additional-tables-for-" + this.cid);				
			else
				var tableContainer = tablesContainer;
			
			//Insert the package table HTML 
			$(tableContainer).append(tableView.render().el);
			
			this.subviews.push(tableView);
			
			//Hide the Metadata buttons that have no matching entity details section
			var count = 0;
			_.each($("#downloadContents .preview"), function(btn){
				if(!viewRef.findEntityDetailsContainer($(btn).attr("data-id"))){
					$(btn).hide();
					count++;
				}
			});
			if(count == $("#downloadContents .preview").length){
				$("td.more-info, th.more-info").hide();
				$("th.more-info-header").attr("colspan", $("th.more-info-header").attr("colspan")-1);
			}			
		},
		
		insertParentLink: function(packageModel){
			var parentPackageMetadata = packageModel.get("parentPackageMetadata"),
				view = this;
			
			_.each(parentPackageMetadata, function(m, i){
				var title = m.get("title"),
					icon = $(document.createElement("i")).addClass("icon icon-on-left icon-level-up"),
					link = $(document.createElement("a")).attr("href", "#view/" + m.get("id"))
														 .addClass("parent-link")
														 .text("Parent dataset: " + title)
														 .prepend(icon);
					
				view.$(view.parentLinkContainer).append(link);
			});
			
		},
				
		insertSpatialCoverageMap: function(customCoordinates){
			
			//Find the geographic region container. Older versions of Metacat (v2.4.3 and less) will not have it classified so look for the header text
			if(!this.$(".geographicCoverage").length){
				//For EML
				var title = this.$('h4:contains("Geographic Region")');
				
				//For FGDC
				if(title.length == 0){
					title = this.$('label:contains("Bounding Coordinates")');
				}
				
				var georegionEls = $(title).parent();
				var parseText = true;
				var directions = new Array('North', 'South', 'East', 'West');
			}
			else{
				var georegionEls = this.$(".geographicCoverage");
				var directions = new Array('north', 'south', 'east', 'west');
			}
			
			for(var i=0; i<georegionEls.length; i++){
				var georegion = georegionEls[i];
				
				if(typeof customCoordinates !== "undefined"){
					//Extract the coordinates
					var n = customCoordinates[0];
					var s = customCoordinates[1];
					var e = customCoordinates[2];
					var w = customCoordinates[3];
				}
				else{
					var coordinates = new Array();
					
					_.each(directions, function(direction){
						//Parse text for older versions of Metacat (v2.4.3 and earlier)
						if(parseText){
							var labelEl = $(georegion).find('label:contains("' + direction + '")');
							if(labelEl){
								var coordinate = $(labelEl).next().html();
								coordinate = coordinate.substring(0, coordinate.indexOf("&nbsp;"));
							}
						}
						else{
							var coordinate = $(georegion).find("." + direction + "BoundingCoordinate").attr("data-value");
						}
						
						//Save our coordinate value
						coordinates.push(coordinate);	
					});
					
					//Extract the coordinates
					var n = coordinates[0];
					var s = coordinates[1];
					var e = coordinates[2];
					var w = coordinates[3];
				}
				
				//Create Google Map LatLng objects out of our coordinates
				var latLngSW = new gmaps.LatLng(s, w);
				var latLngNE = new gmaps.LatLng(n, e);
				var latLngNW = new gmaps.LatLng(n, w);
				var latLngSE = new gmaps.LatLng(s, e);
				
				//Get the centertroid location of this data item
				var bounds = new gmaps.LatLngBounds(latLngSW, latLngNE);
				var latLngCEN = bounds.getCenter();

				var url = "https://maps.google.com/?ll=" + latLngCEN.lat() + "," + latLngCEN.lng() + 
						  "&spn=0.003833,0.010568" +
						  "&t=m" +
						  "&z=14";
				//Create a google map image
				var mapHTML = "<img class='georegion-map' " +
							  "src='https://maps.googleapis.com/maps/api/staticmap?" +
							  "center="+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&size=800x350" +
							  "&maptype=terrain" +
							  "&markers=size:mid|color:0xDA4D3Aff|"+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&path=color:0xDA4D3Aff|weight:3|"+latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&visible=" + latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&sensor=false" +
							  "&key=" + mapKey + "'/>";

				//Find the spot in the DOM to insert our map image
				if(parseText) var insertAfter = ($(georegion).find('label:contains("West")').parent().parent().length) ? $(georegion).find('label:contains("West")').parent().parent() :  georegion; //The last coordinate listed
				else 	      var insertAfter = georegion;
				$(insertAfter).append(this.mapTemplate({
					map: mapHTML,
					url: url
				}));
				
				$('.fancybox-media').fancybox({
					openEffect  : 'elastic',
					closeEffect : 'elastic',
					helpers: {
						media: {}
					}
				})
				
			}
			
			return true;

		},
		
		insertCitation: function(){
			if(!this.model) return false;
			
			//Create a citation element from the model attributes
			var citation = new CitationView({
									model: this.model, 
									createLink: false }).render().el;
			this.$(this.citationContainer).html(citation);	
		},
		
		insertDataSource: function(){
			if(!this.model || !nodeModel || !nodeModel.get("members").length || !this.$(this.dataSourceContainer).length) return;
			
			var dataSource = nodeModel.getMember(this.model);
			
			if(dataSource && dataSource.logo){
				this.$("img.data-source").remove();
				
				//Insert the data source template
				this.$(this.dataSourceContainer).html(this.dataSourceTemplate({
					node : dataSource
				})).addClass("has-data-source");
				this.$(this.citationContainer).addClass("has-data-source");
				this.$(".popover-this").popover();
				this.$(".tooltip-this").tooltip();
			}
		},
		
		/*
		 * Checks the authority for the logged in user for this dataset 
		 * and inserts control elements onto the page for the user to interact with the dataset - edit, publish, etc.
		 */
		insertOwnerControls: function(){
			//Don't display editing controls when we are pointing to a CN
			if(appModel.get("d1Service").toLowerCase().indexOf("cn") > -1)
				return false;
			
			//Do not show user controls for older versions of data sets
			if(this.model.get("obsoletedBy") && (this.model.get("obsoletedBy").length > 0))
				return false;
			
				
			var container = this.$(this.ownerControlsContainer);			
			
			//Save some references
			var pid     = this.model.get("id") || this.pid,
				model   = this.model,
				viewRef = this;

			this.listenToOnce(this.model, "change:isAuthorized", function(){
				if(!model.get("isAuthorized")) return false;

				//Insert the controls container
				var controlsEl = $(document.createElement("div")).addClass("authority-controls inline-buttons");
				$(container).html(controlsEl);
	
				//Insert an Edit button
				controlsEl.append(
					viewRef.editMetadataTemplate({
						identifier: pid
					}));
				
				//Insert a Publish button if its not already published with a DOI	
				if(!model.isDOI()){					
					//Insert the template
					controlsEl.append(
						viewRef.doiTemplate({
							isAuthorized: true,
							identifier: pid
						}));
				}
			});
			this.model.checkAuthority();
		},
		
		/*
		 * Inserts elements users can use to interact with this dataset:
		 * - A "Copy Citation" button to copy the citation text
		 */
		insertControls: function(){		
			//Get template
			var controlsContainer = this.controlsTemplate({
					citation: $(this.citationContainer).text(),
					url: window.location,
					model: this.model.toJSON()
				});

			$(this.controlsContainer).html(controlsContainer);
			
			//Create a copy citation button
			ZeroClipboard.config( { swfPath: "./components/zeroclipboard/ZeroClipboard.swf" } );
			var copyButtons = this.$("a.copy");
			var client = new ZeroClipboard(copyButtons);
			client.on("aftercopy", function(e){
				$(e.target).parent().children(".copy-success").show().delay(1000).fadeOut();
			});
			
			//Initialize the fancybox elements
			this.$(".fancybox").fancybox({
				transitionIn: "elastic"
			});
			this.$(".tooltip-this").tooltip();
		},
		
		/*
		 * Renders ProvChartViews on the page to display provenance on a package level and on an individual object level.
		 * This function looks at four sources for the provenance - the package sources, the package derivations, member sources, and member derivations 
		 */
		drawProvCharts: function(packageModel){
			//Provenance has to be retrieved from the Package Model (getProvTrace()) before the charts can be drawn 
			if(packageModel.get("provenanceFlag") != "complete") return false;
			
			var view = this;
			
			//Draw two flow charts to represent the sources and derivations at a package level			
			var packageSources     = packageModel.get("sourcePackages"),
				packageDerivations = packageModel.get("derivationPackages");

			if(Object.keys(packageSources).length){
				var sourceProvChart = new ProvChart({
					sources      : packageSources,
					context      : packageModel,
					contextEl    : this.$("#Metadata"),
					packageModel : packageModel,
					parentView   : view
				});	
				this.subviews.push(sourceProvChart);
				this.$("#Metadata").before(sourceProvChart.render().el).addClass("hasProvLeft");	
			}
			if(Object.keys(packageDerivations).length){
				var derivationProvChart = new ProvChart({
					derivations  : packageDerivations,
					context      : packageModel,
					contextEl    : this.$("#Metadata"),
					packageModel : packageModel,
					parentView   : view
				});		
				this.subviews.push(derivationProvChart);
				this.$("#Metadata").after(derivationProvChart.render().el).addClass("hasProvRight");			
			}			
			
			//Draw the provenance charts for each member of this package at an object level
			_.each(packageModel.get("members"), function(member, i){
				var entityDetailsSection = view.findEntityDetailsContainer(member.get("id"));

				//Retrieve the sources and derivations for this member
				var memberSources 	  = member.get("provSources") || new Array(),
					memberDerivations = member.get("provDerivations") || new Array();

				//Make the source chart for this member
				if(memberSources.length){
					var memberSourcesProvChart = new ProvChart({
						sources      : memberSources, 
						context      : member,
						contextEl    : entityDetailsSection,
						packageModel : packageModel,
						parentView   : view
					});	
					view.subviews.push(memberSourcesProvChart);
					$(entityDetailsSection).before(memberSourcesProvChart.render().el).addClass("hasProvLeft");
					view.$("#Metadata").addClass("gutters");
				}
				if(memberDerivations.length){
					//Make the derivation chart for this member
					var memberDerivationsProvChart = new ProvChart({
						derivations  : memberDerivations,
						context      : member,
						contextEl    : entityDetailsSection,
						packageModel : packageModel,
						parentView   : view
					});	
					view.subviews.push(memberDerivationsProvChart);
					$(entityDetailsSection).after(memberDerivationsProvChart.render().el).addClass("hasProvRight");				
					view.$("#Metadata").addClass("gutters");
				}
			});
			
			//Make all of the prov chart nodes look different based on id
			if(this.$(".prov-chart").length > 0){
				var allNodes = this.$(".prov-chart .node"),
				ids      = [],
				view     = this,
				i        = 1;
			
				$(allNodes).each(function(){ ids.push($(this).attr("data-id"))});
				ids = _.uniq(ids);
				
				_.each(ids, function(id){					
					var matchingNodes = view.$(".prov-chart .node[data-id='" + id + "']");
					//var matchingEntityDetails = view.findEntityDetailsContainer(id);
					
					//Don't use the unique class on images since they will look a lot different anyway by their image
					if(!$(matchingNodes).first().hasClass("image")){	
						var className = "uniqueNode" + i;
						//Add the unique class and up the iterator
						$(matchingNodes).addClass(className);
						
					/*	if(matchingEntityDetails)
							$(matchingEntityDetails).addClass(className);*/
						
						//Save this id->class mapping in this view
						view.classMap.push({ id        : id, 
											 className : className });
						i++;
					}
				});
			}
		},
		
		/*
		 * param dataObject - a SolrResult representing the data object returned from the index
		 * returns - true if this data object is an image, false if it is other
		 */
		isImage: function(dataObject){
			//The list of formatIds that are images
			var imageIds = ["image/gif",
			                "image/jp2",
			                "image/jpeg",
			                "image/png",
			                "image/svg xml",
			                "image/svg+xml",
			                "image/bmp"];
			
			//Does this data object match one of these IDs?
			if(_.indexOf(imageIds, dataObject.get('formatId')) == -1) return false;			
			else return true;
			
		},
		
		/*
		 * param dataObject - a SolrResult representing the data object returned from the index
		 * returns - true if this data object is a pdf, false if it is other
		 */
		isPDF: function(dataObject){
			//The list of formatIds that are images
			var ids = ["application/pdf"];
			
			//Does this data object match one of these IDs?
			if(_.indexOf(ids, dataObject.get('formatId')) == -1) return false;			
			else return true;			
		},
		
		getEntityNames: function(packageModels){
			var viewRef = this;

			_.each(packageModels, function(packageModel){
				
				//If this package has a different metadata doc than the one we are currently viewing
				var metadataModel = packageModel.getMetadata();
				if(!metadataModel) return;
				
				if(metadataModel.get("id") != viewRef.pid){
					var requestSettings = { 
						url: appModel.get("viewServiceUrl") + metadataModel.get("id"), 
						success: function(parsedMetadata, response, xhr){
							_.each(packageModel.get("members"), function(solrResult, i){
								var entityName = "";
								
								if(solrResult.get("formatType") == "METADATA")
									entityName = solrResult.get("title");
								
								var container = viewRef.findEntityDetailsContainer(solrResult.get("id"), parsedMetadata);
								if(container) entityName = viewRef.getEntityName(container);
								
								//Set the entity name
								if(entityName){
									solrResult.set("fileName", entityName);
									//Update the UI with the new name
									viewRef.$(".entity-name-placeholder[data-id='" + solrResult.get("id") + "']").text(entityName);
								}
							});
						}
					}

					$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));			

					return;
				}
				
				_.each(packageModel.get("members"), function(solrResult, i){
					
					var entityName = "";
					
					if(solrResult.get("fileName"))
						entityName = solrResult.get("fileName");
					else if(solrResult.get("formatType") == "METADATA")
						entityName = solrResult.get("title");
					else if(solrResult.get("formatType") == "RESOURCE")
						return;
					else{
						var container = viewRef.findEntityDetailsContainer(solrResult.get("id"));
						
						if(container && container.length > 0)
							entityName = viewRef.getEntityName(container);
						else
							entityName = null;
		
					}
					
					//Set the entityName, even if it's null
					solrResult.set("fileName", entityName);
				});
			});
		},
		
		getEntityName: function(containerEl){
			if(!containerEl) return false;
			
			var entityName = $(containerEl).find(".entityName").attr("data-entity-name");
			if((typeof entityName === "undefined") || (!entityName)){
				entityName = $(containerEl).find(".control-label:contains('Entity Name') + .controls-well").text();
				if((typeof entityName === "undefined") || (!entityName)) 
					entityName = null;
			}
			
			return entityName;
		},
		
		updateEntityName: function(){
			
		},
		
		findEntityDetailsContainer: function(id, el){
			if(!el) var el = this.el;
						
			//Are we looking for the main object that this MetadataView is displaying?
			if(id == this.pid){
				if(this.$("#Metadata").length > 0) return this.$("#Metadata");
				else return this.el;
			}
			else{
				//Metacat 2.4.2 and up will have the Online Distribution Link marked 
				var link = this.$(".entitydetails a[data-id='" + id + "']");
			}
			
			//Otherwise, try looking for an anchor with the id matching this object's id
			if(!link.length)
				link = $(el).find("a#" + id.replace(/[^A-Za-z0-9]/g, "-"));

			//Get metadata index view
			var metadataFromIndex = _.findWhere(this.subviews, {type: "MetadataIndex"});
			if(typeof metadataFromIndex === "undefined") metadataFromIndex = null;
			
			//Otherwise, find the Online Distribution Link the hard way 
			if((link.length < 1) && (!metadataFromIndex))
				link = $(el).find(".control-label:contains('Online Distribution Info') + .controls-well > a[href*='" + id + "']");
						
			if(link.length > 0){
				//Get the container element
				var container  = $(link).parents(".entitydetails"); 
				
				if(container.length < 1){
					//backup - find the parent of this link that is a direct child of the form element
					var firstLevelContainer = _.intersection($(link).parents("form").children(), $(link).parents());
					//Find the controls-well inside of that first level container, which is the well that contains info about this data object
					if(firstLevelContainer.length > 0)
						container = $(firstLevelContainer).children(".controls-well");
							
					if((container.length < 1) && (firstLevelContainer.length > 0))
						container = firstLevelContainer;
					
					$(container).addClass("entitydetails");
				}
				
				return container;
			}	
			else
				return false;
		},
		
		/*
		 * Inserts new image elements into the DOM via the image template. Use for displaying images that are part of this metadata's resource map.
		 */
		insertDataDetails: function(){
			//If there is a metadataIndex subview, render from there.
			var metadataFromIndex = _.findWhere(this.subviews, {type: "MetadataIndex"});
			if(typeof metadataFromIndex !== "undefined"){
				_.each(this.packageModels, function(packageModel){
					metadataFromIndex.insertDataDetails(packageModel);
				});
				return;
			}
			
			var viewRef = this;
			
			_.each(this.packageModels, function(packageModel){
			
				var dataDisplay = "",
					images = [],
					pdfs = [],
					other = [],
					packageMembers = packageModel.get("members");
							
				//==== Loop over each visual object and create a dataDisplay template for it to attach to the DOM ====
				for(var i=0; i < packageMembers.length; i++){
					var solrResult = packageMembers[i],
						objID      = solrResult.get("id");
					
					if(objID == viewRef.pid) continue;
									
					//Is this a visual object (image or PDF)?
					var type = solrResult.type == "SolrResult" ? solrResult.getType() : "Data set";
					if(type == "image")
						images.push(solrResult);
					else if(type == "PDF")
						pdfs.push(solrResult);
					
					//Find the part of the HTML Metadata view that describes this data object
					var anchor         = $(document.createElement("a")).attr("id", objID.replace(/[^A-Za-z0-9]/g, "-")),
						downloadButton = viewRef.downloadButtonTemplate({href: solrResult.get("url")}),
						container      = viewRef.findEntityDetailsContainer(objID),
						dataDisplay = viewRef.dataDisplayTemplate({
											 type : type,
											  src : solrResult.get("url"), 
										    objID : objID
						});
	
					//Insert the data display HTML and the anchor tag to mark this spot on the page 
					if(container){
						if((type == "image") || (type == "PDF")){
							if($(container).children("label").length > 0)
								$(container).children("label").first().after(dataDisplay);
							else
								$(container).prepend(dataDisplay);
						}
						$(container).prepend(anchor);
						
						var nameLabel = $(container).find("label:contains('Entity Name')");
						if(nameLabel.length > 0)
							$(nameLabel).parent().after(downloadButton);
					}				
				}
							
				//==== Initialize the fancybox images =====
				// We will be checking every half-second if all the HTML has been loaded into the DOM - once they are all loaded, we can initialize the lightbox functionality.
				var numImages  = images.length,
					numPDFS	   = pdfs.length,
					//The shared lightbox options for both images and PDFs
					lightboxOptions = {
							prevEffect	: 'elastic',
							nextEffect	: 'elastic',
							closeEffect : 'elastic',
							openEffect  : 'elastic',
							aspectRatio : true,
							closeClick : true,
							afterLoad  : function(){
								//Create a custom HTML caption based on data stored in the DOM element
								viewRef.title = viewRef.title + " <a href='" + viewRef.href + "' class='btn' target='_blank'>Download</a> ";
							},
							helpers	    : {
							    title : {
								      type : 'outside'
							    }
							}
					};
				
				if(numPDFS > 0){
					var numPDFChecks  = 0,
						lightboxPDFSelector = "a[class^='fancybox'][data-fancybox-iframe]";
					
					//Add additional options for PDFs
					var pdfLightboxOptions = lightboxOptions;
					pdfLightboxOptions.type = "iframe";
					pdfLightboxOptions.iframe = { preload: false };
					pdfLightboxOptions.height = "98%";
					
					var initializePDFLightboxes = function(){
						numPDFChecks++;
						
						//Initialize what images have loaded so far after 5 seconds
						if(numPDFChecks == 10){ 
							$(lightboxPDFSelector).fancybox(pdfLightboxOptions);
						}
						//When 15 seconds have passed, stop checking so we don't blow up the browser
						else if(numPDFChecks > 30){
							window.clearInterval(pdfIntervalID);
							return;
						}
						
						//Are all of our pdfs loaded yet?
						if(viewRef.$(lightboxPDFSelector).length < numPDFS) return;
						else{					
							//Initialize our lightboxes
							$(lightboxPDFSelector).fancybox(pdfLightboxOptions);
							
							//We're done - clear the interval
							window.clearInterval(pdfIntervalID);
						}				
					}
					
					var pdfIntervalID = window.setInterval(initializePDFLightboxes, 500);
				}
				
				if(numImages > 0){
					var numImgChecks  = 0, //Keep track of how many interval checks we have so we don't wait forever for images to load
						lightboxImgSelector = "a[class^='fancybox'][data-fancybox-type='image']";
						
					//Add additional options for images
					var imgLightboxOptions = lightboxOptions;
					imgLightboxOptions.type = "image";
					imgLightboxOptions.perload = 1;
					
					var initializeImgLightboxes = function(){
						numImgChecks++;
						
						//Initialize what images have loaded so far after 5 seconds
						if(numImgChecks == 10){ 
							$(lightboxImgSelector).fancybox(imgLightboxOptions);
						}
						//When 15 seconds have passed, stop checking so we don't blow up the browser
						else if(numImgChecks > 30){
							$(lightboxImgSelector).fancybox(imgLightboxOptions);
							window.clearInterval(imgIntervalID);
							return;
						}
						
						//Are all of our images loaded yet?
						if(viewRef.$(lightboxImgSelector).length < numImages) return;
						else{					
							//Initialize our lightboxes
							$(lightboxImgSelector).fancybox(imgLightboxOptions);
							
							//We're done - clear the interval
							window.clearInterval(imgIntervalID);
						}				
					}
					
					var imgIntervalID = window.setInterval(initializeImgLightboxes, 500);
				}
			});
		},
		
		/*
		 * Inserts new image elements into the DOM via the image template. Use for displaying images that are part of this metadata's resource map.
		 * param pdfs - an array of objects that represent the data objects returned from the index. Each should be a PDF
		 */
		insertPDFs: function(pdfs){
			var html = "",
			 viewRef = this;
		
			//Loop over each image object and create a dataDisplay template for it to attach to the DOM
			for(var i=0; i<pdfs.length; i++){
				//Find the part of the HTML Metadata view that describes this data object
				var container = this.$el.find("td:contains('" + pdfs[i].id + "')").parents(".controls-well");
				
				//Harvest the Object Name for an image caption 
				if(container !== undefined) var title = container.find("label:contains('Object Name')").next().text();
				else{
					var title = "";
					container = viewRef.el;
				}
				//Create an element using the dataDisplay template
				html = this.dataDisplayTemplate({
					 type : "pdf",
					  src : appModel.get('objectServiceUrl') + pdfs[i].id,
					title : title 
				});
	
				// Insert the element into the DOM
				$(container).append(html);				
			}
		
			//==== Initialize the fancybox images =====
			// We will be checking every half-second if all the images have been loaded into the DOM - once they are all loaded, we can initialize the lightbox functionality.
			var numPDFs  = pdfs.length,
				numChecks  = 0, //Keep track of how many interval checks we have so we don't wait forever for images to load 
				lightboxSelector = "a[class^='fancybox'][data-fancybox-iframe]",
				intervalID = window.setInterval(initializeLightboxes, 500);
			
			//Set up our lightbox options
			var lightboxOptions = {
					prevEffect	: 'elastic',
					nextEffect	: 'elastic',
					closeEffect : 'elastic',
					openEffect  : 'elastic',
					type 		: "iframe",
					aspectRatio : true,
					helpers	    : {
						    title : {
							      type : 'outside'
						    }
					},
				   iframe	  : {
					   		preload : false
				   },
				   closeClick : true,
				   afterLoad  : function(){
					   //Create a custom HTML caption based on data stored in the DOM element
					   this.title = this.title + " <a href='" + this.href + "' class='btn' target='_blank'>Download</a> ";
				   }
			}
		
			function initializeLightboxes(){
				numChecks++;
				
				//Initialize what images have loaded so far after 5 seconds
				if(numChecks == 10){ 
					$(lightboxSelector).fancybox(lightboxOptions);
				}
				//When 15 seconds have passed, stop checking so we don't blow up the browser
				else if(numChecks > 30){
					window.clearInterval(intervalID);
					return;
				}
				
				//Are all of our pdfs loaded yet?
				if(viewRef.$(lightboxSelector).length < numPDFs) return;
				else{					
					//Initialize our lightboxes
					$(lightboxSelector).fancybox(lightboxOptions);
					
					//We're done - clear the interval
					window.clearInterval(intervalID);
				}				
			}
		},
		
		replaceEcoGridLinks: function(pids){
			var viewRef = this;
			
			//Find the element in the DOM housing the ecogrid link
			$("label:contains('Online Distribution Info')").next().each(function(){
				var link = $(this).find("a:contains('ecogrid://')");
				_.each(link, function(thisLink){
					
					//Get the link text
					var linkText = $(thisLink).text();
					
					//Clean up the link text
					var start = linkText.lastIndexOf("/");
					var ecogridPid = linkText.substr(start+1);
					
					//Iterate over each id in the package and try to fuzzily match the ecogrid link to the id
					for(var i = 0; i < pids.length; i++){
						
						//If we find a match, replace the ecogrid links with a DataONE API link to the object
						if(pids[i].indexOf(ecogridPid) > -1){
							
							$(thisLink).attr('href', appModel.get('objectServiceUrl') + encodeURIComponent(pids[i]));
							$(thisLink).text(pids[i]);
							
							//Insert an anchor at the parent element that contains the data object detials
							var parents = $(thisLink).parents();
							_.each(parents, function(parent){
								if($(parent).hasClass("dataTableContainer"))
									$(parent).prepend('<a name="' + pids[i] + '"></a>');
							});
														
							//We can stop looking at the pids now
							i = pids.length;
						}
					}
				});			
				
			});
		},
		
		publish: function(event) {
			
			// target may not actually prevent click events, so double check
			var disabled = $(event.target).closest("a").attr("disabled");
			if (disabled) {
				return false;
			}
			var publishServiceUrl = appModel.get('publishServiceUrl');
			var pid = $(event.target).closest("a").attr("pid");
			var ret = confirm("Are you sure you want to publish " + pid + " with a DOI?");
			
			if (ret) {
				
				// show the loading icon
				var message = "Publishing package...this may take a few moments";
				this.showLoading(message);
				
				var identifier = null;
				var viewRef = this;
				var requestSettings = {
						url: publishServiceUrl + pid,
						type: "PUT",
						xhrFields: {
							withCredentials: true
						},
						success: function(data, textStatus, xhr) {
							// the response should have new identifier in it
							identifier = $(data).find("d1\\:identifier, identifier").text();
						
							if (identifier) {
								viewRef.hideLoading();
								var msg = "Published data package '" + identifier + "'. If you are not redirected soon, you can view your <a href='#view/" + identifier + "'>published data package here</a>";
								viewRef.$el.find('.container').prepend(
										viewRef.alertTemplate({
											msg: msg,
											classes: 'alert-success'
										})
								);
								
								// navigate to the new view after a few seconds
								setTimeout(
										function() {
											// avoid a double fade out/in
											viewRef.$el.html('');
											viewRef.showLoading();
											uiRouter.navigate("view/" + identifier, {trigger: true})
										}, 
										3000);
							}
						},
						error: function(xhr, textStatus, errorThrown) {
							// show the error message, but stay on the same page
							var msg = "Publish failed: " + $(xhr.responseText).find("description").text();
							
							viewRef.hideLoading();
							viewRef.showError(msg);
						}
					}
				
				$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));			
				
			}
		},
		
		// this will lookup the latest version of the PID
		showLatestVersion: function(pid) {	
			if(!pid){
				//Is this obsoleted by something else?
				var pid = this.model.get("obsoletedBy");			
				if(!pid) return;
			}
				
			// look up the metadata service URL. It may be turned off
			var metaServiceUrl = appModel.get('metaServiceUrl');			
			if((typeof metaServiceUrl === "undefined") || !metaServiceUrl) return;
			
			// look up the meta
			var viewRef = this,
				encodedPid = encodeURIComponent(pid);
			var requestSettings = {
				url: metaServiceUrl + encodedPid, 
				type: "GET",
				success: function(data, textStatus, xhr) {
							
					// the response should have a obsoletedBy element
					var newestVersion = $(data).find("obsoletedBy").text();
							
					if (newestVersion) {						
						viewRef.showLatestVersion(newestVersion);
					} else {
						viewRef.$el.prepend(viewRef.versionTemplate({pid: pid}));			
					}
				}
			}
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));			
		},
		
		showLoading: function(message) {
			this.hideLoading();
			
			appView.scrollToTop();
			
			var loading = this.loadingTemplate({ msg: message });
			if(!loading) return;
			
			this.$loading = $($.parseHTML(loading));
			this.$detached = this.$el.children().detach();
			
			this.$el.html(loading);
		},
		
		hideLoading: function() {
			if(this.$loading)  this.$loading.remove();
			if(this.$detached) this.$el.html(this.$detached);
		},
		
		showError: function(msg){
			this.$el.prepend(
				this.alertTemplate({
					msg: msg,
					classes: 'alert-error',
					containerClasses: "page",
					includeEmail: true
				}));	
		},
		
		setUpAnnotator: function() {
			if(!appModel.get("annotatorUrl")) return;
			
			
			var annotator = new AnnotatorView({ 
				parentView: this 
				});
			this.subviews.push(annotator);
			annotator.render();
		},
		
		/**
		 * When the "Metadata" button in the table is clicked while we are on the Metadata view, 
		 * we want to scroll to the anchor tag of this data object within the page instead of navigating
		 * to the metadata page again, which refreshes the page and re-renders (more loading time)
		 **/
		previewData: function(e){
			//Don't go anywhere yet...
			e.preventDefault();
			
			//Get the target and id of the click
			var button = $(e.target);
			if(!$(button).hasClass("preview")) 
				button = $(button).parents("a.preview");

			if(button){
				var id = $(button).attr("data-id");
				if((typeof id === "undefined") || !id) 
					return false; //This will make the app defualt to the child view previewData function
			}
			else
				return false;
			
			//If we are on the Metadata view, then let's scroll to the anchor
			appView.scrollTo(this.findEntityDetailsContainer(id));	
			
			return true;
		},
		
		closePopovers: function(e){
			if($(e.target).hasClass("popover-this") || 
			  ($(e.target).parents(".popover-this").length > 0)  || 
			  ($(e.target).parents(".popover").length > 0) ||
			  $(e.target).hasClass("popover")) return;
			
			//Close all active popovers
			this.$(".popover-this.active").popover("hide");
		},
		
		highlightNode: function(e){
			//Find the id
			var id = $(e.target).attr("data-id");
			
			if((typeof id === "undefined") || (!id))
				id = $(e.target).parents("[data-id]").attr("data-id");
			
			//If there is no id, return
			if(typeof id === "undefined") return false;
			
			//Highlight its node
			$(".prov-chart .node[data-id='" + id + "']").toggleClass("active");
			
			//Highlight its metadata section
			if(appModel.get("pid") == id)
				this.$("#Metadata").toggleClass("active");
			else{
				var entityDetails = this.findEntityDetailsContainer(id);
				if(entityDetails)
					entityDetails.toggleClass("active");
			}
		},
		
		onClose: function () {	
			var viewRef = this;
			
			this.stopListening();
			
			_.each(this.subviews, function(subview) {
				if(subview.el != viewRef.el)
					subview.remove();
			});
			
			this.packageModels =  new Array();
			this.model.set(this.model.defaults);
			this.pid = null;
			this.seriesId = null;
			this.$detached = null;
			this.$loading = null;
			
			//Put the document title back to the default
			appModel.set("title", appModel.defaults.title);
			
			//Remove view-specific classes
			this.$el.removeClass("container no-stylesheet");
			
			this.$el.empty();			
		}
		
	});
	
	return MetadataView;		
});
