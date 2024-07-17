define([
  "backbone",
  "semanticUItransition",
  `text!${MetacatUI.root}/components/semanticUI/transition.min.css`,
], (Backbone, _Transition, TransitionCSS) => {
  // Default class names for the separator element
  const CLASS_NAMES = {
    mainEl: "separator",
    highlighted: "changeable-separator",
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
      className: CLASS_NAMES.mainEl,

      /** @inheritdoc */
      tagName: "span",

      /**
       * The number of milliseconds to wait before showing the tooltip when the
       * hovers over this separator element.
       * @type {number}
       */
      tooltipShowDelay: 600,

      /**
       * The number of milliseconds to wait before hiding the tooltip when the
       * hovers over this separator element.
       * @type {number}
       */
      tooltipHideDelay: 80,

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

      /**
       * For separators that are changeable (see
       * {@link SearchableSelect#canChangeSeparator}), optional tooltip text to
       * show when a user hovers over.
       * @type {string}
       */
      tooltipText: "Click to switch the operator",

      /** @inheritdoc */
      initialize(opts) {
        MetacatUI.appModel.addCSS(TransitionCSS, "semanticUItransition");
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
        this.removeTooltip();
        this.$el.css("cursor", "default");
        this.$el.off("click mouseenter mouseout");
        this.stopListening(this.model);
      },

      /** Create and attach a tooltip */
      addTooltip() {
        const view = this;
        const { tooltipText } = this;
        if (!tooltipText) return;
        this.$el.tooltip("destroy");
        this.$el.tooltip({
          title: tooltipText,
          delay: {
            show: view.tooltipShowDelay || 0,
            hide: view.tooltipHideDelay || 0,
          },
        });
      },

      /** Remove the tooltip */
      removeTooltip() {
        this.$el.tooltip("destroy");
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
