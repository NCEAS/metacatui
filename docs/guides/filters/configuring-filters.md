---
layout: guide
title: 🔎 Configuring Search Filters
id: configuring-filters
---

## Search Filters

In MetacatUI, search filters are models that define a Solr field, values to use in a query for that field, and options for how to display the filter in the UI. Filters are used in the [`CatalogSearchView`](/docs/CatalogSearchView.html) and the [`PortalDataView`](/docs/PortalDataView.html).

Filters which are combined to create a collection of data for a Portal can be built interactively using the [`QueryBuilderView`](/docs/QueryBuilderView.html) in the Portal Editor.

Custom search filters which users can use to subset a collection of portal data further can be designed and added to the portal in [`FilterEditorView`](/docs/FilterEditorView.html) in the Portal Editor.

Filters that are displayed in the repository-level `CatalogSearchView` are configured in the repository's [`config`](/docs/AppModel.html) file. See the [`Catalog Search View`](/guides/catalog-view-config.html) guide for more information.

## The parts of a filter model

Filters are defined in the [collections and portals XML schema repo](https://github.com/DataONEorg/collections-portals-schemas). See the [`FilterType`](https://github.com/DataONEorg/collections-portals-schemas/blob/48db8394506f5523597def6c9212aea3bfdee103/schemas/collections.xsd#L152-L210) to learn about the most essential parts of a filter model.

Filters are represented in MetacatUI by the [`Filter`](/docs/Filter.html) model and all of it's extended types.

### Filter groups

Filters can be grouped to create nested queries such as `((field1:value1 OR field1:value2) AND field2:value3)`. They can also be grouped to display related filters together in the UI. See the [`FilterGroup`](/docs/FilterGroup.html) model for more information.

## Custom Search Filters in Portals

This section gives information on how to configure the options that are available for users to create custom search filters in the [`CustomFilterBuilderView`](/docs/CustomFilterBuilderView.html) in the Portal Editor.

### How to hide a field from the custom filter builder

Add the Solr field name to [`AppConfig.collectionQueryExcludeFields`](https://nceas.github.io/metacatui/docs/AppConfig.html#collectionQueryExcludeFields). This will also hide the field from the Query Builder.


### Adding a new Solr field to the custom filter builder

When a new Solr field is added to the Solr schema, it will automatically get added to the `General`, or default, category in the custom filter builder and it can be used with any filter type (free text, dropdown, year slider, etc). There are several places to configure the Solr field so that it works as intended:

1. In [`QueryField.aliases()`](https://nceas.github.io/metacatui/docs/QueryField.html#aliases), add a human-readable alias for the field.
2. In [`QueryField.descriptions()`](https://nceas.github.io/metacatui/docs/QueryField.html#descriptions), add a short text description for the field.
3. Add the field to the corresponding category in [`QueryField.categoriesMap()`](https://nceas.github.io/metacatui/docs/QueryField.html#categoriesMap).
4. If this is a new Solr field `type`, add the `type` to the array of the corresponding filter type in [`QueryField.filterTypesMap()`](https://nceas.github.io/metacatui/docs/QueryField.html#filterTypesMap). If the new Solr field `type` is case-sensitive, add the `type` to the array in [`QueryField.caseSensitiveTypes()`](https://nceas.github.io/metacatui/docs/QueryField.html#caseSensitiveTypes)
