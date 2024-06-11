"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/maps/share-url.html",
], ($, _, Backbone, Template) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "share-url";
  // The HTML classes to use for this view's HTML elements.
  const CLASS_NAMES = {
    copy: `${BASE_CLASS}__copy`,
    remove: `${BASE_CLASS}__remove`,
    hint: `${BASE_CLASS}__hint`,
    error: `${BASE_CLASS}__error`,
  };

  /**
   * @class ShareUrlView
   * @classdesc UI for copying the shareable URL to user's clipboard.
   * @classcategory Views/Maps
   * @name ShareUrlView
   * @augments Backbone.View
   * @screenshot views/maps/ShareUrlView.png
   * @since x.x.x
   * @constructs
   */
  const ShareUrlView = Backbone.View.extend(
    /** @lends ShareUrlView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ShareUrlView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: BASE_CLASS,

      /**
       * The events this view will listen to and the associated function to call.
       * @type {object}
       */
      events: {
        [`click .${CLASS_NAMES.copy}`]: "copyToClipboard",
        [`click .${CLASS_NAMES.remove}`]: "triggerBodyClick",
      },

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * @typedef {object} ShareUrlViewOptions
       * @property {number} left position for absolute positioning this element.
       * @property {number} top position for absolute positioning this element.
       * @property {Function} onRemove callback function to be executed before 
       * this View removes itself.
       */

      /**
       * Run when a new ShareUrlView is created.
       * @param {ShareUrlViewOptions} An object specifying configuration options
       * for the view.
       */
      initialize({ left, top, onRemove}) {
        this.left = left;
        this.top = top;

        // Skip the first click event since it opened this UI.
        this.skipEvent = true;

        this.documentClickHandler = (event) => {
          if (this.skipEvent) {
            this.skipEvent = false;
            return;
          } else if (this.el.contains(event.target)) {
            return;
          }

          document.removeEventListener("click", this.documentClickHandler);
          this.remove();
          onRemove();
        };

        document.addEventListener("click", this.documentClickHandler);
      },

      /**
       * Get the readonly input element.
       * @returns {jQuery} Element wrapping the input field.
       */
      getInput() {
        return this.$("input");
      },

      /**
       * Click the body element using jQuery to trigger the removal function
       * of this Backbone.View.
       */
      triggerBodyClick() {
        this.skipEvent = false;
        $("body").click();
      },

      /**
       * Attempt to copy the input text to the user's clipboard.
       * Note that this will fail for a variety of reasons, including if the
       * site is served via HTTP.
       */
      async copyToClipboard() {
        try {
          await navigator.clipboard.writeText(this.getInput().val());
          this.showHintText("Link copied to clipboard.");
        } catch (e) {
          this.showErrorText(
            "Copying to clipboard failed, try copying this link manually.",
          );
        }
      },

      /**
       * Show the user some additional information via a hint.
       * @param {string} text The text to display.
       */
      showHintText(text) {
        this.$el.find(`.${CLASS_NAMES.hint}`).text(text);
      },

      /**
       * Show the user some additional information via an error hint.
       * @param {string} text The text to display.
       */
      showErrorText(text) {
        this.$el.find(`.${CLASS_NAMES.error}`).text(text);
      },

      /**
       * Render the view by updating the HTML of the element.
       */
      render() {
        this.$el.html(
          this.template({
            classes: CLASS_NAMES,
            link: window.location.href,
          }),
        );

        this.$el.css({
          top: `${this.top}px`,
          left: `${this.left}px`,
        });
      },
    },
  );

  return ShareUrlView;
});
