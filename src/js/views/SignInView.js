define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/login.html",
  "text!templates/alert.html",
  "text!templates/loginButtons.html",
  "text!templates/loginOptions.html",
], function (
  $,
  _,
  Backbone,
  LoginTemplate,
  AlertTemplate,
  LoginButtonsTemplate,
  LoginOptionsTemplate,
) {
  "use strict";

  /**
   * @class SignInView
   * @classcategory Views
   * @extends Backbone.View
   * @screenshot views/SignInView.png
   */
  var SignInView = Backbone.View.extend(
    /** @lends SignInView.prototype */ {
      template: _.template(LoginTemplate),
      alertTemplate: _.template(AlertTemplate),
      buttonsTemplate: _.template(LoginButtonsTemplate),
      loginOptionsTemplate: _.template(LoginOptionsTemplate),

      tagName: "div",
      className: "sign-in-btns",

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

      initialize: function (options) {
        if (typeof options !== "undefined") {
          this.inPlace = options.inPlace;
          this.topMessage = options.topMessage;
          this.fullPage = options.fullPage;
          this.closeButtons = options.closeButtons === false ? false : true;
        }
      },

      render: function () {
        //Don't render a SignIn view if there are no Sign In URLs configured
        if (!MetacatUI.appModel.get("signInUrlOrcid")) return this;

        var view = this;

        if (this.inPlace) {
          this.$el.addClass("hidden modal");
          this.$el.attr("data-backdrop", "static");

          //Add a message to the top, if supplied
          if (typeof this.topMessage == "string")
            this.$el.prepend(
              '<p class="center container">' + this.topMessage + "</p>",
            );
          else if (typeof this.topMessage == "object")
            this.$el.prepend(this.topMessage);

          //Copy/paste the contents of the sign-in popup
          var signInBtns = $.parseHTML($("#signinPopup").html().trim()),
            signInBtnsContainer = $(document.createElement("div"))
              .addClass("center container")
              .html(signInBtns);

          signInBtnsContainer.find("a.signin").each(function (i, a) {
            var url = $(a).attr("href");

            var redirectUrl = decodeURIComponent(
              url.substring(url.indexOf("target=") + 7),
            );

            var urlWithoutHttp = redirectUrl.substring(
              redirectUrl.indexOf("://") + 3,
            );
            var routeName = urlWithoutHttp.substring(
              urlWithoutHttp.indexOf("/") + 1,
            );

            if (!routeName) {
              redirectUrl = redirectUrl + "signinsuccess";
            } else if (
              _.contains(
                MetacatUI.uiRouter.getRouteNames(),
                MetacatUI.uiRouter.getRouteName(routeName),
              )
            ) {
              redirectUrl =
                redirectUrl.substring(0, redirectUrl.indexOf(routeName)) +
                "signinsuccess";
            }

            url =
              url.substring(0, url.indexOf("target=") + 7) +
              encodeURIComponent(redirectUrl);
            $(a).attr("href", url);
          });

          signInBtnsContainer.find("h1, h2").remove();

          this.$el.append(signInBtnsContainer);

          this.$el.prepend(
            $(document.createElement("div"))
              .addClass("container")
              .prepend(
                $(document.createElement("a"))
                  .text("Close")
                  .addClass("close")
                  .prepend(
                    $(document.createElement("i")).addClass(
                      "icon icon-on-left icon-remove",
                    ),
                  ),
              ),
          );

          //Listen for clicks
          this.$("a.signin").on("click", function (e) {
            //Get the link URL and change the target to a special route
            e.preventDefault();

            var link = e.target;
            if (link.nodeName != "A") link = $(link).parents("a");

            var url = $(link).attr("href");

            //Open up a new small window with this URL to allow the user to login
            window.open(url, "Login", "height=600,width=700");

            //Listen for successful sign-in
            window.listenForSignIn = setInterval(function () {
              MetacatUI.appUserModel.checkToken(function (data) {
                $(".modal.sign-in-btns").modal("hide");
                clearInterval(window.listenForSignIn);

                if (MetacatUI.appUserModel.get("checked"))
                  MetacatUI.appUserModel.trigger("change:checked");
                else MetacatUI.appUserModel.set("checked", true);
              });
            }, 750);
          });

          if (this.closeButtons) {
            this.$("a.close").on("click", function (e) {
              view.$el.modal("hide");
            });
          } else {
            this.$(".close").remove();

            //Create a sign out link
            var divider = document.createElement("hr"),
              signOutLink = $(document.createElement("a"))
                .addClass("error underline")
                .text("Sign Out");

            //Add the Sign Out link to the view
            this.$(".modal-body").append(divider, signOutLink);

            //If we're on the EML211EditorView, then show a warning message that unsaved changes will be lost
            if (
              MetacatUI.appView.currentView &&
              MetacatUI.appView.currentView.type == "EML211Editor"
            ) {
              signOutLink.after(
                $(document.createElement("p"))
                  .addClass("error")
                  .text("   Warning! - All your unsaved changes will be lost."),
              );
            }

            //When the sign out link is clicked, we can just refresh the page.
            signOutLink.on("click", function (e) {
              window.location.reload();
            });
          }
        } else {
          //If it's a full-page sign-in view, then empty it first
          if (this.el == MetacatUI.appView.el || this.fullPage) {
            this.$el.empty();
            var container = document.createElement("div");
            container.className = "container login";

            $(container).append(
              this.buttonsTemplate({
                signInUrl:
                  MetacatUI.appModel.get("signInUrlOrcid") +
                  this.getRedirectURL(),
              }),
            );
            this.$el.append(container);
          } else {
            let signInUrl =
              MetacatUI.appModel.get("signInUrlOrcid") + this.getRedirectURL();

            this.$el.append(
              this.buttonsTemplate({
                signInUrl: signInUrl,
              }),
            );
          }

          //Insert the sign in popup screen once
          if (!$("#signinPopup").length) {
            var target = this.getRedirectURL();
            var signInUrl = MetacatUI.appModel.get("signInUrl")
              ? MetacatUI.appModel.get("signInUrl") + target
              : null;
            var signInUrlOrcid = MetacatUI.appModel.get("signInUrlOrcid")
              ? MetacatUI.appModel.get("signInUrlOrcid") + target
              : null;

            const redirectUrl = window.location.href;

            $("body").append(
              this.template({
                signInUrl: signInUrl,
                signInUrlOrcid: signInUrlOrcid,
                currentUrl: window.location.href,
                loginOptions: this.loginOptionsTemplate({
                  signInUrl: signInUrl,
                }).trim(),
                redirectUrl: redirectUrl,
              }),
            );

            this.setUpPopup();
          }
        }

        return this;
      },

      setUpPopup: function () {
        var view = this;

        //Initialize the modal elements
        $("#signupPopup, #signinPopup").modal({
          show: false,
          shown: function () {
            //Update the sign-in URLs so we are redirected back to the previous page after authentication
            if (MetacatUI.appModel.get("enableCILogonSignIn")) {
              $("a.update-sign-in-url").attr(
                "href",
                MetacatUI.appModel.get("signInUrl") +
                  encodeURIComponent(window.location.href),
              );
            }
            $("a.update-orcid-sign-in-url").attr(
              "href",
              MetacatUI.appModel.get("signInUrlOrcid") +
                encodeURIComponent(window.location.href),
            );
          },
        });
      },

      /**
       * Constructs and returns a string of the URL that the user should return to when they are done signing in.
       * This URL is sent to the DataONE portal service during login, via the `target` URL attribute. The DataONE
       * portal will redirect the user back to the `target` URL when sign in is complete.
       * @returns {string}
       */
      getRedirectURL: function () {
        let redirectURL = window.location.href;

        if (this.redirectQueryString && this.redirectQueryString.length) {
          let currentQueryString = window.location.search;

          //If there is a current query string in the window.location, concatenate the
          // new query string properly
          if (currentQueryString.length) {
            //Exclude the "?" character from the query string, if it is there already
            if (this.redirectQueryString.charAt(0) == "?") {
              this.redirectQueryString = this.redirectQueryString.substring(1);
            }

            //Add the new query string parameters
            redirectURL += "&" + this.redirectQueryString;
          } else {
            redirectURL += "?" + this.redirectQueryString;
          }
        }

        return redirectURL;
      },

      onClose: function () {
        this.$el.empty();

        if (window.listenForSignIn) clearInterval(window.listenForSignIn);
      },
    },
  );
  return SignInView;
});
