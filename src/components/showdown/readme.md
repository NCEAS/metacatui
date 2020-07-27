# Showdown and the Markdown View

showdown is the markdown to HTML converter used by the MarkdownView.
The showdown folder contains all the components required for the MarkdownView (`src/js/views/MarkdownView.js`).

### Background:

- showdown github repository: https://github.com/showdownjs/showdown
    - wiki: https://github.com/showdownjs/showdown/wiki
- showdown website: http://showdownjs.com/
- metacatUI MarkdownView issue: https://github.com/NCEAS/metacatui/issues/820

### Extensions:

The markdown view uses 7 showdown extensions. The names of six of these extensions are listed in the `listRequiredExtensions` function in the MarkdownView:

```
var SDextensions = ["xssfilter", "katex", "highlight", "docbook", "showdown-htags", "bootstrap", "footnotes", "showdown-citation"];
```

They are also listed in `src/js/app.js` in the list of `require.config` `path`s.

All of the extensions' components (`.js` and `.css`) are found in the `src/components/showdown/extensions` directory.

### MarkdownView:

`render` sets a listener for the custom event `requiredExtensionsLoaded`. The event is triggered after the markdown has been tested to see which extensions are needed, and then those extensions are loaded. When the event is triggered, it passes in the list of required extensions (`SDextensions`) and `render` then creates a showdown converter (`var converter  = new showdown.Converter({...options...}`), converts the markdown, and appends it to the markdown template.

To trigger the event, `render` calls the `listRequiredExtensions` function. This function is where the potentially required extensions are listed. For each extension, there is one or more regular expressions that text the markdown to see whether the view should load the extension. The regex tests the markdown, not the html. For one extension, `xss-filter`, there is no regex since this extension should always be loaded.

Each time the view tests for an extension, it calls the `updateExtensionList` function. This function does two things, i) it removes an extension's name from the `SDextensions` array when it's not required, and ii) it updates the `numTestsTodo` variable, which keeps a count of how many tests are remaining. When `numTestsTodo` == 0, the `requiredExtensionsLoaded` event is triggered.
