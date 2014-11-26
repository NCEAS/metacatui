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
						
		// Delegated events for creating new items, and clearing completed ones.
		events: {},
		
		initialize: function () {
		},
				
		// Render the main annotator view
		render: function () {

			console.log('Rendering the Annotator view');
			this.setUpAnnotator("body");			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the Annotator view');
			
			// hide the gutter for other views
			$.sidr("close", "gutter");
			
		},
		
		setUpAnnotator: function(div) {
			
			var bioportalServiceUrl = appModel.get('bioportalServiceUrl');
			if (!bioportalServiceUrl) {
				// do not use annotator
				console.log("bioportalServiceUrl is not configured, annotation is disabled");
				return;
			}
			
			// get the pid
			var pid = appModel.get('pid');
			
			// which URI are we annotating?
			var uri = null;
			//uri = window.location.href;
			uri = appModel.get("objectServiceUrl") + pid;
			// TODO: use a more stable URI?
			//uri = "https://cn.dataone.org/cn/v1/resolve/" + pid;
			
			// destroy and recreate
			if ($(div).data('annotator')) {
				$(div).annotator('destroy');
				//$(div).destroy();
			}
			

			// only use authentication plugin when logged in
			var authOptions = false;
			if (appModel.get('username')) {
				// check if we are using our own token generator
				var tokenUrl = appModel.get('tokenUrl');
				authOptions = {
					tokenUrl: tokenUrl,
					//token: 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJpc3N1ZWRBdCI6ICIyMDE0LTEwLTIxVDE4OjUyOjUwKzAwOjAwIiwgInR0bCI6IDg2NDAwLCAiY29uc3VtZXJLZXkiOiAiYW5ub3RhdGVpdCIsICJ1c2VySWQiOiAibGVpbmZlbGRlciJ9.jh3RBTXNJis8697lCtPylShzj9O2oNN_ec11s9tbkTc'
				}
			}
			
			// set up the annotator
			$(div).annotator();
			$(div).annotator().annotator('setupPlugins', {}, {
				Tags: false,
				Auth: authOptions,
				Store: {
					//prefix: "http://dev.nceas.ucsb.edu:5000",
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
				source: lookupModel.bioportalSearch,
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
		        label: '<strong>Reject</strong> this annotation?',
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
				var resourceElem = $(selectedElement).parents('[resource]');
				if (resourceElem) {
					// add the resource identifier to the annotation
					$.extend(annotation, {resource: $(resourceElem).attr('resource')});
					
					// change the autocomplete depending on type of element being annotated
					var type = $(resourceElem).attr('type');
					if (type == "party") {
						$(div).data('annotator').plugins.Tags.input.hoverAutocomplete({
							source: lookupModel.orcidSearch,
							//focus: focus
						});
						$.extend(annotation, {"oa:Motivation": "prov:wasAttributedTo"});
						$.extend(annotation, {"field": "orcid_sm"});

					} else {
						$(div).data('annotator').plugins.Tags.input.hoverAutocomplete({
							source: lookupModel.bioportalSearch,
							//focus: focus
						});
						$.extend(annotation, {"oa:Motivation": "oa:tagging"});
						$.extend(annotation, {"field": "annotation_sm"});
					}
					
					//alert('Augmented annotation with additional properties, annotation: ' + annotation);
				}
				
			});
			
			// Use tag as hyperlink in the annotation
			var updateAnnotationLinks = function(editor) {
				var annotation = editor.annotation;
				if (annotation.tags) {
					var value = annotation.tags[0];
					// TODO: test for valid URI
					// add the uri as a link
					$.extend(annotation, 
						{links: [{
						        	type: "text/html",
						        	href: value,
						        	rel: "alternate"
								}]
						}
					);
				}
			};
			
			// NOTE: just using the annotateit.org links for now
			//$(div).annotator('subscribe', 'annotationEditorSubmit', updateAnnotationLinks);

			// init the sidr on annotation load
			var viewRef = this;
			
			var showSidr = function(annotations) {
				
				// sort the annotations by xpath
				annotations = _.sortBy(annotations, function(ann) {
					return ann.resource;
				});
				
				$("#view_annotations").sidr({
					name: "gutter",
					side: "right",
					displace: false
				})
				// default to open
				$.sidr("open", "gutter");
				
				// render the annotations in the gutter
				var gutter = $("#gutter");
				gutter.html(viewRef.annotationTemplate({
					annotations: annotations
				}));
				
				// define hover action to mimic hovering the highlight
				var hoverAnnotation = function(event) {
					
					// figure out the annotation being selected
					var annotationId = $(event.target).attr("id");
					
					// trigger as if a hover on highlight
					var highlight = $("[data-annotation-id='" + annotationId + "']");
					var target = $(event.target);
					var targetLoc = target.offset();
					
					// make sure the highlight is viewable in active tab
					var tabId = $(highlight).parents(".tab-pane").attr("id");
					$("a[href='#" + tabId + "']").trigger("click");
					
					// scroll the location in page
					var highlightLocation = highlight.position();
					$("html, body").animate({ scrollTop: highlightLocation.top - 50 }, "slow");
					
					// trigger the hover
					highlight.trigger({
						type: "mouseover",
						pageY: highlightLocation.top + 50,
						pageX: highlightLocation.left + highlight.width() + 100,
					});
				};
				
				$(".hover-proxy").bind("click", hoverAnnotation);
			}
						
			// reindex when an annotation is updated
			var reindexPid = function() {
				var query = appModel.get('metacatServiceUrl') + "?action=reindex&pid=" + pid;
				$.get(query, function(data, status, xhr) {
					// TODO: check for any success?
					//we are done now
				});
				
				// re load the annotations
				showSidr($(div).data('annotator').plugins.Store.annotations);
				
			};
			
			$(div).annotator('subscribe', 'annotationCreated', reindexPid);
			$(div).annotator('subscribe', 'annotationUpdated', reindexPid);
			$(div).annotator('subscribe', 'annotationDeleted', reindexPid);
			$(div).annotator('subscribe', 'annotationsLoaded', showSidr);

		}
		
	});
	
	return AnnotatorView;		
});
