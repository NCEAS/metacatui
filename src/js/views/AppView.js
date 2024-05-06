﻿/*global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "views/AltHeaderView",
  "views/NavbarView",
  "views/FooterView",
  "views/SignInView",
  "text!templates/alert.html",
  "text!templates/appHead.html",
  "text!templates/jsonld.txt",
  "text!templates/app.html",
  "text!templates/loading.html",
], function (
  $,
  _,
  Backbone,
  AltHeaderView,
  NavbarView,
  FooterView,
  SignInView,
  AlertTemplate,
  AppHeadTemplate,
  JsonLDTemplate,
  AppTemplate,
  LoadingTemplate
) {
  "use strict";

  var app = app || {};

  /**
   * @class AppView
   * @classdesc The top-level view of the UI that contains and coordinates all other views of the UI
   * @classcategory Views
   * @extends Backbone.View
   */
  var AppView = Backbone.View.extend(
    /** @lends AppView.prototype */ {
      // Instead of generating a new element, bind to the existing skeleton of
      // the App already present in the HTML.
      el: "#metacatui-app",

      //Templates
      template: _.template(AppTemplate),
      alertTemplate: _.template(AlertTemplate),
      appHeadTemplate: _.template(AppHeadTemplate),
      jsonLDTemplate: _.template(JsonLDTemplate),
      loadingTemplate: _.template(LoadingTemplate),

      events: {
        click: "closePopovers",
        "click .btn.direct-search": "routeToMetadata",
        "keypress input.direct-search": "routeToMetadataOnEnter",
        "click .toggle-slide": "toggleSlide",
        "click input.copy": "higlightInput",
        "focus input.copy": "higlightInput",
        "click textarea.copy": "higlightInput",
        "focus textarea.copy": "higlightInput",
        "click .open-chat": "openChatWithMessage",
        "click .login.redirect": "sendToLogin",
        "focus .jump-width-input": "widenInput",
        "focusout .jump-width-input": "narrowInput",
        "click .temporary-message .close": "hideTemporaryMessage",
      },

      initialize: function () {
        //Check for the LDAP sign in error message
        if (
          window.location.search.indexOf(
            "error=Unable%20to%20authenticate%20LDAP%20user"
          ) > -1
        ) {
          window.location =
            window.location.origin +
            window.location.pathname +
            "#signinldaperror";
        }

        //Is there a logged-in user?
        MetacatUI.appUserModel.checkStatus();

        //Change the document title when the app changes the MetacatUI.appModel title at any time
        this.listenTo(MetacatUI.appModel, "change:title", this.changeTitle);
        this.listenTo(MetacatUI.appModel, "change:description", this.changeDescription);

        this.checkIncompatibility();
      },

      /**
      * The JS query selector for the element inside the AppView that contains the main view contents. When a new view is routed to
      * and displayed via {@link AppView#showView}, the view will be inserted into this element.
      * @type {string}
      * @default "#Content"
      * @since 2.22.0
      */
      contentSelector: "#Content",

      /**
       * Gets the Element in this AppView via the {@link AppView#contentSelector}
       * @returns {Element}
       */
      getContentEl: function () {
        return this.el.querySelector(this.contentSelector);
      },

      /**
       * Change the web document's title
       */
      changeTitle: function () {
        document.title = MetacatUI.appModel.get("title");
      },

      /**
       * Change the web document's description
       * @since 2.25.0
       */
      changeDescription: function () {
        $("meta[name=description]").attr(
          "content",
          MetacatUI.appModel.get("description")
        );
      },

      /** Render the main view and/or re-render subviews. Delegate rendering
        and event handling to sub views.
    ---
    If there is no AppView element on the page, don't render the application.
     ---
    If there is no AppView element on the page, this function will exit without rendering anything.
    For instance, this can occur when the AppView is loaded during unit tests.
    See {@link AppView#el} to check which element is required for rendering. By default,
    it is set to the element with the `metacatui-app` id (check docs for the most up-to-date info).
    ----
    This step is usually unnecessary for Backbone Views since they should only render elements inside of
    their own `el` anyway. But the APpView is different since it renders the overall structure of MetacatUI.
    */
      render: function () {
        //If there is no AppView element on the page, don't render the application.
        if (!this.el) {
          console.error(
            "Not rendering the UI of the app since the AppView HTML element (AppView.el) does not exist on the page. Make sure you have the AppView element included in index.html"
          );
          return;
        }

        // set up the head - make sure to prepend, otherwise the CSS may be out of order!
        $("head")
          .append(
            this.appHeadTemplate({
              theme: MetacatUI.theme
            })
          )
          //Add the JSON-LD to the head element
          .append(
            $(document.createElement("script"))
              .attr("type", "application/ld+json")
              .attr("id", "jsonld")
              .html(this.jsonLDTemplate())
          );

        // set up the body
        this.$el.append(this.template());

        /**
         * @name MetacatUI.navbarView
         * @type NavbarView
         * @description The view that displays a navigation menu on every MetacatUI page and controls the navigation between pages in MetacatUI.
         */
        MetacatUI.navbarView = new NavbarView();
        MetacatUI.navbarView.setElement($("#Navbar")).render();

        /**
         * @name MetacatUI.altHeaderView
         * @type AltHeaderView
         * @description The view that displays a header on every MetacatUI view that uses the "AltHeader" header type.
         * This header is usually for decorative / aesthetic purposes only.
         */
        MetacatUI.altHeaderView = new AltHeaderView();
        MetacatUI.altHeaderView.setElement($("#HeaderContainer")).render();

        /**
         * @name MetacatUI.footerView
         * @type FooterView
         * @description The view that displays the main footer of the MetacatUI page.
         * It has informational and navigational links in it and is displayed on every page, except for views that hide it for full-screen display.
         */
        MetacatUI.footerView = new FooterView();
        MetacatUI.footerView.setElement($("#Footer")).render();

        this.showTemporaryMessage();

        //Load the Slaask chat widget if it is enabled in this theme
        if (MetacatUI.appModel.get("slaaskKey") && window._slaask)
          _slaask.init(MetacatUI.appModel.get("slaaskKey"));

        this.listenForActivity();
        this.listenForTimeout();

        this.initializeWidgets();

        return this;
      },

      // the currently rendered view
      currentView: null,

      // Our view switcher for the whole app
      showView: function (view, viewOptions) {
        if (!this.el) {
          console.error(
            "Not rendering the UI of the app since the AppView HTML element (AppView.el) does not exist on the page. Make sure you have the AppView element included in index.html"
          );
          return;
        }

        //reference to appView
        var thisAppViewRef = this;

        // Change the background image if there is one
        MetacatUI.navbarView.changeBackground();

        // close the current view
        if (this.currentView) {
          //If the current view has a function to confirm closing of the view, call it
          if (typeof this.currentView.canClose == "function") {
            //If the user or view confirmed that the view shouldn't be closed, then don't navigate to the next route
            if (!this.currentView.canClose()) {
              //Get a confirmation message from the view, or use a default one
              if (
                typeof this.currentView.getConfirmCloseMessage == "function"
              ) {
                var confirmMessage = this.currentView.getConfirmCloseMessage();
              } else {
                var confirmMessage = "Leave this page?";
              }

              //Show a confirm alert to the user and wait for their response
              var leave = confirm(confirmMessage);
              //If they clicked Cancel, then don't navigate to the next route
              if (!leave) {
                MetacatUI.uiRouter.undoLastRoute();
                return;
              }
            }
          }

          // need reference to the old/current view for the callback method
          var oldView = this.currentView;

          this.currentView.$el.fadeOut("slow", function () {
            // clean up old view
            if (oldView.onClose) oldView.onClose();

            //If the view to show is not the same as the main content element, then put it inside the content element.
            if (view.el !== thisAppViewRef.getContentEl()) {
              thisAppViewRef.getContentEl().replaceChildren(view.el);
              $(thisAppViewRef.getContentEl()).show();
            }

            view.$el.fadeIn("slow", function () {
              // render the new view
              view.render(viewOptions);

              // after fade in, do postRender()
              if (view.postRender) view.postRender();
              // force scroll to top if no custom scrolling is implemented
              else thisAppViewRef.scrollToTop();
            });
          });
        } else {
          //If the view to show is not the same as the main content element, then put it inside the content element.
          if (view.el !== this.getContentEl()) {
            this.getContentEl().replaceChildren(view.el);
          }

          // just show the view without transition
          view.render(viewOptions);

          if (view.postRender) view.postRender();
          // force scroll to top if no custom scrolling is implemented
          else thisAppViewRef.scrollToTop();
        }

        // track the current view
        this.currentView = view;
        MetacatUI.analytics?.trackPageView();

        this.trigger("appRenderComplete");
      },

      routeToMetadata: function (e) {
        e.preventDefault();

        //Get the value from the input element
        var form = $(e.target).attr("form") || null,
          val = this.$("#" + form)
            .find("input[type=text]")
            .val();

        //Remove the text from the input
        this.$("#" + form)
          .find("input[type=text]")
          .val("");

        if (!val) return false;

        MetacatUI.uiRouter.navigate("view/" + val, { trigger: true });
      },

      routeToMetadataOnEnter: function (e) {
        //If the user pressed a key inside a text input, we only want to proceed if it was the Enter key
        if (e.type == "keypress" && e.keycode != 13) return;
        else this.routeToMetadata(e);
      },

      sendToLogin: function (e) {
        if (e) e.preventDefault();

        var url = $(e.target).attr("href");
        url = url.substring(0, url.indexOf("target=") + 7);
        url += window.location.href;

        window.location.href = url;
      },

      resetSearch: function () {
        // Clear the search and map model to start a fresh search
        MetacatUI.appSearchModel.clear();
        MetacatUI.appSearchModel.set(MetacatUI.appSearchModel.defaults());
        MetacatUI.mapModel.clear();
        MetacatUI.mapModel.set(MetacatUI.mapModel.defaults());

        //Clear the search history
        MetacatUI.appModel.set("searchHistory", new Array());

        MetacatUI.uiRouter.navigate("data", { trigger: true });
      },

      closePopovers: function (e) {
        if (this.currentView && this.currentView.closePopovers)
          this.currentView.closePopovers(e);
      },

      toggleSlide: function (e) {
        if (e) e.preventDefault();
        else return false;

        var clickedOn = $(e.target),
          toggleElId =
            clickedOn.attr("data-slide-el") ||
            clickedOn.parents("[data-slide-el]").attr("data-slide-el"),
          toggleEl = $("#" + toggleElId);

        toggleEl.slideToggle("fast", function () {
          //Toggle the display of the link if it has the right class
          if (clickedOn.is(".toggle-display-on-slide")) {
            clickedOn.siblings(".toggle-display-on-slide").toggle();
            clickedOn.toggle();
          }
        });
      },

      /**
       * Displays the given message to the user in a Bootstrap "alert" style.
       * @param {object} options A literal object of options for the alert message.
       * @property {string|Element} options.message A message string or HTML Element to display
       * @property {string} [options.classes] A string of HTML classes to set on the alert
       * @property {string|Element} [options.container] The container to show the alert in
       * @property {boolean} [options.replaceContents] If true, the alert will replace the contents of the container element.
       *                                               If false, the alert will be prepended to the container element.
       * @property {boolean|number} [options.delay] Set to true or specify a number of milliseconds to display the alert temporarily
       * @property {boolean} [options.remove] If true, the user will be able to remove the alert with a "close" icon.
       * @property {boolean} [options.includeEmail] If true, the alert will include a link to the {@link AppConfig#emailContact}
       * @property {string} [options.emailBody] Specify an email body to use in the email link.
       * @returns {Element} The alert element
       */
      showAlert: function () {
        if (arguments.length > 1) {
          var options = {
            message: arguments[0],
            classes: arguments[1],
            container: arguments[2],
            delay: arguments[3],
          };
          if (typeof arguments[4] == "object") {
            options = _.extend(options, arguments[4]);
          }
        } else {
          var options = arguments[0];
        }

        if (typeof options != "object" || !options) {
          return;
        }

        if (!options.classes) options.classes = "alert-success";

        if (!options.container || !$(options.container).length)
          options.container = this.$el;

        //Remove any alerts that are already in this container
        if ($(options.container).children(".alert-container").length > 0)
          $(options.container).children(".alert-container").remove();

        //Allow messages to be HTML or strings
        if (typeof options.message != "string")
          options.message = $(document.createElement("div"))
            .append($(options.message))
            .html();

        var emailOptions = "";

        //Check for more options
        if (options.emailBody) emailOptions += "?body=" + options.emailBody;

        var alert = $.parseHTML(
          this.alertTemplate({
            msg: options.message,
            classes: options.classes,
            emailOptions: emailOptions,
            remove: options.remove || false,
            includeEmail: options.includeEmail,
          }).trim()
        );

        if (options.delay) {
          $(alert).hide();

          if (options.replaceContents) {
            $(options.container).html(alert);
          } else {
            $(options.container).prepend(alert);
          }

          $(alert)
            .show()
            .delay(typeof options.delay == "number" ? options.delay : 3000)
            .fadeOut();
        } else {
          if (options.replaceContents) {
            $(options.container).html(alert);
          } else {
            $(options.container).prepend(alert);
          }
        }
        return alert;
      },

      /**
       * Previous to MetacatUI 2.14.0, the {@link AppView#showAlert} function allowed up to five parameters
       * to customize the alert message. As of 2.14.0, the function has condensed these options into
       * a single literal object. See the docs for {@link AppView#showAlert}. The old signature of five
       * parameters may soon be deprecated completely, but is still supported.
       * @deprecated
       * @param {string|Element} msg
       * @param {string} [classes]
       * @param {string|Element} [container]
       * @param {boolean} [delay]
       * @param {object} [options]
       * @param {boolean} [options.includeEmail] If true, the alert will include a link to the {@link AppConfig#emailContact}
       * @param {string} [options.emailBody]
       * @param {boolean} [options.remove]
       * @param {boolean} [options.replaceContents]
       */
      showAlert_deprecated: function (
        msg,
        classes,
        container,
        delay,
        options
      ) {},

      /**
       * Listens to the focus event on the window to detect when a user switches back to this browser tab from somewhere else
       * When a user checks back, we want to check for log-in status
       */
      listenForActivity: function () {
        MetacatUI.appUserModel.on("change:loggedIn", function () {
          if (!MetacatUI.appUserModel.get("loggedIn")) return;

          //When the user re-focuses back on the window
          $(window).focus(function () {
            //If the user has logged out in the meantime, then exit
            if (!MetacatUI.appUserModel.get("loggedIn")) return;

            //If the expiration date of the token has passed, then allow the user to sign back in
            if (MetacatUI.appUserModel.get("expires") <= new Date()) {
              MetacatUI.appView.showTimeoutSignIn();
            }
          });
        });
      },

      /**
       * Will determine the length of time until the user's current token expires,
       * and will set a window timeout for that length of time. When the timeout
       * is triggered, the sign in modal window will be displayed so that the user
       * can sign in again (which happens in AppView.showTimeoutSignIn())
       */
      listenForTimeout: function () {
        //Only proceed if the user is logged in
        if (!MetacatUI.appUserModel.get("checked")) {
          //When the user logged back in, listen again for the next timeout
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            function () {
              //If the user is logged in, then listen call this function again
              if (
                MetacatUI.appUserModel.get("checked") &&
                MetacatUI.appUserModel.get("loggedIn")
              )
                this.listenForTimeout();
            }
          );

          return;
        } else if (!MetacatUI.appUserModel.get("loggedIn")) {
          //When the user logged back in, listen again for the next timeout
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:loggedIn",
            function () {
              //If the user is logged in, then listen call this function again
              if (
                MetacatUI.appUserModel.get("checked") &&
                MetacatUI.appUserModel.get("loggedIn")
              )
                this.listenForTimeout();
            }
          );

          return;
        }

        var view = this,
          expires = MetacatUI.appUserModel.get("expires"),
          timeLeft = expires - new Date();

        //If there is no time left until expiration, then show the sign in view now
        if (timeLeft < 0) {
          this.showTimeoutSignIn();
        }
        //Otherwise, set a timeout for a expiration time, then show the Sign In View
        else {
          var timeoutId = setTimeout(function () {
            view.showTimeoutSignIn.call(view);
          }, timeLeft);

          //Save the timeout id in case we want to destroy the timeout later
          MetacatUI.appUserModel.set("timeoutId", timeoutId);
        }
      },

      /**
       * If the user's auth token has expired, a new SignInView model window is
       * displayed so the user can sign back in. A listener is set on the appUserModel
       * so that when they do successfully sign back in, we set another timeout listener
       * via AppView.listenForTimeout()
       */
      showTimeoutSignIn: function () {
        if (MetacatUI.appUserModel.get("expires") <= new Date()) {
          MetacatUI.appUserModel.set("loggedIn", false);

          var signInView = new SignInView({
            inPlace: true,
            closeButtons: false,
            topMessage:
              "Your session has timed out. Click Sign In to open a " +
              "new window to sign in again. Make sure your browser settings allow pop-ups.",
          });
          var signInForm = signInView.render().el;

          if (this.subviews && Array.isArray(this.subviews))
            this.subviews.push(signInView);
          else this.subviews = [signInView];

          $("body").append(signInForm);
          $(signInForm).modal();

          //When the user logged back in, listen again for the next timeout
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            function () {
              if (
                MetacatUI.appUserModel.get("checked") &&
                MetacatUI.appUserModel.get("loggedIn")
              )
                this.listenForTimeout();
            }
          );
        }
      },

      openChatWithMessage: function () {
        if (!_slaask) return;

        $("#slaask-input").val(MetacatUI.appModel.get("defaultSupportMessage"));
        $("#slaask-button").trigger("click");
      },

      initializeWidgets: function () {
        // Autocomplete widget extension to provide description tooltips.
        $.widget("app.hoverAutocomplete", $.ui.autocomplete, {
          // Set the content attribute as the "item.desc" value.
          // This becomes the tooltip content.
          _renderItem: function (ul, item) {
            // if we have a label, use it for the title
            var title = item.value;
            if (item.label) {
              title = item.label;
            }
            // if we have a description, use it for the content
            var content = item.value;
            if (item.desc) {
              content = item.desc;
              if (item.desc != item.value) {
                content += " (" + item.value + ")";
              }
            }
            var element = this._super(ul, item)
              .attr("data-title", title)
              .attr("data-content", content);
            element.popover({
              placement: "right",
              trigger: "hover",
              container: "body",
            });
            return element;
          },
        });
      },

      /**
       * Checks if the user's browser is an outdated version that won't work with
       * MetacatUI well, and displays a warning message to the user..
       * The user agent is checked against the `unsupportedBrowsers` list in the AppModel.
       */
      checkIncompatibility: function () {
        //Check if this browser is incompatible with this app. i.e. It is an old browser version
        var isUnsupportedBrowser = _.some(
          MetacatUI.appModel.get("unsupportedBrowsers"),
          function (browserRegEx) {
            var matches = navigator.userAgent.match(browserRegEx);
            return matches && matches.length > 0;
          }
        );

        if (!isUnsupportedBrowser) {
          return;
        } else {
          //Show a warning message to the user about their browser.
          this.showAlert(
            "Your web browser is out of date. Update your browser for more security, " +
              "speed and the best experience on this site.",
            "alert-warning",
            this.$el,
            false,
            { remove: true }
          );
          this.$el
            .children(".alert-container")
            .addClass("important-app-message");
        }
      },

      /**
       * Shows a temporary message at the top of the view
       */
      showTemporaryMessage: function () {
        try {
          //Is there a temporary message to display throughout the app?
          if (MetacatUI.appModel.get("temporaryMessage")) {
            var startTime = MetacatUI.appModel.get("temporaryMessageStartTime"),
              endTime = MetacatUI.appModel.get("temporaryMessageEndTime"),
              today = new Date(),
              isDisplayed = false;

            //Find cases where we should display the message
            //If there is a date range and today is in the range
            if (startTime && endTime && today > startTime && today < endTime) {
              isDisplayed = true;
            }
            //If there's just a start time and today is after it
            else if (startTime && !endTime && today > startTime) {
              isDisplayed = true;
            }
            //If there's just an end time and today is before it
            else if (!startTime && endTime && today < endTime) {
              isDisplayed = true;
            }
            //If there's no start or end time
            else if (!startTime && !endTime) {
              isDisplayed = true;
            }

            if (isDisplayed) {
              require(["text!templates/alert.html"], function (alertTemplate) {
                //Get classes for the message
                var classes =
                  MetacatUI.appModel.get("temporaryMessageClasses") || "";
                classes += " temporary-message";

                var container =
                  MetacatUI.appModel.get("temporaryMessageContainer") ||
                  "#Navbar";

                //If the message exists already, return
                if ($(container + " .temporary-message").length) {
                  return;
                }

                //Insert the message using the Alert template
                $(container).prepend(
                  _.template(alertTemplate)({
                    classes: classes,
                    msg: MetacatUI.appModel.get("temporaryMessage"),
                    includeEmail: MetacatUI.appModel.get(
                      "temporaryMessageIncludeEmail"
                    ),
                    remove: true,
                  })
                );

                //Add a class to the body in case we need to adjust other elements on the page
                $("body").addClass("has-temporary-message");
              });
            }
          }
        } catch (e) {
          console.error("Couldn't display the temporary message: ", e);
        }
      },

      /**
       * Hides the temporary message
       */
      hideTemporaryMessage: function () {
        try {
          this.$(".temporary-message").remove();
          $("body").removeClass("has-temporary-message");
        } catch (e) {
          console.error("Couldn't hide the temporary message: ", e);
        }
      },

      /********************** Utilities ********************************/
      // Various utility functions to use across the app //
      /************ Function to add commas to large numbers ************/
      commaSeparateNumber: function (val) {
        if (!val) return 0;

        if (val < 1) return Math.round(val * 100) / 100;

        while (/(\d+)(\d{3})/.test(val.toString())) {
          val = val.toString().replace(/(\d+)(\d{3})/, "$1" + "," + "$2");
        }
        return val;
      },
      numberAbbreviator: function (number, decimalPlaces) {
        if (number === 0) {
          return 0;
        }
        decimalPlaces = Math.pow(10, decimalPlaces);
        var abbreviations = ["K", "M", "B", "T"];

        // Go through the array backwards, so we do the largest first
        for (var i = abbreviations.length - 1; i >= 0; i--) {
          // Convert array index to "1000", "1000000", etc
          var size = Math.pow(10, (i + 1) * 3);

          // If the number is bigger or equal do the abbreviation
          if (size <= number) {
            // Here, we multiply by decimalPlaces, round, and then divide by decimalPlaces.
            // This gives us nice rounding to a particular decimal place.
            number =
              Math.round((number * decimalPlaces) / size) / decimalPlaces;

            // Handle special case where we round up to the next abbreviation
            if (number == 1000 && i < abbreviations.length - 1) {
              number = 1;
              i++;
            }

            // Add the letter for the abbreviation
            number += abbreviations[i];
            break;
          }
        }
        return number;
      },
      higlightInput: function (e) {
        if (!e) return;

        e.preventDefault();
        e.target.setSelectionRange(0, 9999);
      },

      widenInput: function (e) {
        $(e.target).css("width", "200px");
      },

      narrowInput: function (e) {
        $(e.target).delay(500).animate({ width: "60px" });
      },

      // scroll to top of page
      scrollToTop: function () {
        $("body,html")
          .stop(true, true) //stop first for it to work in FF
          .animate({ scrollTop: 0 }, "slow");
        return false;
      },

      scrollTo: function (pageElement, offsetTop) {
        //Find the header height if it is a fixed element
        var headerOffset =
          this.$("#Header").css("position") == "fixed"
            ? this.$("#Header").outerHeight()
            : 0;
        var navOffset =
          this.$("#Navbar").css("position") == "fixed"
            ? this.$("#Navbar").outerHeight()
            : 0;
        var totalOffset = headerOffset + navOffset;

        $("body,html")
          .stop(true, true) //stop first for it to work in FF
          .animate(
            { scrollTop: $(pageElement).offset().top - 40 - totalOffset },
            1000
          );
        return false;
      },
    }
  );
  return AppView;
});
