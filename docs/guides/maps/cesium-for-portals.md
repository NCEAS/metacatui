---
layout: guide
title: Configuring Cesium Maps for Portals
id: cesium-for-portals
toc: true
---

This page outlines the process of integrating a Cesium Map into a [Portal document](https://github.com/DataONEorg/collections-portals-schemas/blob/master/schemas/portals.xsd).

For background on Cesium, as well as detailed guidelines on how to customize a Cesium Map model, please refer to our [Cesium guide](cesium).

## How to Configure a Cesium Map Section within a Portal Document

To integrate a Cesium map visualization into a portal XML document, you need to define the map's appearance and layering structure using JSON. This JSON configuration is then embedded into an `<option>` element which lies within a `<section>` element. The `<option>` element requires two distinct components: an `<optionName>` set as `mapConfig` and an `<optionValue>` that encompasses the aforementioned JSON configuration. Please ensure that the JSON is enclosed within `CDATA` tags.

Here's an example:

```xml
<section>
  <label>My Cesium Map</label>
  <title>My Cesium Map</title>
  <option>
    <optionName>sectionType</optionName>
    <optionValue>visualization</optionValue>
  </option>
  <option>
    <optionName>visualizationType</optionName>
    <optionValue>cesium</optionValue>
  </option>
  <option>
    <optionName>mapConfig</optionName>
    <optionValue>
<![CDATA[{
  "homePosition": {...},
  ...
  "showFeatureInfo": false
}]]>
      </optionValue>
    </option>
  </section>
```
