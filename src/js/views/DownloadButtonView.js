define(['jquery', 'underscore', 'backbone', 'models/SolrResult'],
	function($, _, Backbone, SolrResult, template) {
	'use strict';

	var DownloadButtonView = Backbone.View.extend({

		tagName: "a",

		className: "btn download",

		initialize: function(options){
			if(!options) var options = {}

			this.model = options.model || new SolrResult();
		},

		events: {
			"click" : "download"
		},

		render: function(){
			//Add the href and id attributes
			this.$el.attr("href", this.model.get("url"))
					.attr("data-id", this.model.get("id"));

			//For packages
			if(this.model.type == "Package"){
				this.$el.text("Download All")
						.addClass("btn-primary");
			}
			//For individual DataONEObjects
			else{
				this.$el.text("Download");
			}

			//Add a download icon
			this.$el.append( $(document.createElement("i")).addClass("icon icon-cloud-download") );

			//If this is a Download All button for a package but it's too large, then disable the button with a message
			if(this.model.type == "Package" && this.model.getTotalSize() > MetacatUI.appModel.get("maxDownloadSize")){

				this.$el.addClass("tooltip-this")
						.attr("disabled", "disabled")
						.attr("data-title", "This dataset is too large to download as a package. Please download the files individually or contact us for alternate data access.")
						.attr("data-placement", "top")
						.attr("data-trigger", "hover")
						.attr("data-container", "body");

				// Removing the `href` attribute while disabling the download button.
				this.$el.removeAttr("href");

				// Removing pointer as cursor and setting to default
				this.$el.css("cursor","default");
			}
		},

		download: function(e){
			e.preventDefault();

			// Checking if the Download All button is disabled because the package is too large
			var isDownloadDisabled = (this.$el.attr("disabled") === "disabled") ? true : false;

			// Do nothing if the `disabled` attribute is set!.
			if(isDownloadDisabled) {
				return;
			}


			// Perform the download procedure otherwise
			if(this.$el.is(".in-progress"))
				return true;

			//Show that the download has started
			this.$el.addClass("in-progress");
			var buttonHTML = this.$el.html();
			this.$el.html("Downloading... <i class='icon icon-on-right icon-spinner icon-spin'></i>");

			//If we found a model, fire the download event
			this.model.downloadWithCredentials();

			this.listenToOnce(this.model, "downloadComplete", function(){

				//Show that the download is complete
				this.$el.html("Complete <i class='icon icon-on-right icon-ok'></i>")
						.addClass("complete")
						.removeClass("in-progress error");

				var view = this;

				//Put the download button back to normal
				setTimeout(function(){

					//After one second, change the background color with an animation
					view.$el.removeClass("complete")
						.html(buttonHTML);
				}, 2000);

			});

      this.listenToOnce(this.model, "downloadError", function(){
				//Show that the download failed to compelete.
				this.$el.html("Error <i class='icon icon-on-right icon-warning-sign'></i>")
						.addClass("error")
						.removeClass("in-progress")
            .tooltip({
              trigger: "hover",
              placement: "top",
              title: "Something went wrong while trying to download. Click to try again."
            });
			});
		}
	});

	return DownloadButtonView;

});
