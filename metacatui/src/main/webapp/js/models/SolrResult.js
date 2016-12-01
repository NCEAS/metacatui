/*global define */
define(['jquery', 'underscore', 'backbone'],
	function($, _, Backbone) {

	// SolrResult Model
	// ------------------
	var SolrResult = Backbone.Model.extend({
		// This model contains all of the attributes found in the SOLR 'docs' field inside of the SOLR response element
		defaults: {
			abstract: null,
			entityName: null,
			indexed: true,
			archived: false,
			origin: '',
			title: '',
			pubDate: '',
			id: '',
			seriesId: appModel.get("useSeriesId")? null : undefined,
			resourceMap: null,
			downloads: null,
			citations: 0,
			selected: false,
			formatId: null,
			formatType: null,
			fileName: null,
			datasource: null,
			rightsHolder: null,
			size: 0,
			type: null,
			url: null,
			obsoletedBy: null,
			geohash_9: null,
			read_count_i: 0,
			reads: 0,
			isDocumentedBy: null,
			isPublic: null,
			isService: false,
			serviceDescription: null,
			serviceTitle: null,
			serviceEndpoint: null,
			serviceOutput: null,
			notFound: false,
			newestVersion: null,
			provSources: [],
			provDerivations: [],
			//Provenance index fields
			prov_generated: null,
			prov_generatedByDataONEDN: null,
			prov_generatedByExecution: null,
			prov_generatedByFoafName: null,
			prov_generatedByOrcid: null,
			prov_generatedByProgram: null,
			prov_generatedByUser: null,
 			prov_hasDerivations: null,
			prov_hasSources: null,
			prov_used: null,
			prov_usedByDataONEDN: null,
			prov_usedByExecution: null,
			prov_usedByFoafName: null,
			prov_usedByOrcid: null,
			prov_usedByProgram: null,
			prov_usedByUser: null,
			prov_wasDerivedFrom: null,
			prov_wasExecutedByExecution: null,
			prov_wasExecutedByUser: null,
			prov_wasGeneratedBy: null,
			prov_wasInformedBy: null
		},

		initialize: function(){
			this.setURL();
			this.on("change:id", this.setURL);

			this.set("type", this.getType());
			this.on("change:read_count_i", function(){ this.set("reads", this.get("read_count_i"))});
		},

		type: "SolrResult",

		// Toggle the `selected` state of the result
		toggle: function () {
			this.selected = !this.get('selected');
		},

		//Returns a plain-english version of the general format - either image, program, metadata, PDF, annotation or data
		getType: function(){
			//The list of formatIds that are images
			var imageIds = ["image/gif",
			                "image/jp2",
			                "image/jpeg",
			                "image/png",
			                "image/svg xml",
			                "image/svg+xml",
			                "image/bmp"];
			//The list of formatIds that are images
			var pdfIds = ["application/pdf"];
			var annotationIds = ["http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html"];

			//Determine the type via provONE
			var instanceOfClass = this.get("prov_instanceOfClass");
			if(typeof instanceOfClass !== "undefined"){
				var programClass = _.filter(instanceOfClass, function(className){
					return (className.indexOf("#Program") > -1);
				});
				if((typeof programClass !== "undefined") && programClass.length)
					return "program";
			}
			else{
				if(this.get("prov_generated") || this.get("prov_used"))
					return "program";
			}

			//Determine the type via file format
			if(this.get("formatType") == "METADATA") return "metadata";
			if(_.contains(imageIds, this.get("formatId"))) return "image";
			if(_.contains(pdfIds, this.get("formatId")))   return "PDF";
			if(_.contains(annotationIds, this.get("formatId")))   return "annotation";

			else return "data";
		},

		//Returns a plain-english version of the specific format ID (for selected ids)
		getFormat: function(){
			var formatMap = {
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "Microsoft Excel OpenXML",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "Microsoft Word OpenXML",
				"application/vnd.ms-excel.sheet.binary.macroEnabled.12" : "Microsoft Office Excel 2007 binary workbooks",
				"application/vnd.openxmlformats-officedocument.presentationml.presentation" : "Microsoft Office OpenXML Presentation",
				"application/vnd.ms-excel" : "Microsoft Excel",
				"application/msword" : "Microsoft Word",
				"application/vnd.ms-powerpoint" : "Microsoft Powerpoint",
				"text/html" : "HTML",
				"text/plain": "plain text (.txt)",
				"video/avi" : "Microsoft AVI file",
				"video/x-ms-wmv" : "Windows Media Video (.wmv)",
				"audio/x-ms-wma" : "Windows Media Audio (.wma)",
				"application/vnd.google-earth.kml xml" : "Google Earth Keyhole Markup Language (KML)",
				"http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html" : "annotation",
				"application/mathematica" : "Mathematica Notebook",
				"application/postscript" : "Postscript",
				"application/rtf" : "Rich Text Format (RTF)",
				"application/xml" : "XML Application",
				"text/xml" : "XML",
				"application/x-fasta" : "FASTA sequence file",
				"nexus/1997" : "NEXUS File Format for Systematic Information",
				"anvl/erc-v02" :  "Kernel Metadata and Electronic Resource Citations (ERCs), 2010.05.13",
				"http://purl.org/dryad/terms/" : "Dryad Metadata Application Profile Version 3.0",
				"http://datadryad.org/profile/v3.1" : "Dryad Metadata Application Profile Version 3.1",
				"application/pdf" : "PDF",
				"application/zip" : "ZIP file",
				"http://www.w3.org/TR/rdf-syntax-grammar" : "RDF/XML",
				"http://www.w3.org/TR/rdfa-syntax" : "RDFa",
				"application/rdf xml" : "RDF",
				"text/turtle" : "TURTLE",
				"text/n3" : "N3",
				"application/x-gzip" : "GZIP Format",
				"application/x-python" : "Python script",
				"http://www.w3.org/2005/Atom" : "ATOM-1.0",
				"application/octet-stream" : "octet stream (application file)",
				"http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd" : "Darwin Core, v2.0",
				"http://rs.tdwg.org/dwc/xsd/simpledarwincore/" : "Simple Darwin Core",
				"eml://ecoinformatics.org/eml-2.1.0" : "EML v2.1.0",
				"eml://ecoinformatics.org/eml-2.1.1" : "EML v2.1.1",
				"eml://ecoinformatics.org/eml-2.0.1" : "EML v2.0.1",
				"eml://ecoinformatics.org/eml-2.0.0" : "EML v2.0.0"
			}

			return formatMap[this.get("formatId")] || this.get("formatId");
		},

		setURL: function(){
			if(appModel.get("objectServiceUrl"))
				this.set("url", appModel.get("objectServiceUrl") + encodeURIComponent(this.get("id")));
			else if(appModel.get("resolveServiceUrl"))
				this.set("url", appModel.get("resolveServiceUrl") + encodeURIComponent(this.get("id")));
		},

		// checks if the pid is already a DOI
		isDOI: function() {
			var DOI_PREFIXES = ["doi:10.", "http://dx.doi.org/10.", "http://doi.org/10."];
			for (var i=0; i < DOI_PREFIXES.length; i++) {
				if (this.get("id").toLowerCase().indexOf(DOI_PREFIXES[i].toLowerCase()) == 0)
					return true;
			}
			return false;
		},

		/*
		 * Checks if the currently-logged-in user is authorized to change permissions on this doc
		 */
		checkAuthority: function(){
			var authServiceUrl = appModel.get('authServiceUrl');
			if(!authServiceUrl) return false;

			var model = this;

			var requestSettings = {
				url: authServiceUrl + encodeURIComponent(this.get("id")) + "?action=changePermission",
				type: "GET",
				success: function(data, textStatus, xhr) {
					model.set("isAuthorized", true);
					model.trigger("change:isAuthorized");
				},
				error: function(xhr, textStatus, errorThrown) {
					model.set("isAuthorized", false);
				}
			}
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},

		/*
		 * This method will download this object while sending the user's auth token in the request.
		 */
		downloadWithCredentials: function(){
			//if(this.get("isPublic")) return;

			//Get info about this object
			var filename = this.get("fileName") || this.get("title") || "",
				url = this.get("url");

			//If we are accessing objects via the resolve service, we need to find the direct URL
			if(url.indexOf("/resolve/") > -1){
				var dataSource = nodeModel.getMember(this.get("datasource")),
					version = dataSource.readv2? "v2" : "v1";

				url = dataSource.baseURL + "/" + version + "/object/" + this.get("id");
			}

			//Create an XHR
			var xhr = new XMLHttpRequest();
			xhr.responseType = "blob";
			xhr.withCredentials = true;

			//When the XHR is ready, create a link with the raw data (Blob) and click the link to download
			xhr.onload = function(){
			    var a = document.createElement('a');
			    a.href = window.URL.createObjectURL(xhr.response); // xhr.response is a blob
			    a.download = filename.trim(); // Set the file name.
			    a.style.display = 'none';
			    document.body.appendChild(a);
			    a.click();
			    delete a;
			};

			//Open and send the request with the user's auth token
			xhr.open('GET', url);
			xhr.setRequestHeader("Authorization", "Bearer " + appUserModel.get("token"));
			xhr.send();
		},

		getInfo: function(fields){
			var model = this;

			if(!fields)
				var fields = "id,seriesId,fileName,resourceMap,formatType,formatId,obsoletedBy,isDocumentedBy,documents,title,origin,pubDate,dateUploaded,datasource,isAuthorized,isPublic,size,read_count_i,isService,serviceTitle,serviceEndpoint,serviceOutput,serviceDescription,serviceType";


			var query = "q=";
			//Do not search for seriesId when it is not configured in this model/app
			if(typeof this.get("seriesId") === "undefined")
				query += 'id:"' + encodeURIComponent(this.get("id")) + '"';
			//If there is no seriesId set, then search for pid or sid
			else if(!this.get("seriesId"))
				query += '(id:"' + encodeURIComponent(this.get("id")) + '" OR seriesId:"' + encodeURIComponent(this.get("id")) + '")';
			//If a seriesId is specified, then search for that
			else if(this.get("seriesId") && (this.get("id").length > 0))
				query += '(seriesId:"' + encodeURIComponent(this.get("seriesId")) + '" AND id:"' + encodeURIComponent(this.get("id")) + '")';
			//If only a seriesId is specified, then just search for the most recent version
			else if(this.get("seriesId") && !this.get("id"))
				query += 'seriesId:"' + encodeURIComponent(this.get("id")) + '" -obsoletedBy:*';

			var requestSettings = {
				url: appModel.get("queryServiceUrl") + query + '&fl='+fields+'&wt=json',
				type: "GET",
				success: function(data, response, xhr){
					var docs = data.response.docs;

					if(docs.length == 1){
						model.set(docs[0]);
						model.trigger("sync");
					}
					//If we searched by seriesId, then let's find the most recent version in the series
					else if(docs.length > 1){
						var mostRecent = _.reject(docs, function(doc){
							return (typeof doc.obsoletedBy !== "undefined");
						});

						if(mostRecent.length > 0)
							model.set(mostRecent[0]);
						else
							model.set(docs[0]); //Just default to the first doc found
						
						model.trigger("sync");
					}
					else{
						model.set("indexed", false);
						//Try getting the system metadata as a backup
						model.getSysMeta();
					}
				},
				error: function(xhr, textStatus, errorThrown){
					model.set("indexed", false);
					model.trigger("getInfoError");
				}
			}

			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},

		getCitationInfo: function(){
			this.getInfo("id,seriesId,origin,pubDate,dateUploaded,title,datasource");
		},
		
		/*
		 * Get the system metadata for this object
		 */
		getSysMeta: function(){
			var url = appModel.get("metaServiceUrl") + this.get("id"),
				model = this;

			var requestSettings = {
				url: url,
				type: "GET",
				dataType: "text",
				success: function(data, response, xhr){
					//Check if this is archvied
					var archived = ($(data).find("archived").text() == "true");
					model.set("archived", archived);
					
					//Get the file size
					model.set("size", ($(data).find("size").text() || ""));
					
					//Get the entity name
					model.set("filename", ($(data).find("filename").text() || ""));
					
					//Check if this is a metadata doc
					var formatId = $(data).find("formatid").text() || "",
						formatType;
					model.set("formatId", formatId);
					if((formatId.indexOf("ecoinformatics.org") > -1) || 
							(formatId.indexOf("FGDC") > -1) || 
							(formatId.indexOf("INCITS") > -1) || 
							(formatId.indexOf("namespaces/netcdf") > -1) || 
							(formatId.indexOf("waterML") > -1) || 
							(formatId.indexOf("darwin") > -1) || 
							(formatId.indexOf("dryad") > -1) || 
							(formatId.indexOf("http://www.loc.gov/METS") > -1) || 
							(formatId.indexOf("ddi:codebook:2_5") > -1) || 
							(formatId.indexOf("http://www.icpsr.umich.edu/DDI") > -1) || 
							(formatId.indexOf("http://purl.org/ornl/schema/mercury/terms/v1.0") > -1) || 
							(formatId.indexOf("datacite") > -1) || 
							(formatId.indexOf("isotc211") > -1) || 
							(formatId.indexOf("metadata") > -1))
						model.set("formatType", "METADATA");
					
					//Trigger the sync event so the app knows we found the model info
					model.trigger("sync");
				},
				error: function(){
					model.notFound();
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},

		notFound: function(){
			this.set({"notFound": true}, {silent: true});
			this.trigger("404");
		},

		//Transgresses the obsolence chain until it finds the newest version that this user is authorized to read
		findLatestVersion: function(newestVersion, possiblyNewer) {
			// Make sure we have the /meta service configured
			if(!appModel.get('metaServiceUrl')) return;

			//If no pid was supplied, use this model's id
			if(!newestVersion){
				var newestVersion = this.get("id");
				var possiblyNewer = this.get("obsoletedBy");
			}

			//If this isn't obsoleted by anything, then there is no newer version
			if(!possiblyNewer){
				this.set("newestVersion", newestVersion);
				return;
			}

			var model = this;

			//Get the system metadata for the possibly newer version
			var requestSettings = {
				url: appModel.get('metaServiceUrl') + encodeURIComponent(possiblyNewer),
				type: "GET",
				success: function(data) {

					// the response may have an obsoletedBy element
					var obsoletedBy = $(data).find("obsoletedBy").text();

					//If there is an even newer version, then get it and rerun this function
					if(obsoletedBy)
						model.findLatestVersion(possiblyNewer, obsoletedBy);
					//If there isn't a newer version, then this is it
					else
						model.set("newestVersion", possiblyNewer);

				},
				error: function(xhr){
					//If this newer version isn't accessible, link to the latest version that is
					if(xhr.status == "401")
						model.set("newestVersion", newestVersion);
				}
			}

			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));

		},

		/**** Provenance-related functions ****/
		/*
		 * Returns true if this provenance field points to a source of this data or metadata object
		 */
		isSourceField: function(field){
			if((typeof field == "undefined") || !field) return false;
			if(!_.contains(appSearchModel.getProvFields(), field)) return false;

			if(field == "prov_generatedByExecution" ||
			   field == "prov_generatedByProgram"   ||
			   field == "prov_used" 		  		||
			   field == "prov_wasDerivedFrom" 		||
			   field == "prov_wasInformedBy")
				return true;
			else
				return false;
		},

		/*
		 * Returns true if this provenance field points to a derivation of this data or metadata object
		 */
		isDerivationField: function(field){
			if((typeof field == "undefined") || !field) return false;
			if(!_.contains(appSearchModel.getProvFields(), field)) return false;

			if(field == "prov_usedByExecution" ||
			   field == "prov_usedByProgram"   ||
			   field == "prov_generated")
				return true;
			else
				return false;
		},

		/*
		 * Returns true if this SolrResult has a provenance trace (i.e. has either sources or derivations)
		 */
		hasProvTrace: function(){
			if(!appModel.get("prov")) return false;

			if(this.get("formatType") == "METADATA"){
				if(this.get("prov_hasSources") || this.get("prov_hasDerivations"))
					return true;
			}

			var fieldNames = appSearchModel.getProvFields(),
				currentField = "";

			for(var i=0; i < fieldNames.length; i++){
				currentField = fieldNames[i];
				if(this.has(currentField))
					return true;
			}

			return false;
		},

		/*
		 * Returns an array of all the IDs of objects that are sources of this object
		 */
		getSources: function(){
			var sources = new Array(),
				model = this;

			_.each(appSearchModel.getProvFields(), function(provField, i){
				if(model.isSourceField(provField) && model.has(provField))
					sources.push(model.get(provField));
			});

			return _.uniq(_.flatten(sources));
		},

		/*
		 * Returns an array of all the IDs of objects that are derivations of this object
		 */
		getDerivations: function(){
			var derivations = new Array(),
				model = this;

			_.each(appSearchModel.getProvFields(), function(provField, i){
				if(model.isDerivationField(provField) && model.get(provField))
					derivations.push(model.get(provField));
			});

			return _.uniq(_.flatten(derivations));
		},
		/****************************/

		/**
		 * Convert number of bytes into human readable format
		 *
		 * @param integer bytes     Number of bytes to convert
		 * @param integer precision Number of digits after the decimal separator
		 * @return string
		 */
		bytesToSize: function(bytes, precision){
		    var kilobyte = 1024;
		    var megabyte = kilobyte * 1024;
		    var gigabyte = megabyte * 1024;
		    var terabyte = gigabyte * 1024;

		    if(typeof bytes === "undefined") var bytes = this.get("size");

		    if ((bytes >= 0) && (bytes < kilobyte)) {
		        return bytes + ' B';

		    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
		        return (bytes / kilobyte).toFixed(precision) + ' KB';

		    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
		        return (bytes / megabyte).toFixed(precision) + ' MB';

		    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
		        return (bytes / gigabyte).toFixed(precision) + ' GB';

		    } else if (bytes >= terabyte) {
		        return (bytes / terabyte).toFixed(precision) + ' TB';

		    } else {
		        return bytes + ' B';
		    }
		}

	});
	return SolrResult;
});
