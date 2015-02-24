/*global define */
define(['jquery',
        'jqueryui',
		'underscore', 
		'backbone',
		'gmaps',
		'fancybox',
		'models/PackageModel',
		'models/SolrResult',
		'views/ProvChartView',
		'views/MetadataIndexView',
		'views/ExpandCollapseListView',
		'views/ProvStatementView',
		'views/PackageTableView',
		'views/AnnotatorView',
		'text!templates/publishDOI.html',
		'text!templates/newerVersion.html',
		'text!templates/loading.html',
		'text!templates/usageStats.html',
		'text!templates/downloadContents.html',
		'text!templates/alert.html',
		'text!templates/editMetadata.html',
		'text!templates/dataDisplay.html',
		'text!templates/map.html'
		], 				
	function($, $ui, _, Backbone, gmaps, fancybox, Package, SolrResult, ProvChart, MetadataIndex, ExpandCollapseList, ProvStatement, PackageTable, AnnotatorView, PublishDoiTemplate, VersionTemplate, LoadingTemplate, UsageTemplate, DownloadContentsTemplate, AlertTemplate, EditMetadataTemplate, DataDisplayTemplate, MapTemplate, AnnotationTemplate) {
	'use strict';

	
	var MetadataView = Backbone.View.extend({
		
		subviews: {},

		el: '#Content',
		
		template: null,
						
		alertTemplate: _.template(AlertTemplate),

		doiTemplate: _.template(PublishDoiTemplate),
		
		usageTemplate: _.template(UsageTemplate),

		versionTemplate: _.template(VersionTemplate),
		
		loadingTemplate: _.template(LoadingTemplate),
		
		downloadContentsTemplate: _.template(DownloadContentsTemplate),
		
		editMetadataTemplate: _.template(EditMetadataTemplate),
		
		dataDisplayTemplate: _.template(DataDisplayTemplate),
		
		mapTemplate: _.template(MapTemplate),
				
		objectIds: [],
		
		DOI_PREFIXES: ["doi:10.", "http://dx.doi.org/10.", "http://doi.org/10."],
		
		// Delegated events for creating new items, and clearing completed ones.
		events: {
			"click #publish" : "publish"
		},
		
		initialize: function (options) {
			if((options === undefined) || (!options)) var options = {};

			this.pid = options.pid || options.id || appModel.get("pid") || null;
		},
				
		// Render the main metadata view
		render: function () {

			appModel.set('headerType', 'default');
			
			// get the pid to render
			if(!this.pid){
				var pid = appModel.get("pid");
				this.pid = pid;
			}
			else var pid = this.pid;
			
			// URL encode the pid
			this.encodedPid = encodeURIComponent(pid);
			
			// Check for a view service in this appModel
			if((appModel.get('viewServiceUrl') !== undefined) && (appModel.get('viewServiceUrl'))) var endpoint = appModel.get('viewServiceUrl') + pid + ' #Metadata';
					
			if(endpoint && (endpoint !== undefined)){
				var viewRef = this;
				this.$el.load(endpoint,
						function(response, status, xhr) {
							//Our fallback is to show the metadata details from the Solr index
							if (status=="error") viewRef.renderMetadataFromIndex();
							else{															
								//Find the taxonomic range and give it a class for styling
								$('#Metadata').find('h4:contains("Taxonomic Range")').parent().addClass('taxonomic-range');
								
								viewRef.$el.fadeIn("slow");

								//Get the package details from the index, too
								viewRef.getPackageDetails();
								//Add a map of the spatial coverage
								if(gmaps) viewRef.insertSpatialCoverageMap();
							}
							// render annotator either way
							viewRef.setUpAnnotator();
						});
			}
			else this.renderMetadataFromIndex();
			
			// is this the latest version? (includes DOI link when needed)
			this.showLatestVersion(pid);		
						
			return this;
		},

		/* If there is no view service available, then display the metadata fields from the index */
		renderMetadataFromIndex: function(){
			this.subviews.metadataFromIndex = new MetadataIndex({ 
					pid: this.pid, 
					parentView: this 
					});

			//Get the package details from the index, too
			this.getPackageDetails();
			
			//Add the package details once the metadata from the index is drawn 
			this.listenToOnce(this.subviews.metadataFromIndex, 'complete', this.insertPackageDetails);

			//Add the metadata HTML
			this.$el.append(this.subviews.metadataFromIndex.render().el);	
			
			//Add a map of the spatial coverage
			if(gmaps) this.insertSpatialCoverageMap();
			
			// render annotator from index content, too
			this.setUpAnnotator();
		},
		
		insertBackLink: function(){
			if(uiRouter.lastRoute() == "data") {
				var insertInto = this.$el.children()[0] || this.el;
				$(insertInto).prepend('<a href="#data" title="Back"><i class="icon-angle-left"></i> Back to search</a>');
			}
		},
		
		/*
		 * Creates a package model and retrieves the info about all members of that package 
		 */
		getPackageDetails: function(pid) {
			var viewRef = this;
			
			//If no id is passed, used the one in the appModel
			if((typeof pid === "undefined") || !pid) var pid = this.pid;
			
			//Create a model representing the data package
			this.packageModel = new Package();
			this.listenToOnce(this.packageModel, 'complete', this.insertPackageDetails);
			this.packageModel.getMembersByMemberID(pid);
		},
		
		/*
		 * Inserts a table with all the data package member information and sends the call to display annotations
		 */
		insertPackageDetails: function(){	
			var viewRef = this;
			
			// There are two different events that are calling this function - when the MetadataIndexView is complete
			// and when the Package model is complete. We need to make sure both are done before inserting the package details.
			// If we are not rendering the metadata from the index and the package model is complete, we can continue.
			if((this.subviews.metadataFromIndex) && !this.subviews.metadataFromIndex.complete) return this;
			if(!this.packageModel.complete) return this;
				
			//*** Find the DOM element to append the HTML to. We want to create a new div underneath the first well with the citation
			var wells = viewRef.$el.find('.well');		
			//Find the div.well with the citation. If we never find it, we don't insert the list of contents
			_.each(wells, function(well){
				if($(well).find('#viewMetadataCitationLink').length > 0){
					
					//Save this element in the view
					viewRef.citationEl = well;
					
					//Mark this in the DOM for CSS styling
					$(well).addClass('citation');					
				}
			});
			//Otherwise, just find the first element with a citation class or just use the first well - useful for when we display the metadata from the indexed fields
			if(!this.citationEl) this.citationEl = this.$('.citation')[0] || wells[0];
			
			//** Draw the package table **//	
			var tableView = new PackageTable({ model: this.packageModel });
			//Get the package table container
			var tableContainer = this.$("#downloadContents");
			if(!$(tableContainer).length){
				tableContainer = $(document.createElement("div")).attr("id", "downloadContents");
				$(this.citationEl).after(tableContainer);
			}
			//Insert the package table HTML 
			$(tableContainer).html(tableView.render().el);
			
						
			//** Move the download button to our download content list area **//
		    $("#downloadPackage").detach();
		    var citationText = $(this.citationEl).find(".span10");
		    				   $(citationText).removeClass("span10");
		    				   $(citationText).addClass("span12");
		    				
		    	   
		    //Display the images in this package
		    this.insertDataDetails();
		    //Show annotations about this package
		    this.showProvenance();
		    
		    return this;
		},
				
		insertSpatialCoverageMap: function(coordinates){
			
			var georegionEls = this.$el.find('h4:contains("Geographic Region")');
			for(var i=0; i<georegionEls.length; i++){
				var parentEl = $(georegionEls[i]).parent();
				
				if(coordinates === undefined){
					var coordinates = new Array();
					var directions = new Array('North', 'South', 'East', 'West');
					
					_.each(directions, function(direction){
						var labelEl = $(parentEl).find('label:contains("' + direction + '")');
						if(labelEl){
							var coordinate = $(labelEl).next().html();
							coordinate = coordinate.substring(0, coordinate.indexOf("&nbsp;"));
							coordinates.push(coordinate);	
						}
					});
				}
				
				//Extract the coordinates
				var n = coordinates[0];
				var s = coordinates[1];
				var e = coordinates[2];
				var w = coordinates[3];
				
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
						  "&t=h" +
						  "&z=17";
				//Create a google map image
				var mapHTML = "<img class='georegion-map' " +
							  "src='https://maps.googleapis.com/maps/api/staticmap?" +
							  "center="+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&size=650x250" +
							  "&maptype=terrain" +
							  "&markers=size:mid|color:0xDA4D3Aff|"+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&path=color:0xDA4D3Aff|weight:3|"+latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&visible=" + latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&sensor=false" +
							  "&key=" + mapKey + "'/>";

				//Find the spot in the DOM to insert our map image
				var lastEl = ($(parentEl).find('label:contains("West")').parent().parent().length) ? $(parentEl).find('label:contains("West")').parent().parent() :  parentEl; //The last coordinate listed
				lastEl.append(this.mapTemplate({
					map: mapHTML,
					url: url
				}));
				
				$('.fancybox-media').fancybox({
					openEffect: 'elastic',
					closeEffect: 'elastic',
					helpers: {
						media: {}
					}
				})
				
			}
			
			return true;

		},
		
		/*
		 * showProvenance
		 * Display details about the package
		 */
		showProvenance: function(){

			var packageMembers = this.packageModel.get('members');
			var view = this;

			//Create provenance statements about this document if there are any prov annotations
			_.each(packageMembers, function(member){
				var provenanceEl = new ProvStatement().render(member).el;
						
				//Insert the provenance statements
				var container = $('[data-obj-id=" + member.id + "]').find(".provenance-container");
				if($(container).length > 0) $(container).prepend(provenanceEl);
			});
			
			this.listenToOnce(this.packageModel, "change:provenanceFlag", this.drawProvChart);
			this.packageModel.getProvTrace();
		},
		
		//Seperate out the development provenance chart-drawing stuff for now... "faking" some data until the index is populated
		drawProvChart: function(){
			if(this.packageModel.get("provenanceFlag") != "complete") return false;
			
			var view = this;
			
			var packageSources     = this.packageModel.get("sourcePackages"),
				packageDerivations = this.packageModel.get("derivationPackages");

			if(packageSources.length){
				//Draw a flow chart to represent the sources and derivations at a package level
				var sourceProvChart = new ProvChart({
					sources: packageSources,
					context: this.packageModel
				});	
				this.$("#Metadata").before(sourceProvChart.render().el);	
				this.$("#Metadata").addClass("hasProvLeft");
				var chartHeight = sourceProvChart.$el.height() + sourceProvChart.nodeHeight;
				if(this.$("#Metadata").height() < chartHeight)
					this.$("#Metadata").height((chartHeight));
			}
			if(packageDerivations.length){
				var derivationProvChart = new ProvChart({
					derivations: packageDerivations,
					context: this.packageModel
				});		
				this.$("#Metadata").after(derivationProvChart.render().el);
				this.$("#Metadata").addClass("hasProvRight");
				var chartHeight = derivationProvChart.$el.height() + derivationProvChart.nodeHeight;
				if(this.$("#Metadata").height() < chartHeight)
					this.$("#Metadata").height((chartHeight));			
			}			
			
			//Draw the provenance chart for each member of this package at an object level
			_.each(this.packageModel.get("members"), function(member, i){
				var entityDetailsSection = view.$('.entityDetails[data-id="' + member.get("id") + '"]');

				//Find the sources for this members
				var memberSources = member.get("provSources"),
					memberDerivations = member.get("provDerivations");
				
				if(memberSources.length){
					//Make the source chart for this member
					var memberSourcesProvChart = new ProvChart({
						sources: memberSources,
						context: member
					});	
					$(entityDetailsSection).before(memberSourcesProvChart.render().el);
					$(entityDetailsSection).addClass("hasProvLeft");
					var chartHeight = memberSourcesProvChart.$el.height() + memberSourcesProvChart.nodeHeight;
					if($(entityDetailsSection).height() < chartHeight)
						$(entityDetailsSection).height((chartHeight));	
				}
				if(memberDerivations.length){
					//Make the derivation chart for this member
					var memberDerivationsProvChart = new ProvChart({
						derivations: memberDerivations,
						context: member
					});	
					$(entityDetailsSection).after(memberDerivationsProvChart.render().el);
					$(entityDetailsSection).addClass("hasProvRight");	
					var chartHeight = memberDerivationsProvChart.$el.height() + memberDerivationsProvChart.nodeHeight;
					if($(entityDetailsSection).height() < chartHeight)
						$(entityDetailsSection).height((chartHeight));				
				}
			});
		},
		
		// checks if the pid is already a DOI
		isDOI: function(pid) {
			for (var i=0; i < this.DOI_PREFIXES.length; i++) {
				if (pid.toLowerCase().indexOf(this.DOI_PREFIXES[i].toLowerCase()) == 0) {
					return true;
				}
			}
			return false;
				
		},
		
		// this will insert the DOI publish button
		insertDoiButton: function(pid) {
						
			// first check if already a DOI
			if (this.isDOI(pid)) {
				console.log(pid + " is already a DOI");
				return;
			}
			
			var encodedPid = encodeURIComponent(pid);

			// see if the user is authorized to update this object
			var authServiceUrl = appModel.get('authServiceUrl');

			// look up the SystemMetadata
			var metaServiceUrl = appModel.get('metaServiceUrl');
			if((typeof metaServiceUrl === "undefined") || !metaServiceUrl) return;

			// systemMetadata to render
			var identifier = null;
			var formatId = null;
			var size = null;
			var checksum = null;
			var rightsHolder = null;
			var submitter = null;
			
			var viewRef = this;
						
			// get the /meta for the pid
			$.get(
				metaServiceUrl + encodedPid,
				function(data, textStatus, xhr) {
					
					// the response should have all the elements we want
					identifier = $(data).find("identifier").text();
					formatId = $(data).find("formatId").text();
					size = $(data).find("size").text();
					checksum = $(data).find("checksum").text();
					rightsHolder = $(data).find("rightsHolder").text();
					submitter = $(data).find("submitter").text();

					if (identifier) {
						
						var populateTemplate = function(auth) {
							// TODO: include SystemMetadata details						
							viewRef.$el.find("#viewMetadataCitationLink").after(
								viewRef.doiTemplate({
									isAuthorized: auth,
									identifier: identifier,
									formatId: formatId,
									size: size,
									checksum: checksum,
									rightsHolder: rightsHolder,
									submitter: submitter
								})
							);
						};
						
						// are we authorized to publish?
						$.ajax({
								url: authServiceUrl + encodedPid + "?action=changePermission",
								type: "GET",
								xhrFields: {
									withCredentials: true
								},
								success: function(data, textStatus, xhr) {
									populateTemplate(true);
									viewRef.insertEditLink(pid);
								},
								error: function(xhr, textStatus, errorThrown) {
									console.log('Not authorized to publish');
								}
							});
					}
					
				}
			);
			
			
				
		},
		
		insertEditLink: function(pid) {
			this.$el.find("#viewMetadataCitationLink").after(
					this.editMetadataTemplate({
						identifier: pid
					}));
			//this.$el.find("#viewMetadataCitationLink").after("<a href='#share/modify/" + pid + "'>Edit</a>");
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
			                "image/tiff",
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
		
		/*
		 * Inserts new image elements into the DOM via the image template. Use for displaying images that are part of this metadata's resource map.
		 */
		insertDataDetails: function(){
			//If there is a metadataIndex subview, render from there.
			if(this.subviews.metadataFromIndex) this.subviews.metadataFromIndex.insertDataDetails();

			var dataDisplay = "",
				viewRef = this,
				images = [],
				pdfs = [],
				other = [],
				entityDetailsContainers = this.$el.find(".entitydetails"),
				packageMembers = this.packageModel.get("members");
						
			//==== Loop over each visual object and create a dataDisplay template for it to attach to the DOM ====
			for(var i=0; i<packageMembers.length; i++){
				var type = "";
				
				//Make sure this is a visual object (image or PDF)
				if(this.isImage(packageMembers[i])){
					type = "image";
					images.push(packageMembers[i]);
				}
				else if(this.isPDF(packageMembers[i])){
					type = "pdf";
					pdfs.push(packageMembers[i]);
				}
				else if (packageMembers[i].get('formatType') == "METADATA"){
					continue;
				}
				else{
					type = "other";
					other.push(packageMembers[i]);
				}
				
				//Find the part of the HTML Metadata view that describes this data object
				var container = $(entityDetailsContainers).find(":contains('" + packageMembers[i].get("id") + "')").parents(".entitydetails");					
				var title = "";
					
				//Harvest the Entity Name for a lightbox caption 
				if(!container.length)
					title = $(entityDetailsContainers).find("label:contains('Entity Name')").next().text();
						
				if(!container.length && !title) 
					title = $(entityDetailsContainers).find("label:contains('Object Name')").next().text();
					
				var objID = packageMembers[i].get("id");
					
				//Create HTML for the visuals using the dataDisplay template
				dataDisplay = this.dataDisplayTemplate({
						 type : type,
						  src : appModel.get('objectServiceUrl') + packageMembers[i].get("id"),
						title : title,
					   objID : objID
				});
				
				// Insert the HTML into the DOM 
				if(!title) $(entityDetailsContainers).after(dataDisplay);	
				else 	   $(container).prepend(dataDisplay);	
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
							this.title = this.title + " <a href='" + this.href + "' class='btn' target='_blank'>Download</a> ";
						},
						helpers	    : {
						    title : {
							      type : 'outside'
						    }
						}
				};
			
			if(numPDFS > 0){
				var numPDFChecks  = 0,
					lightboxPDFSelector = "a[class^='fancybox'][data-fancybox-iframe]",
					pdfIntervalID = window.setInterval(initializePDFLightboxes, 500);
				
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
					if(viewRef.$(lightboxPDFSelector).length < numPDFs) return;
					else{					
						//Initialize our lightboxes
						$(lightboxPDFSelector).fancybox(pdfLightboxOptions);
						
						//We're done - clear the interval
						window.clearInterval(pdfIntervalID);
					}				
				}
				
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
				var message = "Publishing package...please be patient";
				this.showLoading(message);
				
				var identifier = null;
				var viewRef = this;
				$.ajax({
						url: publishServiceUrl + pid,
						type: "PUT",
						xhrFields: {
							withCredentials: true
						},
						success: function(data, textStatus, xhr) {
							// the response should have new identifier in it
							identifier = $(data).find("d1\\:identifier, identifier").text();
						
							console.log('identifier: ' + identifier);
							if (identifier) {
								viewRef.hideLoading();
								var msg = "Published package '" + identifier + "'";
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
							viewRef.$el.find('.container').prepend(
									viewRef.alertTemplate({
										msg: msg,
										classes: 'alert-error',
										includeEmail: true
									})
							);
						}
					}
				);
				
			}
		},
		
		// this will lookup the latest version of the PID
		showLatestVersion: function(pid, traversing) {
			var obsoletedBy = null,
				encodedPid = encodeURIComponent(pid);
			
			// look up the metadata service URL. It may be turned off
			var metaServiceUrl = appModel.get('metaServiceUrl');			
			if((typeof metaServiceUrl === "undefined") || !metaServiceUrl) return;
			
			// look up the meta
			var viewRef = this;
			$.get(metaServiceUrl + encodedPid, function(data, textStatus, xhr) {
						
				// the response should have a resourceMap element
				obsoletedBy = $(data).find("obsoletedBy").text();
						
				if (obsoletedBy) {						
					viewRef.showLatestVersion(obsoletedBy, true);
				} else {
					if (traversing) {
						viewRef.$el.find("#Metadata > .container").prepend(
								viewRef.versionTemplate({pid: pid})
						);
								
					} else {
						// finally add the DOI button - this is the latest version
						viewRef.insertDoiButton(pid);
					}			
				}
			});	
		},
		
		showLoading: function(message) {
			this.hideLoading();
			this.scrollToTop();
			this.$el.prepend(this.loadingTemplate({msg: message}));
		},
		
		hideLoading: function() {
			$("#Notification").remove();
		},
		
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		},
		
		setUpAnnotator: function() {
			this.subviews.annotator = new AnnotatorView({ 
				parentView: this 
				});
			this.subviews.annotator.render();
		},
		
		onClose: function () {			
			console.log('Closing the metadata view');
			_.each(this.subviews, function(subview) {
				subview.onClose();
			});
			
			this.$el.empty();
			
			this.pid = null;
		}
		
	});
	
	return MetadataView;		
});
