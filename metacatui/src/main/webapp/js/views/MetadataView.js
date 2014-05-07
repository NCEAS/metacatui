/*global define */
define(['jquery',
		'underscore', 
		'backbone',
		'gmaps',
		'fancybox',
		'views/MetadataIndexView',
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
	function($, _, Backbone, gmaps, fancybox, MetadataIndex, PublishDoiTemplate, VersionTemplate, LoadingTemplate, UsageTemplate, DownloadContentsTemplate, AlertTemplate, EditMetadataTemplate, DataDisplayTemplate, MapTemplate) {
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
		
		initialize: function () {
		},
				
		// Render the main metadata view
		render: function () {

			console.log('Rendering the Metadata view');
			appModel.set('headerType', 'default');
			
			// get the pid to render
			var pid = appModel.get('pid');
			
			//URL encode the pid
			this.encodedPid = encodeURIComponent(pid);
			
			//Check for a view service in this appModel
			if((appModel.get('viewServiceUrl') !== undefined) && (appModel.get('viewServiceUrl'))) var endpoint = appModel.get('viewServiceUrl') + pid + ' #Metadata';
					
			if(endpoint && (endpoint !== undefined)){
				// load the document view from the server
				console.log('calling view endpoint: ' + endpoint);
	
				var viewRef = this;
				this.$el.load(endpoint,
						function(response, status, xhr) {
							if(status=="error"){
								//Our fallback is to show the metadata details from the Solr index
								viewRef.renderMetadataFromIndex();
							}
							else{
								//HTML was successfully loaded from a view service
															
								//Find the taxonomic range and give it a class for styling
								$('#Metadata').find('h4:contains("Taxonomic Range")').parent().addClass('taxonomic-range');
								
								viewRef.$el.fadeIn("slow");
								
								viewRef.insertResourceMapContents(appModel.get('pid'));
								if(gmaps) viewRef.insertSpatialCoverageMap();

							}
												
						});
			}
			else this.renderMetadataFromIndex();
						
			return this;
		},

		renderMetadataFromIndex: function(){
			this.subviews.metadataFromIndex = new MetadataIndex({ 
					pid: appModel.get('pid'), 
					parentView: this 
					});
			this.$el.append(this.subviews.metadataFromIndex.render().el);
			
		},
		
		insertBackLink: function(){
			if(uiRouter.lastRoute() == "data") {
				var insertInto = this.$el.children()[0] || this.el;
				$(insertInto).prepend('<a href="#data" title="Back"><i class="icon-angle-left"></i> Back to search</a>');
			}
		},
		
		// this will insert the ORE package download link if available
		insertResourceMapContents: function(pid) {
			var viewRef = this;

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
			
			if(!this.citationEl){
				//Otherwise, just find the first element with a citation class - useful for when we display the metadata from the indeed fields
				viewRef.citationEl = viewRef.$('.citation')[0];
			}
			
			//Keep a map of resource map ID <-> objects in that resource map 
			var packages = new Array();
			//Keep a list of all resource map objects
			var maps = new Array();
			var objects = new Array();

			var resourceMapQuery = "";
			
			// Grab all of our URLs
			var queryServiceUrl = appModel.get('queryServiceUrl');
			var packageServiceUrl = appModel.get('packageServiceUrl') || appModel.get('objectServiceUrl');
			var objectServiceUrl = appModel.get('objectServiceUrl');
			//Does a route to an EML info page exist?
			var routes = Object.keys(uiRouter.routes),
				EMLRoute = false;
			for(var i=0; i<routes.length; i++){
				if(routes[i].indexOf("tools") > -1){
					EMLRoute = true;
					i = routes.length;
				}
			}
						
			//*** Find each resource map that this metadata is a part of 
			// surround pid value in "" so that doi characters do not affect solr query
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id&wt=json&q=formatType:METADATA+-obsoletedBy:*+id:"' + pid + '"';

			$.get(queryServiceUrl + query, function(data, textStatus, xhr) {
				
				//Insert the container div for the download contents
				if ($('#downloadContents').length == 0) $(viewRef.citationEl).after("<div id='downloadContents'></div>");
						
				var resourceMap = data.response.docs[0].resourceMap;
						
				// Is this metadata part of a resource map?
				if(resourceMap !== undefined){
					
					//Add to our list and map of resource maps if there is at least one
					_.each(resourceMap, function(resourceMapID){
						packages[resourceMapID] = new Array();
						resourceMapQuery += 'resourceMap:"' + encodeURIComponent(resourceMapID) + '"%20OR%20id:"' + encodeURIComponent(resourceMapID) + '"%20OR%20';
					});

					//*** Find all the files that are a part of those resource maps
					var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id&wt=json&q=-obsoletedBy:*+%28' + resourceMapQuery + 'id:"' + encodeURIComponent(pid) + '"%29';
					$.get(queryServiceUrl + query, function(moreData, textStatus, xhr) {
								
						var pids   = [], //Keep track of each object pid
							images = [], //Keep track of each data object that is an image
							pdfs   = []; //Keep track of each data object that is a PDF 
							
						//Separate the resource maps from the data/metadata objects
						_.each(moreData.response.docs, function(doc){
							if(doc.formatType == "RESOURCE"){											
								maps.push(doc);
							}
							else{
								objects.push(doc);
								pids.push(doc.id);
								
								//Keep track of each data object that is an image
								if(viewRef.isImage(doc)) images.push(doc);
								else if(viewRef.isPDF(doc)) pdfs.push(doc); 
							}
						});
						
						//Display data objects if they are visual
						viewRef.insertVisuals(images, "image");
						viewRef.insertVisuals(pdfs, "pdf");
						
						//Replace Ecogrid Links with DataONE API links
						viewRef.replaceEcoGridLinks(pids);
										
						//Now go through all of our objects and add them to our map
						_.each(objects, function(object){
							_.each(object.resourceMap, function(resourceMapId){
								if (packages[resourceMapId]) {
									packages[resourceMapId].push(object);												
								}												
							});
						});
											
						//For each resource map package, add a table of its contents to the page 
						var count = 0;
						_.each(maps, function(thisMap){
							$('#downloadContents').append(viewRef.downloadContentsTemplate({
								objects: packages[thisMap.id],
								resourceMap: thisMap,
								package_service: packageServiceUrl,
								object_service: objectServiceUrl,
								EMLRoute: EMLRoute
							}));	
						}); 
						
						//Move the download button to our download content list area
					    $("#downloadPackage").detach();
					    
					}, "json").error(function(){
						console.warn(reponse);
					});
				}	
				//If this is just a metadata object, just send that info alone
				else{
					$('#downloadContents').append(viewRef.downloadContentsTemplate({
						objects: data.response.docs,
						resourceMap: null,
						package_service: packageServiceUrl,
						object_service: objectServiceUrl,
						EMLRoute: EMLRoute
					}));
					
					//Move the download button to our download content list area
				    $("#downloadPackage").detach();
				}
										
				//Initialize any popovers
				$('.popover-this').popover();
						
			}, "json").error(function(){
				console.warn(repsonse);
			});
					
			// is this the latest version? (includes DOI link when needed)
			viewRef.showLatestVersion(pid);		
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
							console.log('coordinate: ' + coordinate);
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
		 * param dataObject - an object representing the data object returned from the index
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
			if(_.indexOf(imageIds, dataObject.formatId) == -1) return false;			
			else return true;
			
		},
		
		isPDF: function(dataObject){
			//The list of formatIds that are images
			var ids = ["application/pdf"];
			
			//Does this data object match one of these IDs?
			if(_.indexOf(ids, dataObject.formatId) == -1) return false;			
			else return true;			
		},
		
		/*
		 * Inserts new image elements into the DOM via the image template. Use for displaying images that are part of this metadata's resource map.
		 * param images - an array of objects that represent the data objects returned from the index. Each should be an image
		 * param type - a string that defines the type of visual content - either "image" or "pdf"
		 */
		insertVisuals: function(visuals, type){
			var html = "",
				viewRef = this;
			
			//==== Loop over each visual object and create a dataDisplay template for it to attach to the DOM ====
			for(var i=0; i<visuals.length; i++){
				
				//Find the part of the HTML Metadata view that describes this data object
				var container = this.$el.find("td:contains('" + visuals[i].id + "')").parents(".controls-well");
				
				//Harvest the Object Name for a lightbox caption 
				if(container !== undefined) var title = container.find("label:contains('Object Name')").next().text();
				else{
					var title = "";
					container = viewRef.el;
				}
				
				//Create HTML for the visuals using the dataDisplay template
				html = this.dataDisplayTemplate({
					 type : type,
					  src : appModel.get('objectServiceUrl') + visuals[i].id,
					title : title 
				});
	
				// Insert the HTML into the DOM
				$(container).append(html);				
			}
			
			//==== Initialize the fancybox images =====
			// We will be checking every half-second if all the HTML has been loaded into the DOM - once they are all loaded, we can initialize the lightbox functionality.
			var numVisuals  = visuals.length,
				numChecks  = 0, //Keep track of how many interval checks we have so we don't wait forever for images to load 
				lightboxSelector = (type == "image") ? "a[class^='fancybox'][data-fancybox-type='image']" : "a[class^='fancybox'][data-fancybox-iframe]",
				intervalID = window.setInterval(initializeLightboxes, 500),
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
			
			if(type == "image"){
				//Add additional options for images
				lightboxOptions.type = "image";
				lightboxOptions.perload = 1;
			}
			else if(type == "pdf"){		
				//Add additional options for PDFs
				lightboxOptions.type = "iframe";
				lightboxOptions.iframe = { preload: false };
				lightboxOptions.height = "98%";
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
				
				//Are all of our images loaded yet?
				if(viewRef.$(lightboxSelector).length < numVisuals) return;
				else{					
					//Initialize our lightboxes
					$(lightboxSelector).fancybox(lightboxOptions);
					
					//We're done - clear the interval
					window.clearInterval(intervalID);
				}				
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
							
							//Insert an anchor near this spot in the DOM
							$(thisLink).parents().find('.dataTableContainer').prepend('<a name="' + pids[i] + '"></a>');
							
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
			// look up the metadata
			var metaServiceUrl = appModel.get('metaServiceUrl');			

			// look up the meta
			var viewRef = this;
			$.get(metaServiceUrl + encodedPid, function(data, textStatus, xhr) {
						
				// the response should have a resourceMap element
				obsoletedBy = $(data).find("obsoletedBy").text();
				console.log('obsoletedBy: ' + obsoletedBy);
						
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
		
		onClose: function () {			
			console.log('Closing the metadata view');
		}				
	});
	
	return MetadataView;		
});
