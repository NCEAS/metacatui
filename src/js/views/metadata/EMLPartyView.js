/* global define */
define(['underscore', 'jquery', 'backbone', 'models/metadata/eml211/EMLParty',
        'text!templates/metadata/EMLParty.html'],
    function(_, $, Backbone, EMLParty, EMLPartyTemplate){

        /*
            The EMLParty renders the content of an EMLParty model
        */
        var EMLPartyView = Backbone.View.extend({

          type: "EMLPartyView",

          tagName: "div",

          className: "row-fluid eml-party",

          editTemplate: _.template(EMLPartyTemplate),

          initialize: function(options){
            if(!options)
              var options = {};

            this.isNew = options.isNew || (options.model? false : true);
            this.model = options.model || new EMLParty();
            this.edit  = options.edit  || false;

            this.$el.data({ model: this.model });

          },

          events: {
            "change"             : "updateModel",
            "focusout"          : "showValidation",
            "keyup .phone"      : "formatPhone",
            "mouseover .remove" : "previewRemove",
            "mouseout .remove"  : "previewRemove"
          },

          render: function(){

            //Format the given names
            var name = this.model.get("individualName") || {},
              fullGivenName = "";

            //Take multiple given names and combine into one given name.
            //TODO: Support multiple given names as an array
            if (Array.isArray(name.givenName)) {
          fullGivenName = _.map(name.givenName, function(name) {
              if(typeof name != "undefined" && name)
                return name.trim();
              else
                return "";
            }).join(' ');
        }
            else
              fullGivenName = name.givenName;

            //Get the address object
            var address = Array.isArray(this.model.get("address"))?
                    (this.model.get("address")[0] || {}) : (this.model.get("address") || {});

            //Use the template with the editing elements if this view has the "edit" flag on
            if(this.edit){

              //Send all the EMLParty info to the template
              this.$el.html(this.editTemplate({
                uniqueId   : this.model.cid
              }));

              //Populate the form with all the EMLParty values
              this.$("#" + this.model.cid + "-givenName").val(fullGivenName || "");
              this.$("#" + this.model.cid + "-surName").val(name.surName || "");
              this.$("#" + this.model.cid + "-position").val(this.model.get("positionName") || "");
              this.$("#" + this.model.cid + "-organizationName").val(this.model.get("organizationName") || "");
              this.$("#" + this.model.cid + "-email").val(this.model.get("email").length? this.model.get("email")[0] : "");
              this.$("#" + this.model.cid + "-website").val(this.model.get("onlineUrl").length? this.model.get("onlineUrl")[0] : "");
              this.$("#" + this.model.cid + "-phone").val(this.model.get("phone").length? this.model.get("phone")[0] : "");
              this.$("#" + this.model.cid + "-fax").val(this.model.get("fax").length? this.model.get("fax")[0] : "");
              this.$("#" + this.model.cid + "-orcid").val(Array.isArray(this.model.get("userId"))? this.model.get("userId")[0] : this.model.get("userId") || "");
              this.$("#" + this.model.cid + "-address").val(address.deliveryPoint && address.deliveryPoint.length? address.deliveryPoint[0] : "");
              this.$("#" + this.model.cid + "-address2").val(address.deliveryPoint && address.deliveryPoint.length > 1? address.deliveryPoint[1] : "");
              this.$("#" + this.model.cid + "-city").val(address.city || "");
              this.$("#" + this.model.cid + "-state").val(address.administrativeArea || "");
              this.$("#" + this.model.cid + "-zip").val(address.postalCode || "");
              this.$("#" + this.model.cid + "-country").val(address.country || "");
            }

            //If this EML Party is new/empty, then add the new class
            if(this.isNew){
              this.$el.addClass("new");
            }

            //Save the view and model on the element
            this.$el.data({
              model: this.model,
              view: this
            });

            this.$el.attr("data-category", this.model.get("type"));

            return this;
          },

          updateModel: function(e){
            if(!e) return false;

            //Get the attribute that was changed
            var changedAttr = $(e.target).attr("data-attribute");
            if(!changedAttr) return false;

            //Get the current value
            var currentValue = this.model.get(changedAttr);

            //Addresses and Names have special rules for updating
            switch(changedAttr){
              case "deliveryPoint":
                this.updateAddress(e);
                return;
              case "city":
                this.updateAddress(e);
                return;
              case "administrativeArea":
                this.updateAddress(e);
                return;
              case "country":
                this.updateAddress(e);
                return;
              case "postalCode":
                this.updateAddress(e);
                return;
              case "surName":
                this.updateName(e);
                return;
              case "givenName":
                this.updateName(e);
                return;
              case "salutation":
                this.updateName(e);
                return;
            }

            //Update the EMLParty model with the new value
            if(Array.isArray(currentValue)){
              //Get the position that this new value should go in
              var position = this.$("[data-attribute='" + changedAttr + "']").index(e.target);

              if( $(e.target).val() == "" ){
                //Remove the current value from the array if there is no value in the input field
                currentValue.splice(position, 1);
              }
              else{

                var emlModel = this.model.getParentEML(),
                    value = $(e.target).val();

                if( emlModel ){
                  value = emlModel.cleanXMLText(value);
                }

                //Put the new value in the array at the correct position
                currentValue[position] = value;
              }

              this.model.set(changedAttr, currentValue);

              this.model.trigger("change:" + changedAttr);
              this.model.trigger("change");
            }
            else{
              //If the value of the input field is nothing, then reset the field
              if( $(e.target).val() == "" ){
                this.model.set(changedAttr, this.model.defaults()[changedAttr]);
              }
              else{

                var emlModel = this.model.getParentEML(),
                    value = $(e.target).val();

                if( emlModel ){
                  value = emlModel.cleanXMLText(value);
                }

                this.model.set(changedAttr, value);
              }
            }

            //If this is a new EML Party, add it to the parent EML211 model
            if(this.isNew){
              var mergeSuccess = this.model.mergeIntoParent();

              //If the merge was sucessfull, mark this as not new
              if( mergeSuccess  )
                 this.notNew();
            }

            //If this EMLParty model has been removed from the parent EML model,
            //then add it back
            if( this.model.get("removed") ){
              var position = this.$el.parent().children(".eml-party").index(this.$el);
              this.model.get("parentModel").addParty(this.model);
              this.model.set("removed", false);
            }

            this.model.trickleUpChange();

          },

          updateAddress: function(e){
            if(!e) return false;

            //Get the address part that was changed
            var changedAttr = $(e.target).attr("data-attribute");
            if(!changedAttr) return false;

            //TODO: Allow multiple addresses - right now we only support editing the first address
            var address = this.model.get("address")[0] || {},
              currentValue = address[changedAttr];

            //Get the parent EML model and the value from the input element
            var emlModel = this.model.getParentEML(),
                value = $(e.target).val();

            //If there is a parent EML model, clean up the text for XML
            if( emlModel ){
              value = emlModel.cleanXMLText(value);
            }

            //Update the address
            if(Array.isArray(currentValue)){
              //Get the position that this new value should go in
              var position = this.$("[data-attribute='" + changedAttr + "']").index(e.target);

              //Put the new value in the array at the correct position
              currentValue[position] = value;
            }
            //Make sure delivery points are saved as arrays
            else if(changedAttr == "deliveryPoint"){
              address[changedAttr] = [value];
            }
            else
              address[changedAttr] = value;

            //Update the model
          var allAddresses = this.model.get("address");
          allAddresses[0] = address;
          this.model.set("address", allAddresses);

          //If this is a new EML Party, add it to the parent EML211 model
          if(this.isNew){
            var mergeSuccess = this.model.mergeIntoParent();

            //If the merge was sucessfull, mark this as not new
            if( mergeSuccess  )
               this.notNew();
          }

          //If this EMLParty model has been removed from the parent EML model,
          //then add it back
          if( this.model.get("removed") ){
            var position = this.$el.parent().children(".eml-party").index(this.$el);
            this.model.get("parentModel").addParty(this.model);
            this.model.set("removed", false);
          }

          //Manually trigger the change event since it's an object
            this.model.trigger("change:address");
            this.model.trigger("change");

            this.model.trickleUpChange();
          },

          updateName: function(e){
            if(!e) return false;

            //Get the address part that was changed
            var changedAttr = $(e.target).attr("data-attribute");
            if(!changedAttr) return false;

            //TODO: Allow multiple given names - right now we only support editing the first given name
            var name = this.model.get("individualName") || {},
            currentValue = String.prototype.trim(name[changedAttr]);

            //Get the parent EML model and the value from the input element
            var emlModel = this.model.getParentEML(),
                value = $(e.target).val().trim();

            //If there is a parent EML model, clean up the text for XML
            if( emlModel ){
              value = emlModel.cleanXMLText(value);
            }

            //Update the name
            if(Array.isArray(currentValue)){

              //Get the position that this new value should go in
              var position = this.$("[data-attribute='" + changedAttr + "']").index(e.target);

              //Put the new value in the array at the correct position
              currentValue[position] = value;

            }
            else if(changedAttr == "givenName"){
              name.givenName = value;
            }
            else
              name[changedAttr] = value;

            //Update the value on the model
            this.model.set("individualName", name);

            //If this is a new EML Party, add it to the parent EML211 model
            if(this.isNew){
              var mergeSuccess = this.model.mergeIntoParent();

              //If the merge was sucessfull, mark this as not new
              if( mergeSuccess  )
                 this.notNew();
            }

            //If this EMLParty model has been removed from the parent EML model,
            //then add it back
            if( this.model.get("removed") ){
              var position = this.$el.parent().children(".eml-party").index(this.$el);
              this.model.get("parentModel").addParty(this.model);
              this.model.set("removed", false);
            }

            //Manually trigger a change on the name attribute
            this.model.trigger("change:individualName");
            this.model.trigger("change");

            this.model.trickleUpChange();
          },

            /**
             * Validates and displays error messages for the persons' name, position
             * and organization name.
             *
             * @function showValidation
             */
          showValidation: function() {

            //Remove the error styling
            this.$(".notification").empty();
                this.$(".error").removeClass("error");

                // Check if there are values to validate
                if( this.isEmpty() ) {

                    //Remove this EMLParty model from it's parent model instead
                    //of showing a validation error, since it's completely empty
                    this.model.removeFromParent();

                    return;

                }
                //If the model is valid, exit
                else if (this.model.isValid()) {
                    return;
                }
                else{
                  //Start the full error message string for all the EMLParty errors
                  var errorMessages = "";

                  //Iterate over each field that has a validation error
                  _.mapObject( this.model.validationError, function(errorMsg, attribute){

                    //Find the input element for this attribute and add the error styling
                    this.$("[data-attribute='" + attribute + "']").addClass("error");

                    //Add this error message to the full error messages string
                    errorMessages += errorMsg + " ";

                  }, this);

                //Add the full error message text to the notification area and add the error styling
                this.$(".notification").text(errorMessages).addClass("error");

               }
            },

            /**
             * Checks if the user has entered any data in the fields.
             *
             * @return {bool} True if the user hasn't entered any party info, otherwise returns false
             */
            isEmpty: function() {

                // If we add any new fields, be sure to add the data-attribute here.
                var attributes = ["country", "city", "administrativeArea", "postalCode", "deliveryPoint","userId",
                                  "fax", "phone", "onlineUrl", "email", "givenName", "surName", "positionName", "organizationName"];

                 for(var i in attributes) {
                    var attribute = "[data-attribute='"+attributes[i]+"']";
                    if(this.$(attribute).val() != "")
                        return false;
                 }

                 return true;
            },

          // A function to format text to look like a phone number
          formatPhone: function(e){
                  // Strip all characters from the input except digits
                  var input = $(e.target).val().replace(/\D/g,'');

                  // Trim the remaining input to ten characters, to preserve phone number format
                  input = input.substring(0,10);

                  // Based upon the length of the string, we add formatting as necessary
                  var size = input.length;
                  if(size == 0){
                          input = input;
                  }else if(size < 4){
                          input = '('+input;
                  }else if(size < 7){
                          input = '('+input.substring(0,3)+') '+input.substring(3,6);
                  }else{
                          input = '('+input.substring(0,3)+') '+input.substring(3,6)+' - '+input.substring(6,10);
                  }

                  $(e.target).val(input);
          },

          previewRemove: function(){
            this.$("input, img, label").toggleClass("remove-preview");
          },

          /*
           * Changes this view and its model from -new- to -not new-
           * "New" means this EMLParty model is not referenced or stored on a
           * parent model, and this view is being displayed to the user so they can
           * add a new party to their EML (versus edit an existing one).
           */
          notNew: function(){
            this.isNew = false;

            this.$el.removeClass("new");
            this.$el.find(".new").removeClass("new");
          }
        });

        return EMLPartyView;
    });
