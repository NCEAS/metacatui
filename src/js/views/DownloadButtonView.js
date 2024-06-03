define(['jquery', 'underscore', 'backbone', 'models/SolrResult', 'models/DataONEObject', 'models/PackageModel'],
	function($, _, Backbone, SolrResult, DataONEObject, PackageModel) {
	'use strict';

	var DownloadButtonView = Backbone.View.extend({

		tagName: "a",

		className: "btn download",

		initialize: function(options){
			if(!options) var options = {}
            this.view = options.view || null;
            this.id = options.id || null;
            this.model = options.model || new SolrResult();
            this.nested = options.nested || false;
		},

		events: {
			"click" : "download"
		},

		render: function(){

            var fileName = this.model.get("fileName") || "";

            if( typeof fileName == "string" ){
                fileName = fileName.trim();
            }

			//Add the href and id attributes
            let hrefLink = this.model.get("url");
            if (this.model instanceof DataONEObject && 
                ((this.model.get("formatType") == "RESOURCE") || 
                (this.model.get("type") == "DataPackage"))) {
                hrefLink = this.model.getPackageURL();
            }
            if (this.model instanceof PackageModel &&
                ((this.model.get("formatType") == "RESOURCE") || 
                (this.model.get("type") == "DataPackage") ||
                (this.model.get("type") == "Package"))) {
                hrefLink = this.model.getURL();
            }
			this.$el.attr("href", hrefLink)
					.attr("data-id", this.model.get("id"))
            .attr("download", fileName);

            //Check for CORS downloads. For CORS, the 'download' attribute may not work,
            // so open in a new tab.
            if( typeof hrefLink !== 'undefined' && hrefLink.indexOf(window.location.origin) == -1 ){
                this.$el.attr("target", "_blank");
            }

			//For packages
            if (typeof this.view !== 'undefined' && this.view == "actionsView") {
                this.$el.append( $(document.createElement("i")).addClass("icon icon-large icon-cloud-download") );
                this.$el.addClass("btn-rounded");
                this.$el.addClass("action");
                this.$el.addClass("downloadAction");
            }
            else {
                if(this.model.type == "Package"){
                this.$el.text("Download All")
                    .addClass("btn-primary");

                //if the Package Model has no Solr index document associated with it, then we
                // can assume the resource map object is private. So disable the download button.
                if( !this.model.get("indexDoc") ){
                    this.$el.attr("disabled", "disabled")
                            .addClass("disabled")
                            .attr("href", "")
                            .tooltip({
                            trigger: "hover",
                            placement: "top",
                            delay: 500,
                            title: "This dataset may contain private data, so each data file should be downloaded individually."
                            });
                    }
                }
                //For individual DataONEObjects
                else {
                    this.$el.text("Download");
                }

                //Add a download icon
                this.$el.append( $(document.createElement("i")).addClass("icon icon-cloud-download") );
            }

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

            // Checking if the Download All button is disabled because the package is too large
            var isDownloadDisabled = (this.$el.attr("disabled") === "disabled" || this.$el.is(".disabled")) ? true : false;

            // Do nothing if the `disabled` attribute is set!.
            // If the download is already in progress, don't try to download again
            if(isDownloadDisabled || this.$el.is(".in-progress")) {
                e.preventDefault();
                return;
            }

            //If the user isn't logged in, let the browser handle the download normally
            if( MetacatUI.appUserModel.get("tokenChecked") && !MetacatUI.appUserModel.get("loggedIn") ){
                return;
            }
            //If the authentication hasn't been checked yet, wait for it
            else if( !MetacatUI.appUserModel.get("tokenChecked") ){
                var view = this;
                this.listenTo(MetacatUI.appUserModel, "change:tokenChecked", function(){
                view.download(e);
                });
                return;
            }
            //If the user is logged in but the object is public, download normally
            else if( this.model.get("isPublic") ){

                //If this is a "Download All" button for a package, and at least object is private, then
                // we need to download via XHR with credentials
                if( this.model.type == "Package" ){
                //If we found a private object, download the package via XHR so we can send the auth token.
                var privateObject = _.find(this.model.get("members"), function(m){ return m.get("isPublic") !== true; });
                //If no private object is found, download normally.
                // This may still fail when there is a private object that the logged-in user doesn't have access to.
                if( !privateObject ){
                    return;
                }
                }
                //All other object types (data and metadata objects) can be downloaded normally
                else{
                return;
                }
            }

            e.preventDefault();

            //Show that the download has started
            this.$el.addClass("in-progress");
            var buttonHTML = this.$el.html();
            if (typeof this.view !== 'undefined' && this.view == "actionsView") {
                this.$el.html("<i class='icon icon-on-right icon-spinner icon-spin'></i>");
            }
            else {
                this.$el.html("Downloading... <i class='icon icon-on-right icon-spinner icon-spin'></i>");
            }

            var thisRef = this;

            this.listenToOnce(this.model, "downloadComplete", function(){

                let iconEl = "<i class='icon icon-on-right icon-ok'></i>";
                let downloadEl = "<i class='icon icon-large icon-cloud-download'></i>"

                if (thisRef.view != "actionsView") {
                    iconEl += "Complete ";
                    downloadEl = buttonHTML;
                }

                //Show that the download is complete
                thisRef.$el.html(iconEl)
                .addClass("complete")
                .removeClass("in-progress error");

                //Put the download button back to normal
                setTimeout(function(){
                    //After one second, change the background color with an animation
                    thisRef.$el.removeClass("complete")
                        .html(downloadEl);
                }, 2000);

            });

            this.listenToOnce(this.model, "downloadError", function(){

                let iconEl = "<i class='icon icon-on-right icon-warning-sign'></i>";

                if (thisRef.view != "actionsView") {
                    iconEl += "Error ";
                }

                //Show that the download failed to compelete.
                thisRef.$el.html(iconEl)
                .addClass("error")
                .removeClass("in-progress")
                .tooltip({
                    trigger: "hover",
                    placement: "top",
                    title: "Something went wrong while trying to download. Click to try again."
                });
            });

            //Fire the download event via the SolrResult model
            this.model.downloadWithCredentials();
		}
	});

	return DownloadButtonView;

});
