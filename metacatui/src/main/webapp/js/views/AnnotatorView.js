/*global define */
define(['jquery',
        'jqueryui',
        'annotator',
		'underscore', 
		'backbone',
		'models/AnnotationModel',
		'text!templates/annotation.html',
		'text!templates/annotationPopover.html'
		], 				
	function($, 
			$ui, 
			Annotator, 
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
			
			this.setUpAnnotator();			
			return this;
		},
		
		onClose: function () {	
			if(this.disabled) return;
						
			// destroy the annotator
			if ($("body").data('annotator')) {
				$("body").annotator('destroy');
			}
			
			this.annotations = [];
		},
		
		setUpAnnotator: function() {
						
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
			if (this.$el.data('annotator')) {
				this.$el.annotator('destroy');
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
			this.$el.annotator();
			this.$el.annotator().annotator('setupPlugins', {}, {
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

			// NOTE: using the extended hover auto-complete defined in lookup model
			// set up tags with bioportal suggestions as default
			this.$el.annotator().annotator('addPlugin', 'Tags');
			
			// Initialize the autocomplete widget extension to provide description tooltips.
		    $.widget( "app.hoverAutocomplete", $.ui.autocomplete, {
		        
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
		    
		    
			this.$el.data('annotator').plugins.Tags.input.hoverAutocomplete({
				source: appLookupModel.bioportalSearch,
				position: {
					my: "left top",
					at: "left bottom",
					collision: "fit"
				}
			});
			
			//Change the palceholder text
			$(this.$el.data('annotator').plugins.Tags.input).attr("placeholder", "Search for tag terms...");
			$(this.$el.data("annotator").plugins.Tags.field).prepend("<p>Add an annotation to this attribute</p>" +
				"<p><strong>Help others find and understand this dataset better by adding semantic annotations</strong></p>")
				.addClass("annotator-field");
			
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
						view.$el.data('annotator').plugins.Tags.input.hoverAutocomplete({
							source: appLookupModel.orcidSearch,
							//focus: focus
						});
						$.extend(annotation, {"oa:Motivation": "prov:wasAttributedTo"});
						$.extend(annotation, {"field": "orcid_sm"});

					} else {
						view.$el.data('annotator').plugins.Tags.input.hoverAutocomplete({
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
			this.$el.annotator('subscribe', 'annotationViewerShown', function(viewer, annotations) {
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
					appLookupModel.bioportalGetConcepts(conceptUri, renderAnnotation);
					
					
				});
				
			});
			
			// clean up the comment section if none are provided
			this.$el.annotator('subscribe', 'annotationViewerTextField', function(field, annotation) {
				var content = $(field).html();
				if (content == "<i>No Comment</i>") {
					$(field).html("");
				}
				
			});
						
			this.$el.annotator('subscribe', 'annotationCreated', this.reindexPid);
			this.$el.annotator('subscribe', 'annotationUpdated', this.reindexPid);
			this.$el.annotator('subscribe', 'annotationDeleted', this.handleDelete);
			this.$el.annotator('subscribe', 'annotationsLoaded', this.renderAnnotations);


		},
		
		renderAnnotations : function(annotations) {
			
			// keep from duplicating 
			if (this.rendered) {
				console.log("renderAnnotations already called");
				return;
			}
			this.rendered = true;
			
			var view = this;
			
			//Create a new model for each annotation
			_.each(annotations, function(annotation){
				var annModel = new AnnotationModel().set(annotation);
				if(Array.isArray(view.annotations))
					view.annotations.push(annModel);
				else
					view.annotations = [annModel];
			});

			// sort the annotations by xpath
			annotations = _.sortBy(annotations, function(ann) {
				return ann.resource;
			});
			
			//Now extract the rejeced annotations
			var rejectedAnnotations = _.filter(annotations, function(ann){
				return ann.reject;
			});
			
			//Add the rejected annotations to the end of the list (we want to display them last)
			annotations = annotations.concat(rejectedAnnotations);
			
			// clear them out!
			$(".hover-proxy").remove();
			$(".annotation-container").remove();
			
			// make a spot for them
			$(".annotation-target").after("<div class='annotation-container'></div>");
			
			// add a button to select text and launch the new editor				
			var addBtn = $(document.createElement("a"))
							.text("Add annotation")
							.addClass("btn btn-info add-tag")
							.prepend($(document.createElement("i"))
										.addClass("icon-on-left icon-plus"));
			$('.annotation-container').append(addBtn);//.on("click", ".add-tag", launchEditor);
			
			// summarize annotation count in citation block
			$(".citation-container > .controls-well").prepend("<span class='badge hover-proxy'>" + annotations.length + " annotations</span>");
			
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
					section.append(viewRef.annotationTemplate({
						annotation: annotation,
						concept: null,
						appUserModel: appUserModel
					}));	
				
				}
			});
	
		},
		
		renderAnnotation: function(annotationModel) {	
			
			var canEdit = 
				_.contains(annotationModel.get("permissions").admin, appUserModel.get("username"))
				||
				_.contains(annotationModel.get("permissions").update, appUserModel.get("username"))
				|| 
				_.contains(annotationModel.get("permissions").delete, appUserModel.get("username"));
			
			// render it in the document
			var highlight = $("[data-annotation-id='" + annotationModel.get("id") + "']");
			var section = $(highlight).closest(".tab-pane").children(".annotation-container");
			if (!section.html()) {
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
			
			//Attach the annotation object for later
			$(annotationTag).data("annotation", annotationModel);
			
			var view = this;
			
			//Create the popover for this element
			$(annotationTag).on("mouseover", { view: this }, this.showDetails);
			
			// bind after rendering
			var target = $(annotationTag).filter(".hover-proxy");
			target = $(annotationTag).filter(".annotation-flag[data-id='" + annotationModel.get("id") + "']");
			//$(target).bind("click", this.flagAnnotation);
			
			$(target).tooltip({
				trigger: "hover",
				title: "Flag as incorrect"
			});
			
			var deleteBtn = $(annotationTag).filter(".annotation-delete");
			$(deleteBtn).tooltip({
				trigger: "hover",
				title: "Delete"
			});
			
			target = $(annotationTag).filter(".annotation-delete[data-id='" + annotationModel.get("id") + "']");
			//$(target).bind("click", this.deleteAnnotation);

		},
		
		flagAnnotation : function(e) {
			
			//Get the flag button
			var flagButton = e.target;
			if(!$(flagButton).is(".annotation-flag")){
				flagButton = $(flagButton).parents(".annotation-flag");
			}

			//Get the annotation
			var annotation = $(flagButton).data("annotation");

			//If there is no annotation, exit.
			if(!annotation) return;
									
			//Get the annotation object
			var anns = this.$el.data("annotator").plugins.Store.annotations;
			var annObj = _.findWhere(anns, {id: annotation.get("id")});
			
			//Reject it!
			annObj.reject = !annObj.reject;
	
			//Update it
			this.$el.data('annotator').updateAnnotation(annObj);					
		},
		
		deleteAnnotation : function(e) {
			var annotationId = $(e.target).attr("data-id");
			console.log("deleting annotation id: " +  annotationId);
			var annotations = view.$el.data('annotator').plugins.Store.annotations;
			var annotation = _.findWhere(annotations, {id: annotationId});
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
				this.reindexPid(annotation, true);
			}
			
		},
		
		// reindex when an annotation is updated
		reindexPid : function(annotation, isDelete) {
			
			// reset view
			this.rendered = false;
			
			// re load the annotations
			var annotations = $(this).data('annotator').plugins.Store.annotations;
			if (isDelete) {
				annotations.splice(annotations.indexOf(annotation), 1);
			}
			
			var view = $(this).data("annotator-view");
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
