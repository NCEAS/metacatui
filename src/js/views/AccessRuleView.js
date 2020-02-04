define(['underscore',
        'jquery',
        'backbone',
        "models/AccessRule"],
function(_, $, Backbone, AccessRule){

  var AccessRuleView = Backbone.View.extend(
    /** @lends AccessRuleView.prototype */{

    /**
    * The type of View this is
    * @type {string}
    */
    type: "AccessRule",

    /**
    * The HTML tag name for this view's element
    * @type {string}
    */
    tagName: "tr",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "access-rule",

    /**
    * The AccessRule model that is displayed in this view
    * @type {AccessRule}
    */
    model: undefined,

    /**
    * If true, this view represents a new AccessRule that hasn't been added to the AccessPolicy yet
    * @type {boolean}
    */
    isNew: false,

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Is executed when a new AccessRuleView is created
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

    },

    /**
    * Renders a single Access Rule
    */
    render: function(){

      try{

        //If there's no model, exit now since there's nothing to render
        if( !this.model ){
          return;
        }

        if( this.isNew ){

          this.$el.addClass("new");

          //Create a text input for adding a subject or name
          var label = $(document.createElement("label"))
                        .text("Search by name, ORCID, or group name")
                        .addClass("subtle"),
              input = $(document.createElement("input"))
                        .attr("type", "text")
                        .attr("placeholder", "e.g. Lauren Walker");

          this.$el.append($(document.createElement("td"))
                            .addClass("search")
                            .attr("colspan", "2")
                            .append(label, input) );
        }
        else{
          try{
            //Create elements for the 'Name' column of this table row
            var subject = this.model.get("subject"),
                icon;

            //If the subject is public, don't display an icon
            if( subject == "public" ){
              icon = "";
            }
            //If this is a group subject, display the group icon
            else if( this.model.isGroup() ){
              icon = $(document.createElement("i")).addClass("icon icon-on-left icon-group");
            }
            //If this is a username, display the user icon
            else{
              icon = $(document.createElement("i")).addClass("icon icon-on-left icon-user");
            }

            //Create an element for the name - or subject, as a backup
            var name = $(document.createElement("span")).text( this.model.get("name") || this.model.get("subject") );
            this.$el.append($(document.createElement("td")).addClass("name").append(icon, name) );
          }
          catch(e){
            console.error("Couldn't render the name column of the AccessRuleView: ", e);
          }

          try{
            //If this subject is an ORCID, display the ORCID and ORCID icon
            if( subject.indexOf("orcid") >= 0 ){
              //Create the "subject/orcid" column
              var orcidImg = $(document.createElement("img")).attr("src", MetacatUI.root + "/img/orcid_64x64.png").addClass("orcid icon icon-on-left"),
                  orcid = $(document.createElement("span")).text( this.model.get("subject") );

              this.$el.append($(document.createElement("td")).addClass("subject").append(orcidImg, orcid) );
            }
            else{
              //For other subject types, don't display anything
              this.$el.append($(document.createElement("td")).addClass("subject"));
            }
          }
          catch(e){
            console.error("Couldn't render the subject column of the AccessRuleView: ", e);
          }
        }

        try{
          //Create the access/permission options select dropdown
          var accessOptions = $(document.createElement("select"));

          //Create option elements for each access rule type that is enabled in the app
          _.mapObject(MetacatUI.appModel.get("accessRuleOptions"), function(isEnabled, optionType){
            if( isEnabled ){
              var option = $(document.createElement("option")).attr("value", optionType).text( MetacatUI.appModel.get("accessRuleOptionNames")[optionType] );

              //If this is the access type enabled in this AccessRule, then select this option
              if( this.model.get(optionType) ){
                option.prop("selected", "selected");
              }

              accessOptions.append(option);
            }
          }, this);

          this.$el.append($(document.createElement("td")).addClass("access").append(accessOptions) );
        }
        catch(e){
          console.error("Couldn't render the access column of the AccessRuleView: ", e);
        }

        //If there is no name set on this model, listen to when it may be set, and update the view
        if( !this.model.get("name") ){
          this.listenToOnce(this.model, "change:name", this.updateName);
        }

      }
      catch(e){
        console.error(e);

        //Don't display a message to the user since this view is pretty small. Just remove it from the page.
        this.$el.remove();
      }

    },

    /**
    * Update the name in this view with the name from the model
    */
    updateName: function(){
      //If there is no name set on the model, exit now, so that we don't show an empty string or falsey value
      if( !this.model.get("name") ){
        return;
      }

      //Find the name element and update the text content
      this.$(".name span").text( this.model.get("name") );

    }

  });

  return AccessRuleView;

});
