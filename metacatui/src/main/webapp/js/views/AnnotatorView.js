/*global define */
define(['jquery',
        'jqueryui',
        'annotator',
		'underscore', 
		'backbone',
		'text!templates/annotation.html'
		], 				
	function($, 
			$ui, 
			Annotator, 
			_, 
			Backbone, 
			AnnotationTemplate) {
	'use strict';

	var AnnotatorView = Backbone.View.extend({
		
		subviews: {},

		el: '#Content',
		
		template: null,
		
		annotationTemplate: _.template(AnnotationTemplate),
		
		rendered: false,
						
		// Delegated events for creating new items, and clearing completed ones.
		events: {},
		
		initialize: function () {
		},
				
		// Render the main annotator view
		render: function () {

			console.log('Rendering the Annotator view');
			this.setUpAnnotator();			
			return this;
		},
		
		onClose: function () {	
			if(this.disabled) return;
			
			console.log('Closing the Annotator view');
			
			// destroy the annotator
			if ($("body").data('annotator')) {
				$("body").annotator('destroy');
			}
			
		},
		
		setUpAnnotator: function() {
			
			var div = "body";
			
			var bioportalSearchUrl = appModel.get('bioportalSearchUrl');
			if (!bioportalSearchUrl) {
				// do not use annotator
				console.log("bioportalSearchUrl is not configured, annotation is disabled");
				this.disabled = true;
				return;
			}
			
			// get the pid
			var pid = appModel.get('pid');
			
			// which URI are we annotating?
			var uri = null;
			//uri = window.location.href;
			uri = appModel.get("resolveServiceUrl") + pid;
			// TODO: use a more stable URI?
			//uri = "https://cn.dataone.org/cn/v2/resolve/" + pid;
			
			// destroy and recreate
			if ($(div).data('annotator')) {
				$(div).annotator('destroy');
				//$(div).destroy();
			}
			

			// use authentication plugin if configured
			var authOptions = false;
			if (appUserModel.get('token')) {
			//if (appModel.get('tokenUrl')) {
				// check if we are using our own token generator
				var tokenUrl = appModel.get('tokenUrl');
				authOptions = {
					tokenUrl: tokenUrl,
				}
			}
			
			// set up the annotator
			$(div).annotator();
			$(div).annotator().annotator('setupPlugins', {}, {
				Tags: false,
				Auth: authOptions,
				Store: {
					prefix: appModel.get('annotatorUrl'),
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
			
			// need connect keyboard navigation to the hover
			var focus = function(event, ui) {
				console.log("This is the value focused: " + ui.item.value);
				//TODO: connect keyboard focus event to show the hover popover 
			};

			// NOTE: using the extended hover auto-complete defined in lookup model
			// set up tags with bioportal suggestions as default
			$(div).annotator().annotator('addPlugin', 'Tags');
			$(div).data('annotator').plugins.Tags.input.hoverAutocomplete({
				source: appLookupModel.bioportalSearch,
				focus: focus,
				position: {
					my: "left top",
					at: "right bottom",
					collision: "fit"
				}
			});
			
			
			// set up rejection field
			$(div).data('annotator').editor.addField({
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
			
			// subscribe to annotation events, to get the exact resource being annotated
			$(div).annotator('subscribe', 'beforeAnnotationCreated', function(annotation, arg0, arg1) {
				var annotator = $(div).data('annotator');
				var selectedElement = annotator.selectedRanges[0].commonAncestor;
				
				// find the first parent with a "resource" attribute
				var resourceElem = $(selectedElement).closest('.annotation-target');
				if (resourceElem) {
					// add the resource identifier to the annotation
					$.extend(annotation, {resource: $(resourceElem).attr('resource')});
					
					// change the autocomplete depending on type of element being annotated
					var type = $(resourceElem).attr('type');
					if (type == "orcid_sm" || type == "party") {
						$(div).data('annotator').plugins.Tags.input.hoverAutocomplete({
							source: appLookupModel.orcidSearch,
							//focus: focus
						});
						$.extend(annotation, {"oa:Motivation": "prov:wasAttributedTo"});
						$.extend(annotation, {"field": "orcid_sm"});

					} else {
						$(div).data('annotator').plugins.Tags.input.hoverAutocomplete({
							source: appLookupModel.bioportalSearch,
							//focus: focus
						});
						$.extend(annotation, {"oa:Motivation": "oa:tagging"});
						$.extend(annotation, {"field": "sem_annotation_bioportal_sm"});
					}
					
					//alert('Augmented annotation with additional properties, annotation: ' + annotation);
				}
				
			});
			
			// showing the viewer show the concepts with labels, definitions and audit info
			$(div).annotator('subscribe', 'annotationViewerShown', function(viewer, annotations) {
				console.log("annotationViewerShown: " + viewer);
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
						var divId = "viewer-" + annotation.id;
						console.log("viewer div length: " + $(viewer.element).find("div[data-id='" + divId + "']").length);
						if ($(viewer.element).find("div[data-id='" + divId + "']").length > 0) {
							return;
						}
						$(element).after(
								"<div data-id='" + divId + "'>", 
								"<p><i>Label: </i>" + concept.label + "</p>", 
								"<p><i>Definition: </i>" + concept.desc + "</p>",
								"</div>",
								"<div>",
								"<p><i>Created: </i>" + created.toDateString() + "</p>",
								"<p><i>Updated: </i>" + updated.toDateString() + "</p>",
								"<p><i>User: </i>" + user + "</p>",
								"</div>"
								);
					};
					appLookupModel.bioportalGetConcepts(conceptUri, renderAnnotation);
					
					
				});
				
			});
			
			// clean up the comment section if none are provided
			$(div).annotator('subscribe', 'annotationViewerTextField', function(field, annotation) {
				var content = $(field).html();
				if (content == "<i>No Comment</i>") {
					$(field).html("");
				}
				
			});
			
			// render annotations when they load
			var viewRef = this;
			var renderAnnotations = function(annotations) {
				
				// keep from duplicating 
				if (this.rendered) {
					console.log("renderAnnotations already called");
					return;
				}
				this.rendered = true;
				
				// sort the annotations by xpath
				annotations = _.sortBy(annotations, function(ann) {
					return ann.resource;
				});
				
				// clear them out!
				$(".hover-proxy").remove();
				$(".annotation-container").remove();
				
				// make a spot for them
				$(".annotation-target").after("<div class='annotation-container controls-well control-group'></div>");
				
				// add input trigger
				var selectText = function(element) {
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
				};
				
				// add a button to select text and launch the new editor
				var launchEditor = function(event) {
					var target = event.target;
					// select the text to annotate
					var block = $(target).closest('.tab-pane').children(".annotation-target");
					var next = $(block).children();
					while ($(next).length) {
						block = next;
						next = $(next).children();
					}
					selectText(block);
					
					// set up the annotator range
					$(div).data('annotator').checkForEndSelection(event);
					
					// simiulate click on adder button
					$(".annotator-adder > button").trigger("click");
					
				};
				$('.annotation-container').append("<div class='btn-group'><button class='btn btn-info'>Add tag</button><button class='btn btn-info add-tag-btn'><i class='icon-plus-sign'></i></button></div>");
				$(".add-tag-btn").bind("click", launchEditor);
				
				// summarize annotation count in citation block
				$(".citation-container > .controls-well").prepend("<span class='badge hover-proxy'>" + annotations.length + " annotations</span>");
				
				
				var flagAnnotation = function(event) {
					var annotationId = $(event.target).attr("data-id");
					console.log("flagging annotation id: " +  annotationId);
					var annotations = $(div).data('annotator').plugins.Store.annotations;
					var annotation = _.findWhere(annotations, {id: annotationId});
					annotation.reject = !annotation.reject;
					$(div).data('annotator').updateAnnotation(annotation);					

				};
				var deleteAnnotation = function(event) {
					var annotationId = $(event.target).attr("data-id");
					console.log("deleting annotation id: " +  annotationId);
					var annotations = $(div).data('annotator').plugins.Store.annotations;
					var annotation = _.findWhere(annotations, {id: annotationId});
					$(div).data('annotator').deleteAnnotation(annotation);					

				};
				
				// define hover action to mimic hovering the highlighted region
				var hoverAnnotation = function(event) {
					
					// figure out the annotation being selected
					var annotationId = $(event.target).attr("data-id");
					
					console.log("hover trigger for target: " + event.target);
					console.log("hover trigger for annotation: " + annotationId);

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
				
				//look up the concept details for each annotation
				_.each(annotations, function(annotation) {
					
					if (annotation.tags[0]) {
						
						// look up concepts where we can
						var conceptUri = annotation.tags[0];
						var renderAnnotation = function(concepts) {
							
							var concept = _.findWhere(concepts, {value: conceptUri});
							
							var canEdit = 
								_.contains(annotation.permissions.admin, appUserModel.get("username"))
								||
								_.contains(annotation.permissions.update, appUserModel.get("username"))
								|| 
								_.contains(annotation.permissions.delete, appUserModel.get("username"));
							
							// render it in the document
							var highlight = $("[data-annotation-id='" + annotation.id + "']");
							var section = $(highlight).closest(".tab-pane").children(".annotation-container");
							var bubble = jQuery(viewRef.annotationTemplate({
								annotation: annotation,
								concept: concept,
								canEdit: canEdit
							}));
							
							section.prepend(bubble);
							console.log("rendered tag in section: " + section.html());

							// bind after rendering
							var target = $(bubble).find(".hover-proxy").filter("[data-id='" + annotation.id + "']");
							console.log("binding annotation actions for target: " + $(target).size());
							console.log("binding annotation actions for target: " + annotation.id);

							$(target).bind("mouseover", hoverAnnotation);
							$(target).bind("mouseout", hoverAnnotation);
							
							target = $(bubble).find(".annotation-flag").filter("[data-id='" + annotation.id + "']");
							$(target).bind("click", flagAnnotation);
							target = $(bubble).find(".annotation-delete").filter("[data-id='" + annotation.id + "']");
							$(target).bind("click", deleteAnnotation);

						};
						
						// look it up and provide the callback
						if (annotation["oa:Motivation"] == "prov:wasAttributedTo") {
							appLookupModel.orcidGetConcepts(conceptUri, renderAnnotation);	
						} else {
							appLookupModel.bioportalGetConcepts(conceptUri, renderAnnotation);	
						}
						
					} else {
						// for comments, just render it in the document
						var highlight = $("[data-annotation-id='" + annotation.id + "']");
						var section = $(highlight).closest(".tab-pane").children(".annotation-container");
						section.append(viewRef.annotationTemplate({
							annotation: annotation,
							concept: null,
							appUserModel: appUserModel
						}));	
					
					}
				});
				
				
				
			};
						
			// reindex when an annotation is updated
			var reindexPid = function(annotation, isDelete) {
				
				// reset view
				this.rendered = false;
				
				// re load the annotations
				var annotations = $(div).data('annotator').plugins.Store.annotations;
				if (isDelete) {
					annotations.splice(annotations.indexOf(annotation), 1);
				}
				renderAnnotations(annotations);

			};
			
			var handleDelete = function(annotation) {
				// only handle this if it is a saved annotation
				if (annotation.id) {
					reindexPid(annotation, true);
				}
				
			}
			
			$(div).annotator('subscribe', 'annotationCreated', reindexPid);
			$(div).annotator('subscribe', 'annotationUpdated', reindexPid);
			$(div).annotator('subscribe', 'annotationDeleted', handleDelete);
			$(div).annotator('subscribe', 'annotationsLoaded', renderAnnotations);

		}
		
	});
	
	return AnnotatorView;		
});
