/*global define */

define(['jquery', 'underscore', 'backbone', 'text!templates/login.html',
        'text!templates/alert.html', 'text!templates/loginButtons.html',
        'text!templates/loginOptions.html', 'text!templates/login-ldap.html'],
  function($, _, Backbone, LoginTemplate, AlertTemplate, LoginButtonsTemplate, LoginOptionsTemplate, LdapLoginTemplate) {
  'use strict';

  /**
  * @class SignInView
  * @classcategory Views
  * @extends Backbone.View
  * @screenshot views/SignInView.png
  */
  var SignInView = Backbone.View.extend(
    /** @lends SignInView.prototype */{

    template: _.template(LoginTemplate),
    alertTemplate: _.template(AlertTemplate),
    buttonsTemplate: _.template(LoginButtonsTemplate),
    loginOptionsTemplate: _.template(LoginOptionsTemplate),
    ldapTemplate: _.template(LdapLoginTemplate),

    tagName: "div",
    className: "sign-in-btns",

    ldapError: false,

    /* Set to true to only show the LDAP login form */
    ldapOnly: false,

    /* Set to true if this SignInView is the only thing on the page */
    fullPage: false,

    /* Set to true if this SignInView is in a modal window */
    inPlace: false,

    /**
    * Set a query string that will be added to the redirect URL
    * when the user has logged-in and is returned back to MetacatUI.
    * This can be useful to return back to MetacatUI with additional information
    * about the state of the app when the user left to sign in.
    * @type {string}
    * @example
    * // This example may tell the view that the register citation modal was open when Sign In was clicked
    * "registerCitation=true"
    * @default ""
    * @since 2.15.0
    */
    redirectQueryString: "",

    /*A message to display at the top of the view */
    topMessage: "",

    initialize: function(options){
      if(typeof options !== "undefined"){
        this.inPlace = options.inPlace;
        this.topMessage = options.topMessage;
        this.fullPage = options.fullPage;
        this.closeButtons = options.closeButtons === false? false : true;
      }
    },

    render: function(){
      //Don't render a SignIn view if there are no Sign In URLs configured
      if(!MetacatUI.appModel.get("signInUrlOrcid"))
        return this;

      var view = this;

      if(this.inPlace){
        this.$el.addClass("hidden modal");
        this.$el.attr("data-backdrop", "static");

        //Add a message to the top, if supplied
        if(typeof this.topMessage == "string")
          this.$el.prepend('<p class="center container">' + this.topMessage + '</p>');
        else if(typeof this.topMessage == "object")
          this.$el.prepend(this.topMessage);

        //Copy/paste the contents of the sign-in popup
        var signInBtns = $.parseHTML($("#signinPopup").html().trim()),
          signInBtnsContainer = $(document.createElement("div")).addClass("center container").html(signInBtns);

        signInBtnsContainer.find("a.signin").each(function(i, a){
          var url = $(a).attr("href");

          var redirectUrl = decodeURIComponent(url.substring( url.indexOf("target=")+7 ));

          var urlWithoutHttp = redirectUrl.substring( redirectUrl.indexOf("://") +  3 );
          var routeName = urlWithoutHttp.substring( urlWithoutHttp.indexOf("/") + 1 );

          if( !routeName ){
            redirectUrl = redirectUrl + "signinsuccess";
          }
          else if( _.contains(MetacatUI.uiRouter.getRouteNames(), MetacatUI.uiRouter.getRouteName(routeName)) ){
            redirectUrl = redirectUrl.substring(0, redirectUrl.indexOf(routeName)) + "signinsuccess";
          }

          url = url.substring(0, url.indexOf("target=")+7) + encodeURIComponent(redirectUrl);
          $(a).attr("href", url);
        });

        signInBtnsContainer.find("h1, h2").remove();

        this.$el.append(signInBtnsContainer);

        //Remove the accordion widget from the ldap login so it gets displayed as a popup window instead
        if( this.$("#signinLdap").length ){
          this.$("[href='" + "#signinLdap']").addClass("signin");
          this.$(".accordion").removeClass("accordion");
        }

        this.$el.prepend($(document.createElement("div")).addClass("container").prepend(
            $(document.createElement("a")).text("Close").addClass("close").prepend(
            $(document.createElement("i")).addClass("icon icon-on-left icon-remove"))));

        //Listen for clicks
        this.$("a.signin").on("click", function(e){
          //Get the link URL and change the target to a special route
          e.preventDefault();

          var link = e.target;
          if(link.nodeName != "A") link = $(link).parents("a");

          var url = $(link).attr("href");

          //Open up a new small window with this URL to allow the user to login
          window.open(url, "Login", "height=600,width=700");

          //Listen for successful sign-in
          window.listenForSignIn = setInterval(function(){
            MetacatUI.appUserModel.checkToken(function(data){
              $(".modal.sign-in-btns").modal("hide");
              clearInterval(window.listenForSignIn);

              if(MetacatUI.appUserModel.get("checked"))
                MetacatUI.appUserModel.trigger("change:checked");
              else
                MetacatUI.appUserModel.set("checked", true);
            });
          }, 750);
        });

        if( this.closeButtons ){
          this.$("a.close").on("click", function(e){
            view.$el.modal("hide");
          });
        }
        else{
          this.$(".close").remove();

          //Create a sign out link
          var divider     = document.createElement("hr"),
              signOutLink = $(document.createElement("a"))
                              .addClass("error underline")
                              .text("Sign Out");

          //Add the Sign Out link to the view
          this.$(".modal-body").append(divider, signOutLink);

          //If we're on the EML211EditorView, then show a warning message that unsaved changes will be lost
          if( MetacatUI.appView.currentView && MetacatUI.appView.currentView.type == "EML211Editor" ){
            signOutLink.after( $(document.createElement("p"))
              .addClass("error")
              .text("   Warning! - All your unsaved changes will be lost."));
          }

          //When the sign out link is clicked, we can just refresh the page.
          signOutLink.on("click", function(e){
            window.location.reload();
          });

        }
      }
      else{

        //If it's a full-page sign-in view, then empty it first
        if(this.el == MetacatUI.appView.el || this.fullPage){
          this.$el.empty();
          var container = document.createElement("div");
          container.className = "container login";

          if( this.ldapOnly ){

            var redirectUrl = window.location.origin + window.location.pathname;
            redirectUrl = redirectUrl.substring(0, redirectUrl.lastIndexOf("/"));
            redirectUrl + "/signinSuccessLdap";

            $(container).append(this.ldapTemplate({
              redirectUrl:  redirectUrl
            }));
            this.$el.append(container);

            //Hide all the other page elements so it's just the login form
            $("#Navbar, #HeaderContainer, #Footer").hide();
          }
          else{
            $(container).append(this.buttonsTemplate());
            this.$el.append(container);
          }

        }
        else{

          if( this.ldapOnly ){

            var redirectUrl = MetacatUI.root + "/signinSuccessLdap";

            this.$el.append(this.ldapTemplate({
              redirectUrl: redirectUrl
            }));

          }
          else{
            let signInUrl = MetacatUI.appModel.get('signInUrlOrcid') + window.location.href;

            if( this.redirectQueryString && this.redirectQueryString.length ){
              let currentQueryString = window.location.search;

              //If there is a current query string in the window.location, concatenate the
              // new query string properly
              if( currentQueryString.length ){

                //Exclude the "?" character from the query string, if it is there already
                if( this.redirectQueryString.charAt(0) == "?" ){
                  this.redirectQueryString = this.redirectQueryString.substring(1)
                }

                //Add the new query string parameters
                signInUrl += "&" + this.redirectQueryString;

              }
              else{
                signInUrl += "?" + this.redirectQueryString;
              }
            }

            this.$el.append(this.buttonsTemplate({
              signInUrl: signInUrl
            }));
          }

        }

        //Insert the sign in popup screen once
        if(!$("#signinPopup").length){
          var target = encodeURIComponent(window.location.href);
          var signInUrl = MetacatUI.appModel.get('signInUrl')? MetacatUI.appModel.get('signInUrl') + target : null;
          var signInUrlOrcid = MetacatUI.appModel.get('signInUrlOrcid') ? MetacatUI.appModel.get('signInUrlOrcid') + target : null;
          var signInUrlLdap = MetacatUI.appModel.get('signInUrlLdap') ? MetacatUI.appModel.get('signInUrlLdap') + target : null,
              redirectUrl = (window.location.href.indexOf("signinldaperror") > -1) ?
                  window.location.href.replace("signinldaperror", "") : window.location.href;

          $("body").append(this.template({
            signInUrl:  signInUrl,
            signInUrlOrcid:  signInUrlOrcid,
            signInUrlLdap:  signInUrlLdap,
            ldapLoginForm: this.ldapTemplate({
              redirectUrl: redirectUrl
            }),
            currentUrl: window.location.href,
            loginOptions: this.loginOptionsTemplate({ signInUrl: signInUrl }).trim(),
            collapseLdap: !MetacatUI.appUserModel.get("errorLogin"),
            redirectUrl: redirectUrl
          }));

          this.setUpPopup();
        }

        //If there is an error message in the URL, it means authentication has failed
        if(this.ldapError){
          MetacatUI.appUserModel.failedLdapLogin();
          this.failedLdapLogin();
        };
      }

      return this;
    },

    /*
     * This function is executed when LDAP authentication fails in the DataONE portal
     */
    failedLdapLogin: function(){
      //Insert an error message
      this.$("form").before(this.alertTemplate({
        classes: "alert-error",
        msg: "Incorrect username or password. Please try again."
      }));

      //If this is a full-page sign-in view, then take the form and insert it into the page
      if(this.$el.attr("id") == "Content" && !$("#Content form").length)
        $("#Content").html( $("#signinLdap").html() );
      //Else, just show the login in the modal window
      else if(!this.ldapOnly){
        $("#signinPopup").modal("show");
      }

      //Show the LDAP login form
      $('#signinLdap').removeClass("collapse").css("height", "auto");
    },

    setUpPopup: function(){
      var view = this;

      //Initialize the modal elements
      $("#signupPopup, #signinPopup").modal({
        show: false,
        shown: function(){

          //Update the sign-in URLs so we are redirected back to the previous page after authentication
          if( MetacatUI.appModel.get("enableCILogonSignIn") ){
            $("a.update-sign-in-url").attr("href", MetacatUI.appModel.get("signInUrl") + encodeURIComponent(window.location.href));
          }
          $("a.update-orcid-sign-in-url").attr("href", MetacatUI.appModel.get("signInUrlOrcid") + encodeURIComponent(window.location.href));

        }
      });
    },

    onClose: function(){
      this.$el.empty();

      if(window.listenForSignIn)  clearInterval(window.listenForSignIn);
    }
  });
  return SignInView;

});
