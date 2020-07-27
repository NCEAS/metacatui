/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/registerCitation.html', 'text!templates/alert.html',],
    function($, _, Backbone, RegisterCitationTemplate, AlertTemplate) {
    'use strict';

    var RegisterCitationView = Backbone.View.extend({

        id:               'citation-modal',
        className:        'modal fade hide',
        template:         _.template(RegisterCitationTemplate),
        alertTemplate:    _.template(AlertTemplate),
        successFooterTemplate: _.template("<button class='btn btn-indigo'" + 
                                            " data-dismiss='modal'" +
                                            ">Done</button>"),

        events: {
          'hidden'                      : 'teardown',
          'click .btn-register-citation'  : 'registerCitation'
        },

        initialize: function(options) {
          _.bindAll(this, 'show', 'teardown', 'render', 'renderView');
          if((typeof options == "undefined")){
              var options = {};
          }

          this.pid = options.pid;

        },

        show: function() {
            this.$el.modal('show');
        },

        teardown: function() {
            this.$el.modal('hide');
            this.$el.data('modal', null);
            this.remove();
        },

        render: function() {
            this.renderView();
            return this;
        },

        renderView: function(){

            this.$el.html(this.template());
            this.$el.modal({show:false}); // dont show modal on instantiation
        },

        /**
         * Get inputs from the modal and sends it to the Metrics Service
         */
        registerCitation: function() {

            // get the input values
            var publicationIdentifier = this.$("#publication-identifier").val();

            var citationType = this.$("#citationTypeCustomSelect").val();
            var relation_type = null;

            // If the user has not selected a valid 
            if (citationType != 0) {
                relation_type = citationType == 1 ? "isCitedBy" : "isReferencedBy";
            }
            else {
                relation_type = "isCitedBy";
            }

            // create a request object 
            var citationsUrl = MetacatUI.appModel.get("d1CitationUrl");
            this.citationsUrl = citationsUrl;

            // get the form data before replacing everything with the loading icon!
            var formData = {};
            formData["request_type"] = "dataset";
            formData["metadata"] = new Array();

            var citationRegisterObject = {};
            citationRegisterObject["target_id"] = this.pid;
            citationRegisterObject["source_id"] = publicationIdentifier;
            citationRegisterObject["relation_type"] = relation_type;
            formData["metadata"].push(citationRegisterObject);
			
			// ajax call to submit the given form and then render the results in the content area
			var viewRef = this;
			
			var requestSettings = {
					type: "POST",
					url: this.citationsUrl,
					contentType: false,
                    processData: false,
                    data: JSON.stringify(formData),
                    dataType: "json",
					success: function(data, textStatus, jqXHR) {
						var	successMessage = $.parseHTML(viewRef.alertTemplate({
                            msg: 'Thank you! Your citation has been successfully submitted to DataONE. It may take upto 24 hours to display the citation.',
                            classes: "alert-success"
                        }));

                        
                        viewRef.$(".modal-body").html(successMessage);
                        viewRef.$(".modal-footer").html(viewRef.successFooterTemplate());
                    },
                    error: function(){
                        var	errorMessage = $.parseHTML(viewRef.alertTemplate({
                            msg: 'Sorry! We encountered an error while registering citation to DataONE.',
                            classes: "alert-error"
                        }));

                        
                        viewRef.$(".modal-body").html(errorMessage);
                    }
			}
			
            $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

        }

    });

     return RegisterCitationView;
  });
