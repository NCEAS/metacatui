"use strict";

/**
 * A module to simplify the import of the Semantic UI library. Once this module is
 * imported, the Semantic UI library is available globally and the CSS is added to
 * the page. e.g. you can use `$('.ui.dropdown').dropdown()` in your code.
 * See usage docs at https://semantic-ui.com/introduction/getting-started.html
 * @since 0.0.0
 */
define([
  `jquery`,
  `${MetacatUI.root}/components/semantic/dist/semantic.min.js`,
  `text!${MetacatUI.root}/components/semantic/dist/semantic.min.css`,
], ($, _Semantic, SemanticCSS) => {
  MetacatUI.appModel.addCSS(SemanticCSS, "semantic");

  const $obj = $();

  // Return an object with classes, selectors, and other options from the
  // semantic modules that we use in our views.
  return {
    // Class names that we use in the view, including those from the dropdown
    // module
    CLASS_NAMES: {
      base: "ui",

      accordion: {
        ...$obj.accordion.settings.className,
        container: "accordion",
        title: "title",
        icon: "dropdown icon",
        content: "content",
      },
      dropdown: $obj.dropdown.settings.className,
      modal: {
        ...$obj.modal.settings.className,
        base: "modal",
        closeButton: "close",
        content: "content",
      },
      // Button & card & message modules CSS only and don't have jQuery settings
      button: {
        base: "button",
        labeled: "labeled",
      },
      card: {
        base: "card",
        content: "content",
        header: "header",
        meta: "meta",
        description: "description",
        extra: "extra",
      },
      message: {
        base: "message",
        header: "header",
      },
      grid: {
        floated: "floated",
        left: "left",
        right: "right",
      },
      // Variations apply to multiple modules
      variations: {
        floating: "floating",
        fluid: "fluid",
        styled: "styled",
        inverted: "inverted",
        mini: "mini",
        small: "small",
        info: "info",
        raised: "raised",
        attached: "attached",
      },
      colors: {
        blue: "blue",
      },
    },

    // Keys for the settings available in the accordion module
    ACCORDION_SETTINGS_KEYS: Object.keys($obj.accordion.settings),

    // Callbacks that can be set in the model for the accordion, e.g. onOpen
    ACCORDION_CALLBACKS: Object.keys($obj.accordion.settings).filter((key) =>
      /^on[A-Z]/.test(key),
    ),

    // Selectors for the dropdown module
    DROPDOWN_SELECTORS: $().dropdown.settings.selector,
  };
});
