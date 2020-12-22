/*global define */
define(['jquery', 'underscore', 'backbone', "models/Utilities", 'text!templates/registerCitation.html'],
    function($, _, Backbone, Utilities, RegisterCitationTemplate) {
    'use strict';

    /**
    * @class RegisterCitationView
    * @classdesc A simple form for a user to input a DOI that cites or uses a dataset in DataONE.
    * When the form is submitted, the citation is registered with the DataONE Metrics service.
    * @classcategory Views
    * @screenshot RegisterCitationView.png
    * @extends Backbone.View
    */
    var RegisterCitationView = Backbone.View.extend(
      /** @lends RegisterCitationView.prototype */ {

        id:               'citation-modal',
        className:        'modal fade hide',

        /**
        * The URL to save the citation to
        * @type {string}
        */
        citationsUrl: MetacatUI.appModel.get("dataoneCitationsUrl"),

        template:         _.template(RegisterCitationTemplate),
        successFooterTemplate: _.template("<button class='btn btn-indigo'" +
                                            " data-dismiss='modal'" +
                                            ">Done</button>"),

        /**
        * The message to display the citation is successfully submitted
        * @type {string}
        */
        successMessage: 'Thank you! Your citation has been successfully submitted. ' +
             'It may take up to 24 hours to see the citation on the dataset page.',

       /**
       * The message to display the citation has failed to submit
       * @type {string}
       */
        errorMessage: 'Sorry! We encountered an error while registering that citation. Please try ' +
                      'again or try emailing us the citation.',

        events: {
          'hidden'                              : 'teardown',
          'click .btn-register-citation'        : 'registerCitation',
          "focusout #publication-identifier"    : "validateDOI"
        },

        initialize: function(options) {
          _.bindAll(this, 'show', 'teardown', 'render');
          if((typeof options == "undefined")){
              var options = {};
          }

          this.pid = options.pid;

        },

        /**
        * Shows this view on the page.
        */
        show: function() {
            this.$el.modal('show');
        },

        /**
        * Hides and removes this view from the page.
        */
        teardown: function() {
          this.$el.modal('hide');
          this.$el.data('modal', null);
          this.remove();
        },

        /**
         * Renders the submission form and creates a Bootstrap modal for this view
         */
        render: function() {
          this.$el.html(this.template());
          this.$el.modal({show:false}); // dont show modal on instantiation

          return this;
        },

        

        /**
         * Get inputs from the modal and sends it to the DataONE Metrics Service
         */
        registerCitation: function() {

          // check if the register button has been disabled
          if (this.$(".btn-register-citation").is(".disabled")) {
            return false;
          }

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

              MetacatUI.appView.showAlert(viewRef.successMessage, "alert-success",
                                          viewRef.$(".modal-body"), null,
                                          { includeEmail: false,
                                             replaceContents: true
                                           });

              viewRef.$(".modal-footer").html(viewRef.successFooterTemplate());
            },
            error: function(){

              MetacatUI.appView.showAlert(viewRef.errorMessage, "alert-error",
                                          viewRef.$(".modal-body"), null,
                                          { includeEmail: true,
                                             replaceContents: true
                                           });

            }
          }

          $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

        },

        /*
        * Validates if the given input is a valid DOI string or not
        * @since 2.14.1
        * @return {undefined}
        */
        validateDOI: function(){
          var identifierInput = this.$("#publication-identifier").val();

          if(!(Utilities.isValidDOI(identifierInput))){

            //Show a warning that the user was trying to edit old content
            MetacatUI.appView.showAlert({
              message: "Please enter a valid DOI.",
              classes: "alert-error",
              container: this.$("#publication-identifier").parent(),
              remove: true
            });

            this.$("#publication-identifier").addClass("register-citation-doi-validation");
            this.$(".btn-register-citation").addClass("disabled")
          }
          else {
            //Remove the validation error
            this.$(".alert-container").remove();

            this.$("#publication-identifier").removeClass("register-citation-doi-validation");

            // If the Disabled class is active
            if (this.$(".btn-register-citation").find(".disabled")) {
              this.$(".btn-register-citation").removeClass("disabled");
            }
          }
        }

    });

     return RegisterCitationView;
  });
