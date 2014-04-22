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
		'text!templates/editMetadata.html'
		], 				
	function($, _, Backbone, gmaps, fancybox, MetadataIndex, PublishDoiTemplate, VersionTemplate, LoadingTemplate, UsageTemplate, DownloadContentsTemplate, AlertTemplate, EditMetadataTemplate) {
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
		
		objectIds: [],
		
		DOI_PREFIXES: ["doi:10.", "http://dx.doi.org/10.", "http://doi.org/10."],
		
		// Delegated events for creating new items, and clearing completed ones.
		events: {
			"click #publish": "publish"
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
								
						//Keep track of each object pid
						var pids = [];
						
						//Separate the resource maps from the data/metadata objects
						_.each(moreData.response.docs, function(doc){
							if(doc.formatType == "RESOURCE"){											
								maps.push(doc);
							}
							else{
								objects.push(doc);
								pids.push(doc.id);
							}
						});
												
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

				//Create a google map image
				var mapHTML = "<img class='georegion-map' " +
							  "src='https://maps.googleapis.com/maps/api/staticmap?" +
							  "center="+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&size=550x250" +
							  "&maptype=terrain" +
							  "&markers=size:mid|color:0xDA4D3Aff|"+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&path=color:0xDA4D3Aff|weight:3|"+latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&visible=" + latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&sensor=false" +
							  "&key=" + mapKey + "'/>";
				
				//Find the spot in the DOM to insert our map image
				var lastEl = ($(parentEl).find('label:contains("West")').parent().parent().length) ? $(parentEl).find('label:contains("West")').parent().parent() :  parentEl; //The last coordinate listed
				lastEl.append(mapHTML);

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
