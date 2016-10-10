/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'DonutChart', 'text!templates/mdqRun.html', 'text!templates/mdqSuites.html', 'text!templates/loading.html'], 				
	function($, _, Backbone, d3, DonutChart, MdqRunTemplate, SuitesTemplate, LoadingTemplate) {
	'use strict';
	
	// Build the Footer view of the application
	var MdqRunView = Backbone.View.extend({

		el: '#Content',
				
		events: {
			"click input[type='submit']"	:	"submitForm",
			"change #suiteId" : "switchSuite"
		},
				
		suitesUrl: "/mdq-webapp/webapi/suites/",

		url: null,
		
		pid: null,
		
		suiteId: null,
		
		loadingTemplate: _.template(LoadingTemplate),

		template: _.template(MdqRunTemplate),
		
		suitesTemplate: _.template(SuitesTemplate),

		
		initialize: function () {
			
		},
		
		switchSuite: function(event) {
			console.log("Switching Suite");
			
			var select = $(event.target);

			var suiteId = $(select).val();
			
			uiRouter.navigate("mdq/s=" + suiteId + "/" + this.pid, {trigger: true});
			
			return false;
		},
				
		render: function () {
			
			// use the requested suite if provided
			if (!this.suiteId) {
				this.suiteId = "arctic.data.center.suite.1";
			}
			this.url = this.suitesUrl + this.suiteId + "/run";

			var viewRef = this;

			if (this.pid) {
				
				this.showLoading();
				
				// fetch the metadata contents by the pid
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = function(){
				    if (this.readyState == 4 && this.status == 200){
				        //this.response is what you're looking for
				        //handler(this.response);
				        console.log(this.response, typeof this.response);
				        var documentBlob = this.response;
				        // send to MDQ as blob
						var formData = new FormData();
						formData.append('document', documentBlob);
						console.log("Submitting Blob to MDQ");
						viewRef.showResults(formData);
				    }
				}
				var url = appModel.get("objectServiceUrl") + this.pid;
				xhr.open('GET', url);
				xhr.responseType = 'blob';
				xhr.withCredentials = true;
				xhr.setRequestHeader("Authorization", "Bearer " + appUserModel.get("token"));
				xhr.send();  
				
			} else {
				this.$el.html(this.template({}));
			}
			
		},
		
		showLoading: function() {
			this.$el.html(this.loadingTemplate());
		},
		
		show: function() {
			var view = this;
			this.$el.hide();
			this.$el.fadeIn({duration: "slow"});
		},
		
		// lookup the suites we can run
		showAvailableSuites: function() {
			var viewRef = this;
			
			try {				
				var args = {
						url: this.suitesUrl,
					    type: 'GET',
						success: function(data, textStatus, xhr) {
							viewRef.$el.find('#suites').append(
									viewRef.suitesTemplate(
											{
												suiteId: viewRef.suiteId,
												suiteIds: data
											}));
							//Initialize all popover elements
							//$('.popover-this').popover();
						}
				};
				$.ajax(args);
			} catch (error) {
				console.log(error.stack);
			}
		},
		
		submitForm: function(event) {
			console.log("Submitting form to MDQ");
				
			var form = $(event.target).parents("form");

			var formData = new FormData($(form)[0]);

			this.showResults(formData);
			
			return false;

		},
		
		// do the work of sending the data and rendering the results
		showResults: function(formData) {
			var viewRef = this;
			
			try {				
				var args = {
						url: this.url,
						cache: false,
						data: formData,
					    contentType: false, //"multipart/form-data",
					    processData: false,
					    type: 'POST',
						success: function(data, textStatus, xhr) {
							var groupedResults = viewRef.groupResults(data.result);
							var groupedByType = viewRef.groupByType(data.result);

							data = _.extend(data, 
									{
										objectIdentifier: viewRef.pid,
										suiteId: viewRef.suiteId,
										groupedResults: groupedResults,
										groupedByType: groupedByType
									});

							viewRef.$el.html(viewRef.template(data));
							viewRef.drawScoreChart(data.result, groupedResults);
							viewRef.showAvailableSuites();
							viewRef.show();
							//Initialize all popover elements
							$('.popover-this').popover();
						}
				};
				$.ajax(args);
			} catch (error) {
				console.log(error.stack);
			}
		},
		
		groupResults: function(results) {
			var groupedResults = _.groupBy(results, function(result) {
				var color;
				
				// simple cases
				// always blue for info and skip
				if (result.check.level == 'INFO') {
					color = 'BLUE';
					return color;
				}
				if (result.status == 'SKIP') {
					color = 'BLUE';
					return color;
				}
				// always green for success
				if (result.status == 'SUCCESS') {
					color = 'GREEN';
					return color;
				} 
				
				// handle failures and warnings
				if (result.status == 'FAILURE') {
					color = 'RED';
					if (result.check.level == 'OPTIONAL') {
						color = 'ORANGE';
					}
				}
				if (result.status == 'ERROR') {
					color = 'ORANGE';
					if (result.check.level == 'REQUIRED') {
						color = 'RED';
					}
				}
				//console.log("result color:" + color);
				return color;
				
			});
			
			// make sure we have everything, even if empty
			if (!groupedResults.BLUE) {
				groupedResults.BLUE = [];
			}
			if (!groupedResults.GREEN) {
				groupedResults.GREEN = [];
			}
			if (!groupedResults.ORANGE) {
				groupedResults.ORANGE = [];
			}
			if (!groupedResults.RED) {
				groupedResults.RED = [];
			}
			
			var total = results.length;
			if (groupedResults.BLUE) {
				total = total - groupedResults.BLUE.length;
			}
			
			return groupedResults;
		},
		
		groupByType: function(results) {
			var groupedResults = _.groupBy(results, function(result) {
				return result.check.type || "uncategorized";
			});
			
			return groupedResults;
		},
		
		drawScoreChart: function(results, groupedResults){
						
			var dataCount = results.length;
			
			
			var data = [
			            {label: "Pass", count: groupedResults.GREEN.length, perc: groupedResults.GREEN.length/results.length },
			            {label: "Warn", count:  groupedResults.ORANGE.length, perc: groupedResults.ORANGE.length/results.length},
			            {label: "Fail", count: groupedResults.RED.length, perc: groupedResults.RED.length/results.length},
			            {label: "Info", count: groupedResults.BLUE.length, perc: groupedResults.BLUE.length/results.length},
			        ];
			/*
			var data = [
			            "Pass", groupedResults.GREEN.length,
			            "Warning", groupedResults.ORANGE.length,
			            "Fail", groupedResults.RED.length,
			            "Info", groupedResults.BLUE.length,
			        ];
			 */
			
			var svgClass = "data";
			
			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('.format-charts-data').html("<h2 class='" + svgClass + " fallback'>" + appView.commaSeparateNumber(dataCount) + " data files</h2>");
				
				return;
			}
			
			//Draw a donut chart
			var donut = new DonutChart({
							id: "data-chart",
							data: data, 
							total: dataCount,
							titleText: "checks", 
							titleCount: dataCount,
							svgClass: svgClass,
							countClass: "data",
							height: 250,
							width: 250,
							keepOrder: true,
							formatLabel: function(name) {
								return name;
							}
						});
			this.$('.format-charts-data').html(donut.render().el);
		}
				
	});
	return MdqRunView;		
});
