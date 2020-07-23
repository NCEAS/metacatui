/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/registerCitation.html', 'text!templates/alert.html',],
    function($, _, Backbone, RegisterCitationTemplate, AlertTemplate) {
    'use strict';

    var RegisterCitationView = Backbone.View.extend({

        id:               'citation-modal',
        className:        'modal fade hide',
        template:         _.template(RegisterCitationTemplate),
        alertTemplate:    _.template(AlertTemplate),

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
            relation_type = citationType == 1 ? "is_Cited_By" : "is_Used_By";


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
                            msg: 'Successfully registered citation to the DataONE Metrics Service',
                            classes: "alert-success"
                        }));

                        
                        viewRef.$(".modal-body").html(successMessage);
                    },
                    error: function(){
                        var	errorMessage = $.parseHTML(viewRef.alertTemplate({
                            msg: 'Encountered an error while registering citation to the DataONE Metrics Service',
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
