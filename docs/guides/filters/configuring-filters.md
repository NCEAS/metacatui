---
layout: guide
title: Configuring custom filters
id: configuring-filters
---

## How to hide a field from the custom filter builder

Add the Solr field name to [`AppConfig.collectionQueryExcludeFields`](https://nceas.github.io/metacatui/docs/AppConfig.html#collectionQueryExcludeFields). This will also hide the field from the Query Builder.


## Adding a new Solr field to the custom filter builder

When a new Solr field is added to the Solr schema, it will automatically get added to the `General`, or default, category in the custom filter builder and it can be used with any filter type (free text, dropdown, year slider, etc). There are several places to configure the Solr field so that it works as intended:

1. In [`QueryField.aliases()`](https://nceas.github.io/metacatui/docs/QueryField.html#aliases), add a human-readable alias for the field.
2. In [`QueryField.descriptions()`](https://nceas.github.io/metacatui/docs/QueryField.html#descriptions), add a short text description for the field.
3. Add the field to the corresponding category in [`QueryField.categoriesMap()`](https://nceas.github.io/metacatui/docs/QueryField.html#categoriesMap).
4. If this is a new Solr field `type`, add the `type` to the array of the corresponding filter type in [`QueryField.filterTypesMap()`](https://nceas.github.io/metacatui/docs/QueryField.html#filterTypesMap). If the new Solr field `type` is case-sensitive, add the `type` to the array in [`QueryField.caseSensitiveTypes()`](https://nceas.github.io/metacatui/docs/QueryField.html#caseSensitiveTypes)
