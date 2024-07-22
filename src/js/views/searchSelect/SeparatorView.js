"use strict";

define([
  "backbone",
  "semanticUItransition",
  "semanticUIpopup",
  `text!${MetacatUI.root}/components/semanticUI/transition.min.css`,
  `text!${MetacatUI.root}/components/semanticUI/popup.min.css`,
], (Backbone, _Transition, _Popup, TransitionCSS, PopupCSS) => {
  // Default class names for the separator element
  const BASE_CLASS = "separator";
  const CLASS_NAMES = {
    highlighted: `${BASE_CLASS}--hover`,
  };

  /**
   * @class SeparatorView
   * @classdesc Text that separates selected terms in a search select dropdown,
   * such as "AND" or "OR". These may be used to represent boolean operators in
   * a search query. The separator can be clicked to toggle between possible
   * values set in the SearchSelect model.
   * @classcategory Views/SearchSelect
   * @augments Backbone.View
   * @class
   * @since 0.0.0
   * @screenshot TODO
   */
  const SeparatorView = Backbone.View.extend(
    /** @lends SeparatorView.prototype */
    {
      /** @inheritdoc */
      type: "SeparatorView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /** @inheritdoc */
      tagName: "span",

      /**
       * Settings is passed to the Formantic UI popup module to configure a
       * tooltip shown when the user hovers over the separator. Set to `false`
       * to disable tooltips.
       * @see https://fomantic-ui.com/modules/popup.html#/settings
       * @type {object|boolean}
       */
      tooltipSettings: {
        content: "Click to switch the operator",
        delay: {
          show: 400,
          hide: 40,
        },
      },

      /**
       * Callback function to run when the user hovers. If not set, the default
       * behavior is to highlight the separator.
       * @type {Function}
       */
      mouseEnterCallback: null,

      /**
       * Callback function to run when the user stops hovering. If not set, the
       * default behavior is to unhighlight the separator.
       * @type {Function}
       */
      mouseOutCallback: null,

      /** @inheritdoc */
      initialize(opts) {
        MetacatUI.appModel.addCSS(TransitionCSS, "semanticUItransition");
        MetacatUI.appModel.addCSS(PopupCSS, "semanticUIpopup");
        // Set all the options on the view
        Object.keys(opts).forEach((key) => {
          this[key] = opts[key];
        });
        // Default to highlighting the separator on hover
        if (!this.mouseEnterCallback && !this.mouseOutCallback) {
          this.mouseEnterCallback = this.highlight;
          this.mouseOutCallback = this.unhighlight;
        }
      },

      /** @inheritdoc */
      render() {
        const view = this;
        view.setText();

        if (view.model.canChangeSeparator()) {
          view.activate();
        }

        return this;
      },

      /** Update the text of the separator element to match the model */
      setText() {
        this.$el.text(this.model.get("separator"));
      },

      /**
       * Add event listeners to the element to allow the user to change the
       * separator text by clicking on it. Add visual indicators to show that
       * the separator is clickable.
       */
      activate() {
        const view = this;
        const { $el } = this;

        view.deactivate();

        view.addTooltip();
        $el.css("cursor", "pointer");

        // Update the model when the separator is clicked, and update the text
        // in the view when the model changes (the model may be changed by other
        // views)
        view.listenTo(view.model, "change:separator", view.updateText);
        $el.on("click", () => {
          view.model.setNextSeparator();
        });

        $el.on("mouseenter", () => {
          if (view.mouseEnterCallback) {
            view.mouseEnterCallback.call(view);
          }
        });
        $el.on("mouseout", () => {
          if (view.mouseOutCallback) {
            view.mouseOutCallback.call(view);
          }
        });
      },

      /** Remove event listeners and visual indicators */
      deactivate() {
        this.$el.css("cursor", "default");
        this.$el.off("click mouseenter mouseout");
        this.stopListening(this.model);
      },

      /** Create and attach a tooltip */
      addTooltip() {
        const settings = this.tooltipSettings;
        if (!settings) return;
        this.$el.popup(settings);
      },

      /** Visually emphasize the separator */
      highlight() {
        this.$el.addClass(CLASS_NAMES.highlighted);
      },

      /** Visually de-emphasize the separator */
      unhighlight() {
        this.$el.removeClass(CLASS_NAMES.highlighted);
      },

      /** Update the text shown in the separator element */
      updateText() {
        const view = this;
        const text = this.model.get("separator");
        if (!text) return;
        this.$el.transition({
          animation: "pulse",
          displayType: "inline-block",
          duration: "250ms",
          onComplete: () => {
            view.setText();
          },
        });
      },

      /** @inheritdoc */
      remove() {
        this.deactivate();
        Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return SeparatorView;
});
