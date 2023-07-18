---
layout: guide
title: Configuring the Catalog Search View
id: catalog-view-config
toc: true
---

This page provides instructions on how to customize a the main search page for a MetacatUI repository. This page is rendered by the Catalog Search View and includes a 3D map and a set of search filters. The map and filters can be set to suit the needs of the repository.

The 3D map uses the `cesium.js` library. For more information about Cesium and how to configure a Cesium Map model in general, see the general [Cesium guide](/guides/maps/cesium.html).

With the 2.25.0 release, MetacatUI introduced a new [`CatalogSearchView`](/docs/CatalogSearchView.html) that renders the main search page. This new view replaces the `DataCatalogView` that used Google Maps. The `DataCatalogView` will be deprecated in a future release, but to give time for repositories to migrate to the new `CatalogSearchView`, the `DataCatalogView` will remain the default view for the time being.

To enable the new `CatalogSearchView`, set the following properties in your [configuration file](/docs/AppConfig.html):

```js
{
  "useDeprecatedDataCatalogView": false,
  "enableCesium": true,
  "cesiumToken": "YOUR-CESIUM-ION-TOKEN"
}
```

The `cesiumToken` only needs to be set in order to enable access to layers and assets from [Cesium Ion](https://cesium.com/learn/ion/global-base-layers/). See the general [Cesium guide](/docs/guides/maps/cesium) for more information.

## Customizing the search filters

The default filters to use on the left hand side of the Catalog Search View are set in the [`defaultFilterGroups`](/docs/AppConfig.html#defaultFilterGroups) property of the [configuration file](/docs/AppConfig.html). This property is an array of objects that define the filters to use. See the guide about [customizing search filters](/guides/filters/configuring-filters.html) for more information.

## Map config

Options for Search View's map are set in the [`catalogSearchMapOptions`](docs/AppConfig.html#catalogSearchMapOptions) property of the [configuration file](/docs/AppConfig.html). This property is the same object used to define any `Map` model in MetacatUI. See the API docs for [`Map`](/docs/MapConfig.html) for complete documentation of the options.