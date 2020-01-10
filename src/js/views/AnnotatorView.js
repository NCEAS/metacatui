/*global define */
define(['jquery',
        'jqueryui',
        'annotator',
        'bioportal',
		'underscore',
		'backbone',
		'models/AnnotationModel',
		'text!templates/annotation.html',
		'text!templates/annotationPopover.html'
		],
	function($,
			$ui,
			Annotator,
			Bioportal,
			_,
			Backbone,
			AnnotationModel,
			AnnotationTemplate,
			AnnotationPopoverTemplate) {
	'use strict';

	var AnnotatorView = Backbone.View.extend({

		subviews: {},

		el: '#metadata-container',

		template: null,

		annotationTemplate: _.template(AnnotationTemplate),

		annotationPopoverTemplate: _.template(AnnotationPopoverTemplate),

		rendered: false,

		annotations: [],

		// Delegated events for creating new items, and clearing completed ones.
		events: {
			"click .add-tag" : "launchEditor",
			"click .annotation-flag" : "flagAnnotation",
			"click .annotation-delete" : "deleteAnnotation"
		},

		initialize: function () {
		},

		// Render the main annotator view
		render: function () {

			this.$el.data("annotator-view", this);

			this.setUpTree();

			this.setUpAnnotator();

			return this;
		},

		onClose: function () {
			if(this.disabled) return;

			$("#bioportal-tree").remove();

			// destroy the annotator
			if ($("body").data('annotator')) {
				$("body").annotator('destroy');
			}

			this.annotations = [];
		},

		setUpTree : function() {
			this.$el.append('<div id="bioportal-tree"></div>');
			var tree = $("#bioportal-tree").NCBOTree({
				  apikey: MetacatUI.appModel.get("bioportalAPIKey"),
				  ontology: "ECSO"
				});

			// set up the listener to jump to search results
			tree.on("afterSelect", this.drillDownAnnotation);
			tree.on("afterExpand", this.afterExpand);
			tree.on("afterJumpToClass", this.afterExpand);

		},

		afterExpand : function() {
			// ensure tooltips are activated
	    	$(".tooltip-this").tooltip();
		},

		moveTree: function(event) {

			// take it away from it's original home
			var treeDiv = $("#bioportal-tree").detach();

			// find the new home
			var group = $(event.target).closest(".btn-group");
			var container = $(group).find(".tree-container");

			// put it where we need it
			$(container).append(treeDiv);

			// root at the branch for this concept
			var classId = $(container).attr("data-concept-uri");

			var tree = $(treeDiv).data("NCBOTree");
			var options = tree.options();
			$.extend(options, {startingRoot: classId});

			tree.jumpToClass(classId);

		},

		setUpAnnotator: function() {

			var bioportalAPIKey = MetacatUI.appModel.get('bioportalAPIKey');
			if (!bioportalAPIKey) {
				// do not use annotator
				console.log("bioportalAPIKey is not configured, annotation is disabled");
				this.disabled = true;
				return;
			}

			// get the pid
			var pid = MetacatUI.appModel.get('pid');

			// which URI are we annotating?
			var uri = null;
			//uri = window.location.href;
			uri = MetacatUI.appModel.get("resolveServiceUrl") + pid;
			// TODO: use a more stable URI?
			//uri = "https://cn.dataone.org/cn/v2/resolve/" + pid;

			// destroy and recreate
			if (this.$el.data('annotator')) {
				this.$el.annotator('destroy');
				//$(div).destroy();
			}


			// use authentication plugin if configured
			var authOptions = false;
			if (MetacatUI.appUserModel.get('token')) {
			//if (MetacatUI.appModel.get('tokenUrl')) {
				// check if we are using our own token generator
				var tokenUrl = MetacatUI.appModel.get('tokenUrl');
				authOptions = {
					tokenUrl: tokenUrl,
				}
			}

			// set up the annotator
			this.$el.annotator();
			this.$el.annotator().annotator('setupPlugins', {}, {
				Tags: false,
				Auth: authOptions,
				Store: {
					prefix: MetacatUI.appModel.get('annotatorUrl'),
					annotationData: {
						'uri': uri,
						'pid': pid
					},
					loadFromSearch: {
						'limit': 20,
						'uri': uri
					}
				}
			});

			// NOTE: using the extended hover auto-complete defined in lookup model
			// set up tags with bioportal suggestions as default
			this.$el.annotator().annotator('addPlugin', 'Tags');

			// Initialize the autocomplete widget extension to provide description tooltips.
		    $.widget( "app.semHoverAutocomplete", $.ui.autocomplete, {

		        // Set the content attribute as the "item.desc" value.
		        // This becomes the tooltip content.
		        _renderItem: function( ul, item ) {
		        	// if we have a label, use it for the title
		        	var title = item.value;
		        	if (item.label) {
		        		title = item.label;
		        	}

		        	// if we have a description, use it for the content
		        	var content = '<div class="annotation-viewer-container">';
		        	if (item.desc) {
		        		content += '<span class="annotation tag">' + item.label + '</span>';
		        		if (item.synonyms) {
			        		content += '<p><strong>Synonyms: </strong>';
			        		_.each(item.synonyms, function(synonym) {
				        		content += synonym + "<br/>";
							});

			        		content += '</p>';

		        		}
		        		if (item.desc != item.value) {
			        		content += '<p><strong>Definition: </strong>' + item.desc + '</p>';
			        		content += '<p class="subtle concept">Concept URI: <a href="' + item.value + '" target="_blank">' + item.value + '</a></p>';
		        		}
		        	}
		        	content += "</div>"

		        	//Set up the popover
		        	var element = this._super( ul, item );
		        	element.popover({
        				placement: "right",
        				trigger: "manual",
        				container: 'body',
        				title: title,
        				html: true,
        				content: content
        			})
        			.on("mouseenter", function () {
    			        var _this = this;
    			        $(this).popover("show");
    			        $(".popover").on("mouseleave", function () {
    			            $(_this).popover('hide');
    			        });
    			    })
    			    .on("mouseleave", function () {
    			        var _this = this;
    			        setTimeout(function () {
    			            if (!$(".popover:hover").length) {
    			                $(_this).popover("hide");
    			            }
    			        }, 300);
    			    });
		            return element;
		        }
		    });


			this.$el.data('annotator').plugins.Tags.input.semHoverAutocomplete({
				source: MetacatUI.appLookupModel.bioportalSearch,
				position: {
					my: "left top",
					at: "left bottom",
					collision: "fit"
				}
			});

			//Change the placeholder text
			$(this.$el.data('annotator').plugins.Tags.input).attr("style", "display: none;");
			$(this.$el.data('annotator').plugins.Tags.input).attr("placeholder", "Search for tag terms...");
			$(this.$el.data("annotator").plugins.Tags.field).prepend("<p>Add an annotation to this attribute</p>" +
				"<p><strong>Help others find and understand this dataset better by adding semantic annotations</strong></p>")
				.addClass("annotator-field");

			$(this.$el).find(".annotator-controls").before("<div id='bioportal-tree-label'></div>");
			$(this.$el).find(".annotator-controls").before("<div id='bioportal-tree-annotator'></div>");

			// set up rejection field
			this.$el.data('annotator').editor.addField({
		        type: 'checkbox',
		        label: '<strong>Flag</strong> this annotation?',
		        load: function(field, annotation) {
		        	$(field).find('input').removeAttr("checked");
		            if (annotation.reject) {
			            $(field).find('input').prop("checked", "checked");
		            }
		            return $(field).find('input').is(":checked");
		          },
		          submit: function(field, annotation) {
		        	  var input = $(field).find('input');
		        	  var val = input.is(":checked");
		        	  return annotation.reject = val;
		          }

		      });

			var view = this;

			this.$el.annotator('subscribe', 'annotationEditorShown', function() {
				// reroot tree at starting class
				var tree = $("#bioportal-tree-annotator").data("NCBOTree");
				if (tree) {
					var options = tree.options();
					$.extend(options, {startingRoot: "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType"});
					tree.init();
				}
				// clear any values that are lingering
				var view = $('#metadata-container').data("annotator-view");
				$(view.$el.data('annotator').plugins.Tags.input).val("");
				$("#bioportal-tree-label").html("");

			});

			// subscribe to annotation events, to get the exact resource being annotated
			this.$el.annotator('subscribe', 'beforeAnnotationCreated', function(annotation, arg0, arg1) {
				var annotator = view.$el.data('annotator');
				var selectedElement = annotator.selectedRanges[0].commonAncestor;

				// find the first parent with a "resource" attribute
				var resourceElem = $(selectedElement).closest('.annotation-target');
				if (resourceElem) {
					// add the resource identifier to the annotation
					$.extend(annotation, {resource: $(resourceElem).attr('resource')});

					// change the autocomplete depending on type of element being annotated
					var type = $(resourceElem).attr('type');
					if (type == "orcid_sm" || type == "party") {
						view.$el.data('annotator').plugins.Tags.input.semHoverAutocomplete({
							source: MetacatUI.appLookupModel.orcidSearch,
							//focus: focus
						});
						$.extend(annotation, {"oa:Motivation": "prov:wasAttributedTo"});
						$.extend(annotation, {"field": "orcid_sm"});

					} else {
						view.$el.data('annotator').plugins.Tags.input.semHoverAutocomplete({
							source: MetacatUI.appLookupModel.bioportalSearch,
							//focus: focus
						});
						$.extend(annotation, {"oa:Motivation": "oa:tagging"});
						$.extend(annotation, {"field": "sem_annotation"});
					}

					// set up the tree
					var tree = $("#bioportal-tree-annotator").NCBOTree({
						  apikey: MetacatUI.appModel.get("bioportalAPIKey"),
						  ontology: "ECSO",
						  startingRoot: "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType"
						});

					tree.on("afterSelect", view.selectConcept);
					tree.on("afterJumpToClass", view.jumpToClass);
					tree.on("afterExpand", view.afterExpand); // for the tool tips



					//alert('Augmented annotation with additional properties, annotation: ' + annotation);
				}

			});

			// showing the viewer show the concepts with labels, definitions and audit info
			this.$el.annotator('subscribe', 'annotationViewerShown', function(viewer, annotations) {

				$(viewer.element).find(".annotator-tag").each(function(index, element) {
					var conceptUri = $(element).html();
					var renderAnnotation = function(concepts) {
						var concept = _.findWhere(concepts, {value: conceptUri});
						var annotation = _.find(annotations, function(annotation) {
							return _.contains(annotation.tags, conceptUri);
						});
						var created = new Date(annotation.created);
						var updated = new Date(annotation.updated);
						var user = annotation.user; // TODO: make more readable
						var containerId = "viewer-" + annotation.id;
						if ($(viewer.element).find("div[data-id='" + containerId + "']").length > 0) {
							return;
						}

						if(created.valueOf() == updated.valueOf()) updated = null;

						var annotationPopover = view.annotationPopoverTemplate({
							containerId: containerId,
							concept: concept,
							created: created,
							updated: updated,
							user: user,
							annotation: annotation
						});
						$(element).after(annotationPopover);
					};
					MetacatUI.appLookupModel.bioportalGetConcepts(conceptUri, renderAnnotation);


				});

			});

			// clean up the comment section if none are provided
			this.$el.annotator('subscribe', 'annotationViewerTextField', function(field, annotation) {
				var content = $(field).html();
				if (content == "<i>No Comment</i>") {
					$(field).html("");
				}

			});

			this.$el.annotator('subscribe', 'annotationStored', this.annotationStored);
			this.$el.annotator('subscribe', 'annotationUpdated', this.annotationUpdated);
			this.$el.annotator('subscribe', 'annotationDeleted', this.handleDelete);
			this.$el.annotator('subscribe', 'annotationsLoaded', this.preRenderAnnotations);


		},

		selectConcept : function(event, classId, prefLabel, selectedNode) {

			// set in the editor
			var view = $('#metadata-container').data("annotator-view");
			$(view.$el.data('annotator').plugins.Tags.input).val(classId);

			// make it pretty
			$("#bioportal-tree-label").html("<a class='annotation tag btn'>" + prefLabel + "</a>");

			// prevent default action
			return false;

		},

		jumpToClass : function(event, classId) {

			var reroot = true; // for easier changing of our minds :)
			if (reroot) {
				// reroot tree at new class
				var tree = $("#bioportal-tree-annotator").data("NCBOTree");
				var options = tree.options();
				$.extend(options, {startingRoot: classId});
				tree.init();

				// ensure tooltips are activated
		    	$(".tooltip-this").tooltip();
			} else {
				// scroll to selected part
		    	var node = $("#bioportal-tree-annotator").find("a[data-id='" + encodeURIComponent(classId) + "']");
		    	var position = $(node).position().top - 200;
		    	$("#bioportal-tree-annotator").scrollTop(position)
			}

		},

		preRenderAnnotations : function(annotations) {

			var uris = [];

			//look up the concept details in a batch
			_.each(annotations, function(annotation) {
				if (annotation.tags[0]) {
					// look up concepts where we can
					var conceptUri = annotation.tags[0];
					uris.push(conceptUri);
				}
			});

			// now look them up and render when finished
			var annotatorEl = (typeof this.$el != "undefined")? this.$el : this,
					view = $(annotatorEl).data("annotator-view");
			MetacatUI.appLookupModel.bioportalGetConceptsBatch(
					uris,
					function() {view.renderAnnotations(annotations);});

		},

		renderAnnotations : function(annotations) {

			// keep from duplicating
			if (this.rendered) {
				return;
			}
			this.rendered = true;

			// sort the annotations by xpath
			annotations = _.sortBy(annotations, function(ann) {
				return ann.resource;
			});

			// only want to show the manual annotations
			annotations = _.filter(annotations, function(ann){
				return (ann.field == "sem_annotation");
			});

			//Now extract the rejeced annotations
			var rejectedAnnotations = _.filter(annotations, function(ann){
				return ann.reject;
			});
			annotations = _.filter(annotations, function(ann){
				return !ann.reject;
			});

			// we want to display rejected last
			annotations = annotations.concat(rejectedAnnotations);
			annotations.reverse();

			var view = this;

			//Create a new model for each annotation
			_.each(annotations, function(annotation){
				var annModel = new AnnotationModel().set(annotation);
				if(Array.isArray(view.annotations))
					view.annotations.push(annModel);
				else
					view.annotations = [annModel];
			});

			// clear them out!
			$(".hover-proxy").remove();
			$(".annotation-container").remove();

			// make a spot for them
			$(".annotation-target").after("<div class='annotation-container'></div>");

			// add a button to select text and launch the new editor, only when logged in
			var addBtn = $(document.createElement("a"))
							.text("Add annotation")
							.addClass("btn btn-info add-tag")
							.prepend($(document.createElement("i"))
										.addClass("icon-on-left icon-plus"));

			if (!MetacatUI.appUserModel.get("loggedIn")) {
				addBtn.addClass("disabled");
			}

			$('.annotation-container').append(addBtn);//.on("click", ".add-tag", launchEditor);

			// summarize annotation count in citation block
			$(".citation-container > .controls-well").prepend("<span class='badge hover-proxy'>" + annotations.length + " annotations</span>");

			// define hover action to mimic hovering the highlighted region
			var hoverAnnotation = function(event) {

				// figure out the annotation being selected
				var annotationId = $(event.target).attr("data-id");

				// trigger as if a hover on highlighted region
				var highlight = $("[data-annotation-id='" + annotationId + "']");

				// scroll the location in page
				var highlightLocation = highlight.offset();

				// trigger the hover
				highlight.trigger({
					type: event.type, //"mouseover",
					pageY: highlightLocation.top + 0,
					pageX: highlightLocation.left + highlight.width() + 0,
				});
			};

			var annotatorEl = (typeof this.$el != "undefined")? this.$el : this,
				view = $(annotatorEl).data("annotator-view");

			//look up the concept details for each annotation
			_.each(this.annotations, function(annotation) {

				if (annotation.get("tags")[0]) {
					// look up concepts where we can
					var conceptUri = annotation.get("tags")[0];

					// give time for the highlights to render
					setTimeout(function() {
						// look it up and provide the callback
						if (annotation.get("oa:Motivation") == "prov:wasAttributedTo") {
							annotation.orcidGetConcepts(conceptUri);
						} else {
							annotation.bioportalGetConcepts(conceptUri);
						}

					}, 500);

					annotation.on("change:concept", view.renderAnnotation, view);

				} else {
					// for comments, just render it in the document
					var highlight = $("[data-annotation-id='" + annotation.id + "']");
					var section = $(highlight).closest(".tab-pane").children(".annotation-container");
					section.append(view.annotationTemplate({
						annotation: annotation,
						concept: null,
						appUserModel: MetacatUI.appUserModel
					}));

				}
			});

		},

		renderAnnotation: function(annotationModel) {

			var canEdit =
				_.contains(annotationModel.get("permissions").admin, MetacatUI.appUserModel.get("username"))
				||
				_.contains(annotationModel.get("permissions").update, MetacatUI.appUserModel.get("username"))
				||
				_.contains(annotationModel.get("permissions").delete, MetacatUI.appUserModel.get("username"));

			// render it in the document
			var highlight = $("[data-annotation-id='" + annotationModel.get("id") + "']");
			var section = $(highlight).closest(".tab-pane").children(".annotation-container");
			var tab = $(highlight).closest(".tab-pane");
			var tabControl = $("a[href='#" + $(tab).attr("id") + "'");
			var icons = $(tabControl).find(".icon-tag");
			if ($(icons).size() == 0) {
				tabControl.prepend("<i class='icon-tag'></i>")
			}


			if (!section.html()) {
				//console.log("Highlights not completed yet - cannot render annotation: " +  annotationModel.get("id"));
				console.log("Highlights not completed yet - cannot render annotation");
				return;
			}

			//Render the annotation tag itself
			var annotationTag = $.parseHTML(this.annotationTemplate({
				annotation: annotationModel.toJSON(),
				concept: annotationModel.get("concept"),
				canEdit: canEdit
			}).trim());
			section.prepend(annotationTag);

			// this is what we really want to attach to
			var target = $(annotationTag).find(".hover-proxy");

			//Attach the annotation object for later
			$(target).data("annotation", annotationModel);

			var view = this;

			//Create the popover for this element
			$(target).on("mouseover", { view: this }, this.showDetails);

			// subscribe to event
			var viewRef = this;
			$(annotationTag).find(".annotation-dropdown").on("click", viewRef.moveTree);
			$(annotationTag).find(".dropdown-menu").on("click", function (e) {
				  e.stopPropagation();
				});

			// bind after rendering
			target = $(annotationTag).find(".annotation-flag[data-id='" + annotationModel.get("id") + "']");
			$(target).bind("click", this.flagAnnotation);

			var deleteBtn = $(annotationTag).find(".annotation-delete");
			$(deleteBtn).tooltip({
				trigger: "hover",
				title: "Delete"
			});

			$(annotationTag).find(".tooltip-this").tooltip();

			target = $(annotationTag).find(".annotation-delete[data-id='" + annotationModel.get("id") + "']");
			$(target).bind("click", this.deleteAnnotation);

		},

		drillDownAnnotation : function(event, classId, prefLabel, selectedNode) {

			// Get the concept info
			var uri = classId;
			var label = prefLabel;
			var description = "";

			// Clear the search and map model to start a fresh search
			MetacatUI.appSearchModel.clear();
			MetacatUI.appSearchModel.set(MetacatUI.appSearchModel.defaults);
			MetacatUI.mapModel.clear();
			MetacatUI.mapModel.set(MetacatUI.mapModel.defaults);

			// construct the filter
			var filter = {
					value: uri,
					filterLabel: label,
					label: label,
					description: description
					};

			// set the search model
			MetacatUI.appSearchModel.set("annotation", [filter]);

			// navigate to search results
			MetacatUI.uiRouter.navigate('data', {trigger: true});
		},

		flagAnnotation : function(e) {

			var annotationId = $(e.target).attr("data-id");
			var view = $('#metadata-container').data("annotator-view");
			var annotations = view.$el.data('annotator').plugins.Store.annotations;
			var annotation = _.findWhere(annotations, {id: annotationId});

			//Reject it!
			annotation.reject = !annotation.reject;

			//Update it
			view.$el.data('annotator').updateAnnotation(annotation);
		},

		deleteAnnotation : function(e) {
			var annotationId = $(e.target).attr("data-id");
			var view = $('#metadata-container').data("annotator-view");
			var annotations = view.$el.data('annotator').plugins.Store.annotations;
			var annotation = _.findWhere(annotations, {id: annotationId});

			// make sure to stash the tree since the popover will never be shown again
			var treeDiv = $("#bioportal-tree").detach();
			view.$el.append(treeDiv);

			view.$el.data('annotator').deleteAnnotation(annotation);

		},

		showDetails: function(e){
			//Don't show the details for the flag button
			if(!$(e.target).is(".annotation.tag")) return;
			//Don't execute this code again if we already set up a popover
			else if(typeof $(e.target).data("popover") != "undefined") return;

			var annotation = $(e.target).data("annotation");

			var created = new Date(annotation.get("created"));
			var updated = new Date(annotation.get("updated"));
			var containerId = "viewer-" + annotation.get("id");

			if(created.valueOf() == updated.valueOf()) updated = null;

			var annotationPopover = e.data.view.annotationPopoverTemplate({
				containerId: containerId,
				created: created,
				updated: updated,
				annotation: annotation.toJSON()
			});
			$(e.target).popover({
				trigger: "manual",
				html: true,
				title: annotation.get("concept").label,
				content: annotationPopover,
				container: 'body',
				placement: "top"
			}).on("mouseenter", function () {
		        var _this = this;
		        $(this).popover("show");
		        $(".popover").on("mouseleave", function () {
		            $(_this).popover('hide');
		        });
		    }).on("mouseleave", function () {
		        var _this = this;
		        setTimeout(function () {
		            if (!$(".popover:hover").length) {
		                $(_this).popover("hide");
		            }
		        }, 300);
		    });
			$(e.target).popover("show");
		},

		launchEditor: function(event) {
			var target = event.target;
			// select the text to annotate
			var block = $(target).closest('.tab-pane').children(".annotation-target");
			var next = $(block).children();
			while ($(next).length) {
				block = next;
				next = $(next).children();
			}

			this.selectText(block);

			// set up the annotator range
			this.$el.data('annotator').checkForEndSelection(event);

			// simiulate click on adder button
			$(".annotator-adder > button").trigger("click");
		},

		handleDelete: function(annotation) {
			// only handle this if it is a saved annotation
			if (annotation.id) {
				var view = $('#metadata-container').data("annotator-view");
				view.reindexPid(annotation, true);
			}

		},

		annotationStored : function(annotation) {

			var view = $('#metadata-container').data("annotator-view");

			// add the data id to this
		    $(annotation.highlights).attr('data-annotation-id', annotation.id);

			// refresh annotation
			view.reindexPid(annotation, false);

		},

		annotationUpdated : function(annotation) {

			var view = $('#metadata-container').data("annotator-view");
			view.reindexPid(annotation, false);

		},

		// reindex when an annotation is updated
		reindexPid : function(annotation, isDelete) {

			var view = $('#metadata-container').data("annotator-view");

			// re load the annotations
			var annotations = view.$el.data('annotator').plugins.Store.annotations;
			if (isDelete) {
				annotations = _.reject(annotations, function(a) {
					return annotation.id == a.id;
				});
			}

			view.rendered = false;
			view.renderAnnotations(annotations);

		},

		selectText: function(element) {
		    var doc = document;
		    var text = $(element).get(0);
		    var range;
		    var selection;

		    if (doc.body.createTextRange) {
		        range = document.body.createTextRange();
		        range.moveToElementText(text);
		        range.select();
		    } else if (window.getSelection) {
		        selection = window.getSelection();
		        range = document.createRange();
		        range.selectNodeContents(text);
		        selection.removeAllRanges();
		        selection.addRange(range);
		    }
		}

	});

	return AnnotatorView;
});
