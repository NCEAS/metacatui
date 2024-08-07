"use strict";

/**
 * A module to simplify the import of the Semantic UI library. Once this module is
 * imported, the Semantic UI library is available globally and the CSS is added to
 * the page. e.g. you can use `$('.ui.dropdown').dropdown()` in your code.
 * See usage docs at https://semantic-ui.com/introduction/getting-started.html
 * @since 0.0.0
 */
define([
  `${MetacatUI.root}/components/semantic/dist/semantic.min.js`,
  `text!${MetacatUI.root}/components/semantic/dist/semantic.min.css`
], (
  _Semantic,
  SemanticCSS
) => {
  MetacatUI.appModel.addCSS(SemanticCSS, "semantic");
  return true;
});