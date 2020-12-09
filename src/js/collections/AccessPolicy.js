"use strict";

define(["jquery", "underscore", "backbone", "models/AccessRule"],
    function($, _, Backbone, AccessRule) {

      /**
       * @class AccessPolicy
       * @classdesc An AccessPolicy collection is a collection of AccessRules that specify
       * the permissions set on a DataONEObject
       * @classcategory Collections
       */
      var AccessPolicy = Backbone.Collection.extend(
        /** @lends AccessPolicy.prototype */
        {

          model: AccessRule,

          /**
          * The DataONEObject that will be saved with this AccessPolicy
          * @type {DataONEObject}
          */
          dataONEObject: null,

          initialize: function(){

            //When a model triggers the event "removeMe", remove it from this collection
            this.on("removeMe", this.removeAccessRule);

          },

          /**
          * Parses the given access policy XML and creates AccessRule models for
          * each rule in the access policy XML. Adds these models to this collection.
          * @param {Element} The <accessPolicy> XML DOM that contains a set of
          *   access rules.
          */
          parse: function(accessPolicyXML){

            var originalLength = this.length,
                newLength      = 0;

            //Parse each "allow" access rule
      			_.each( $(accessPolicyXML).children(), function(accessRuleXML, i){

              var accessRuleModel;

              //Update the AccessRule models that already exist in the collection, first.
              // This is important to keep listeners thoughout the app intact.
              if( AccessRule.prototype.isPrototypeOf(this.models[i]) ){
                accessRuleModel = this.models[i];
              }
              //Create new AccessRules for all others
              else{
                accessRuleModel = new AccessRule();
                this.add( accessRuleModel );
              }

              newLength++;

              //Reset all the values first
              accessRuleModel.set( accessRuleModel.defaults() );
              //Parse the AccessRule model and update the model attributes
              accessRuleModel.set( accessRuleModel.parse(accessRuleXML) );
              //Save a reference to the DataONEObbject
              accessRuleModel.set("dataONEObject", this.dataONEObject);

      			}, this);

            //If there are more AccessRules in this collection than were in the
            // system metadata XML, then remove the extras
            if( originalLength > newLength ){
              for(var i=0; i < (originalLength - newLength); i++){
                this.pop();
              }
            }

          },

          /**
          * Creates AccessRule member models from the `defaultAccessPolicy`
          * setting in the AppModel.
          */
          createDefaultPolicy: function(){

            //For each access policy in the AppModel, create an AccessRule model
            _.each(MetacatUI.appModel.get("defaultAccessPolicy"), function(accessRule){

              accessRule.dataONEObject = this.dataONEObject;

              this.add( new AccessRule(accessRule) );

            }, this);

          },

          /**
          * Creates an access policy XML from the values set on the member
          * AccessRule models.
          * @return {string} A string of the access policy XML
          */
          serialize: function(){

            if( this.length == 0 )
              return "";

            //Create the access policy node which will contain all the rules
            var xml = "<accessPolicy>\n";

            //Serialize each AccessRule member model and add to the policy DOM
            this.each(function(accessRule){
              xml += accessRule.serialize();
            });

            xml += "\n</accessPolicy>"

            //Convert the access policy DOM to a string and return it
            return xml;

          },

          /**
          * Removes access rules that grant public access and sets an access rule
          * that denies public read.
          */
          makePrivate: function(){

            var alreadyPrivate = false;

            //Find the public access rules and remove them
            this.each( function(accessRule){

              if( typeof accessRule === "undefined" )
                return;

              //If the access rule subject is `public` and they are given any kind of access,
              if( accessRule.get("subject") == "public" &&
                (accessRule.get("read") || accessRule.get("write") || accessRule.get("changePermission")) ){

                  //Remove this AccessRule model from the collection
                  this.remove(accessRule);

              }

              if( accessRule.get("subject") == "public" && accessRule.get("read") === false ){
                alreadyPrivate = true;
              }

            }, this);

            //If this policy does not already deny the public read access, then add that rule
            if( !alreadyPrivate ){
              //Create an access rule that denies public read
              var publicDeny = new AccessRule({
                subject: "public",
                read: false,
                dataONEObject: this.dataONEObject
              });
              //Add this access rule
              this.add(publicDeny);
            }

          },

          /**
          * Removes any AccessRule that denies public read and adds an AccessRule
          * that allows public read
          */
          makePublic: function(){

            var alreadyPublic = false;

            //Find any public read deny rule and remove it
            this.each( function(accessRule){

              if( typeof accessRule === "undefined" )
                return;

              //If the access rule subject is `public` and they are denied read access
              if( accessRule.get("subject") == "public" && accessRule.get("read") === false ){

                  //Remove this AccessRule model from the collection
                  this.remove(accessRule);

              }
              else if( accessRule.get("subject") == "public" && accessRule.get("read") === true ){
                alreadyPublic = true;
              }

            }, this);

            //If this policy does not already allow the public read access, then add that rule
            if( !alreadyPublic ){
              //Create an access rule that allows public read
              var publicAllow = new AccessRule({
                subject: "public",
                read: true,
                dataONEObject: this.dataONEObject
              });
              //Add this access rule
              this.add(publicAllow);
            }

          },

          /**
          * Returns true if this access policy specifies that it is accessible to
          * the public in any way
          * @return {boolean}
          */
          isPublic: function(){

            var isPublic = false;

            this.each(function(accessRule){

              if( accessRule.get("subject") == "public" &&
                (accessRule.get("read") || accessRule.get("write") || accessRule.get("changePermission")) ){
                isPublic = true;
              }

            });

            return isPublic;

          },

          /**
          * Checks if the current user is authorized to perform the given action
          * based on the current access rules in this collection
          *
          * @param {string} action - The action to check authorization for. Can
          *   be either `read`, `write`, or `changePermission`
          * @return {boolean} - Returns true is the user can perform this action,
          *   false if not.
          */
          isAuthorized: function(action){
            if( typeof action == "undefined" || !action )
              return false;

            //Get the access rules for the user's subject or groups
            var allSubjects = [];
            if( !MetacatUI.appUserModel.get("loggedIn") )
              allSubjects = "public";
            else{

              allSubjects = _.union(MetacatUI.appUserModel.get("identities"),
                                    _.pluck(MetacatUI.appUserModel.get("isMemberOf"), "groupId"),
                                    [MetacatUI.appUserModel.get("username")]);


            }

            //Find the access rules that match the given action and user subjects
            var applicableRules = this.filter(function(accessRule){
              if( accessRule.get(action) && _.contains(allSubjects, accessRule.get("subject")) ) {
                return true;
              }
            }, this);

            if( applicableRules.length )
              return true;
            else if( _.contains(allSubjects, this.dataONEObject.get("rightsHolder")) )
              return true;
            else
              return false;

          },

          /**
          * Gets the subject info for all of the subjects in this access policy.
          * Sets the subject info on each corresponding model.
          */
          getSubjectInfo: function(){

            //If there are more than 5 subjects in the access policy, then get the entire list of subjects in the DataONE/CN system
          /*  if( this.length > 5 ){
              //TODO: Get everything from the /accounts endpoint
            }
            */
            //If there are less than 5, then send individual requests to get the subject info
            this.invoke("getSubjectInfo");

          },

          /**
          * Remove the given AccessRule from this AccessPolicy
          * @param {AccessRule} accessRule - The AccessRule model to remove
          */
          removeAccessRule: function(accessRule){

            this.remove(accessRule);

          },

          /**
          * Checks if there is at least one AccessRule with changePermission permission
          * in this AccessPolicy.
          * @returns {boolean}
          */
          hasOwner: function(){
            try{
              var owners = this.where({ changePermission: true });

              //Check if there are any other subjects with ownership levels
              if( !owners || owners.length == 0 ){

                //If there is a rightsHolder, that counts as an owner
              /*  if( this.dataONEObject && this.dataONEObject.get("rightsHolder") ){
                  return true;
                }
                */
                return false;
              }
              else{
                return true;
              }
            }
            catch(e){
              console.error("Error getting the owners of this AccessPolicy: ", e);
            }
          },

          replaceRightsHolder: function(){
            var owner = this.findWhere({ changePermission: true });

            //Make sure the owner model was found
            if( !owner ){
              return;
            }

            //Set this other owner as the rightsHolder
            this.dataONEObject.set("rightsHolder", owner.get("subject"));

            //Remove them as an AccessRule in the AccessPolicy
            this.remove(owner);
          }

      });

      return AccessPolicy;

    });
