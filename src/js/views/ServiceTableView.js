define(['jquery', 'underscore', 'backbone', 'clipboard'],
	function($, _, Backbone, Clipboard) {
	'use strict';


	var ServiceTable = Backbone.View.extend({
		tagName : "div",
		className : "service-table",
		
		events: {
			"click .expand-collapse" : "toggleExpand"
		},

		// Map some less friendly names to friendlier names
		friendly_type_names: {
			'HTTP': 'Website'
		},

		// Map between service type and a full-text description
		tooltip_text : {
			'FTP' : 'Data available via FTP (File Transfer Protocol) can be accessed using any FTP client software, including most modern internet browsers.',
			'HTTP' : 'Standard Internet browsers can access information stored on websites.',
			'DAP' : 'Specialized OPeNDAP clients can be used to access resources available DAP services.',
			'THREDDS' : 'Standard Internet browsers can browse THREDDS Data Servers and specialized THREDDS software can enable more sophisticated data access and visualizations.',
		},

		data: null,

		initialize: function(data){
			this.data = data;
			this.viewRef = this;
		},

		render: function() {
			var viewRef = this;

			// Header portion of the View
			var header = $('<h4>Alternate Data Access <i class="icon-cloud-download"></i></h4>');

			// The table portion of the View
			var table = $(document.createElement('table'));
			$(table).addClass('table');
			$(table).append("<thead><tr><td>Name</td><td>Description</td><td>Access Type</td><td>URL</td></tr></thead>");

			var tbody = $(document.createElement('tbody'));

			// Add each service as a row in the table
			_.each(this.data, function(d) {
				var row_html = '<tr><td class="service-name">' + d.name + '</td>' +
											 '<td class="service-description"><p class="ellipsis collapse-expand-target">' + d.description + '</p></td>';
				
				// Replace server type with riendly names if one exists
				var service_type = d.type;

				if (viewRef.friendly_type_names[d.type] !== undefined) {
					service_type = viewRef.friendly_type_names[d.type];
				}

				row_html += '<td class="service-type">' + service_type;

				// Tooltip (i) buttons
				if (viewRef.tooltip_text[d.type] !== undefined) {
					row_html += '&nbsp;<i class="icon icon-question-sign more-info tooltip-this" data-trigger="hover" data-title="' + viewRef.tooltip_text[d.type] + '" data-placement="top" data-original-title="" title=""></i>';
				}

				row_html += '</td><td class="service-endpoint"><input type="text" value="' + d.endpoint + '" /><button class="btn" data-clipboard-text="' + d.endpoint + '">Copy</button><span class="notification success copy-success hidden"><i class="icon icon-ok"></i> Copied</span></td></tr>';

				$(tbody).append(row_html);

			});

			$(table).append(tbody);

			this.$el.append(header);
			this.$el.append(table);

			// Add Clipboard.js copy functionality to each endpoint
			$(viewRef.$el).find('button').each(function(i) {
				var clipboard = new Clipboard(this, {
					target: function(trigger) {
						return trigger.prev;
					}
				});

				clipboard.on("success", function(e){
					$(e.trigger).siblings(".copy-success").show().delay(1000).fadeOut();
				});

				clipboard.on("error", function(e){
					// Get a ref to the <input> element associated with this Copy element
					var $target = $(e.trigger).prev("input");

					if($target.data("original-title") !== null) {
						console.log('showing tip');
						$target.tooltip({
							title: "Press Ctrl+c to copy",
							placement: "top"
						}).tooltip('show');
						$target.select();
					} else {
						console.log('hiding tip');
						$target.tooltip("hide");
						$target.tooltip("destroy");
					}
				});
			});
			
			//Wait for the page to load a bit and check if service descriptions are
			//overflowing
			setTimeout(function() {
				viewRef.$('td.service-description .ellipsis').each(function(i) {
					//If it is overflowing, insert a link to see more text
					if (viewRef.isOverflowing(this)) {						
						//Create a toggle link and insert after the text
						var expandLink = '<a class="expand-collapse pointer">(more)</a>';
						$(this).after(expandLink);
					}
				});
			}, 100);

			return this;
		},

		// Helper function to check whether an element is overflowing
		isOverflowing:  function (el) {
			var curOverflow = el.style.overflow;

			if ( !curOverflow || curOverflow === "visible" ) {
				el.style.overflow = "hidden";
			}

			var isOverflowing = el.clientWidth < el.scrollWidth || el.clientHeight < el.scrollHeight;

			el.style.overflow = curOverflow;

			return isOverflowing;
		},
		
		// Helper function for providing the more/less expand/contract links in the
		// service descriptions
		toggleExpand: function(e){
			var toggleLink = e.target;
			
			//Get the text to expand/collapse
			var toggleTarget = $(toggleLink).prev(".collapse-expand-target");
			if(!toggleTarget || !toggleTarget.length) return;
			
			if($(toggleTarget).hasClass("ellipsis")){
				$(toggleTarget).removeClass("ellipsis");
				$(toggleLink).text("(less)");
			}
			else{
				$(toggleTarget).addClass("ellipsis");
				$(toggleLink).text("(more)");
			}
				
		}
	});


	return ServiceTable;
});
