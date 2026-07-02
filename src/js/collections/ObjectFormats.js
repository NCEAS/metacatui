"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "common/ValueUtilities",
  "x2js",
  "models/formats/ObjectFormat",
], ($, _, Backbone, ValueUtilities, X2JS, ObjectFormat) => {
  const FORMAT_IDS = {
    RESOURCE_MAP: "http://www.openarchives.org/ore/terms",
  };

  const DEFAULT_FORMAT_ID = "application/octet-stream";

  const FORMAT_TYPES = Object.freeze({
    RESOURCE: "RESOURCE",
    METADATA: "METADATA",
    DATA: "DATA",
  });

  const FORMAT_TYPE_VALUES = Object.values(FORMAT_TYPES);

  const EML_FORMATS = [
    "eml://ecoinformatics.org/*",
    "https://eml.ecoinformatics.org/*",
  ];

  const PREFERRED_EXTENSION_FORMAT_IDS = {
    jpg: "image/jpeg",
    json: "application/json",
    nc: "netCDF-3",
    rdf: "application/rdf+xml",
    tiff: "image/tiff",
    xls: "application/vnd.ms-excel",
    xml: "text/xml",
    zip: "application/zip",
  };

  const FRIENDLY_FORMAT_NAMES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "Microsoft Excel OpenXML",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "Microsoft Word OpenXML",
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12":
      "Microsoft Office Excel 2007 binary workbooks",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "Microsoft Office OpenXML Presentation",
    "application/vnd.ms-excel": "Microsoft Excel",
    "application/msword": "Microsoft Word",
    "application/vnd.ms-powerpoint": "Microsoft Powerpoint",
    "text/html": "HTML",
    "text/plain": "plain text (.txt)",
    "text/csv": "CSV",
    "text/comma-separated-values": "CSV",
    "text/tab-separated-values": "TSV",
    "video/avi": "Microsoft AVI file",
    "video/x-ms-wmv": "Windows Media Video (.wmv)",
    "audio/x-ms-wma": "Windows Media Audio (.wma)",
    "application/vnd.google-earth.kml xml":
      "Google Earth Keyhole Markup Language (KML)",
    "http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html":
      "annotation",
    "application/mathematica": "Mathematica Notebook",
    "application/postscript": "Postscript",
    "application/rtf": "Rich Text Format (RTF)",
    "application/xml": "XML Application",
    "text/xml": "XML",
    "application/x-fasta": "FASTA sequence file",
    "nexus/1997": "NEXUS File Format for Systematic Information",
    "anvl/erc-v02":
      "Kernel Metadata and Electronic Resource Citations (ERCs), 2010.05.13",
    "http://purl.org/dryad/terms/":
      "Dryad Metadata Application Profile Version 3.0",
    "http://datadryad.org/profile/v3.1":
      "Dryad Metadata Application Profile Version 3.1",
    "application/pdf": "PDF",
    "application/zip": "ZIP file",
    "http://www.w3.org/TR/rdf-syntax-grammar": "RDF/XML",
    "http://www.w3.org/TR/rdfa-syntax": "RDFa",
    "application/rdf xml": "RDF",
    "text/turtle": "TURTLE",
    "text/n3": "N3",
    "application/x-gzip": "GZIP Format",
    "application/x-python": "Python script",
    "http://www.w3.org/2005/Atom": "ATOM-1.0",
    "application/octet-stream": "octet stream (application file)",
    "http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd":
      "Darwin Core, v2.0",
    "http://rs.tdwg.org/dwc/xsd/simpledarwincore/": "Simple Darwin Core",
    "eml://ecoinformatics.org/eml-2.1.0": "EML v2.1.0",
    "eml://ecoinformatics.org/eml-2.1.1": "EML v2.1.1",
    "eml://ecoinformatics.org/eml-2.0.1": "EML v2.0.1",
    "eml://ecoinformatics.org/eml-2.0.0": "EML v2.0.0",
    "https://eml.ecoinformatics.org/eml-2.2.0": "EML v2.2.0",
  };

  // So that the collection can be used immediately. Various processes in
  // MetacatUI need to know about formats before other actions happen, like
  // rendering. This gets updated with the server-provided formats when the
  // collection is fetched.
  const FALLBACK_FORMATS = Object.freeze(
    `eml://ecoinformatics.org/eml-2.0.0|Ecological Metadata Language, version 2.0.0|METADATA|text/xml|xml
eml://ecoinformatics.org/eml-2.0.1|Ecological Metadata Language, version 2.0.1|METADATA|text/xml|xml
eml://ecoinformatics.org/eml-2.1.0|Ecological Metadata Language, version 2.1.0|METADATA|text/xml|xml
eml://ecoinformatics.org/eml-2.1.1|Ecological Metadata Language, version 2.1.1|METADATA|text/xml|xml
https://eml.ecoinformatics.org/eml-2.2.0|Ecological Metadata Language, version 2.2.0|METADATA|text/xml|xml
http://www.esri.com/metadata/esriprof80.dtd|ESRI Profile of the Content Standard for Digital Geospatial Metadata, March 2003|METADATA|text/xml|xml
FGDC-STD-001.1-1999|Content Standard for Digital Geospatial Metadata, Biological Data Profile, version 001.1-1999|METADATA|text/xml|xml
FGDC-STD-001.2-1999|Content Standard for Digital Geospatial Metadata, Metadata Profile for Shoreline Data, version 001.2-1999|METADATA|text/xml|xml
FGDC-STD-001-1998|Content Standard for Digital Geospatial Metadata, version 001-1998|METADATA|text/xml|xml
INCITS-453-2009|North American Profile of ISO 19115: 2003 Geographic Information - Metadata|METADATA|text/xml|xml
http://www.unidata.ucar.edu/namespaces/netcdf/ncml-2.2|NetCDF Markup Language, version 2.2|METADATA|application/ncML+xml|ncml
CF-1.0|NetCDF Climate and Forecast Metadata Convention, version 1.0|DATA|application/netcdf|nc
CF-1.1|NetCDF Climate and Forecast Metadata Convention, version 1.1|DATA|application/netcdf|nc
CF-1.2|NetCDF Climate and Forecast Metadata Convention, version 1.2|DATA|application/netcdf|nc
CF-1.3|NetCDF Climate and Forecast Metadata Convention, version 1.3|DATA|application/netcdf|nc
CF-1.4|NetCDF Climate and Forecast Metadata Convention, version 1.4|DATA|application/netcdf|nc
CF-1.5|NetCDF Climate and Forecast Metadata Convention, version 1.5|DATA|application/netcdf|nc
CF-1.6|NetCDF Climate and Forecast Metadata Convention, version 1.6|DATA|application/netcdf|nc
CF-1.7|NetCDF Climate and Forecast Metadata Convention, version 1.7|DATA|application/netcdf|nc
netCDF-CF|NetCDF Climate and Forecast Metadata Convention|DATA|application/netcdf|nc
http://www.cuahsi.org/waterML/1.0/|Water Markup Language, version 1.0|DATA|text/xml|xml
http://www.cuahsi.org/waterML/1.1/|Water Markup Language, version 1.1|DATA|text/xml|xml
http://www.loc.gov/METS/|Metadata Encoding and Transmission Standard, version 1|METADATA|text/xml|xml
netCDF-3|Network Common Data Format, version 3|DATA|application/netcdf|nc
netCDF-4|Network Common Data Format, version 4|DATA|application/netcdf|nc
text/plain|Plain Text|DATA|text/plain|txt
text/csv|Comma Separated Values Text|DATA|text/csv|csv
image/bmp|Bitmap Image File|DATA|image/bmp|bmp
image/gif|Graphics Interchange Format|DATA|image/gif|gif
image/jp2|JPEG 2000|DATA|image/jp2|jpg
image/jpeg|JPEG|DATA|image/jpeg|jpg
image/png|Portable Network Graphics|DATA|image/png|png
image/svg+xml|Scalable Vector Graphics|DATA|image/svg+xml|svg
image/tiff|Tagged Image File Format|DATA|image/tiff|tiff
http://rs.tdwg.org/dwc/xsd/simpledarwincore/|Simple Darwin Core|METADATA|text/xml|xml
http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd|Darwin Core, version 2.0|METADATA|text/xml|xml
application/octet-stream|Octet Stream|DATA|application/octet-stream|data
http://www.w3.org/2005/Atom|ATOM-1.0|DATA|application/atom+xml|atom
text/n3|N3|DATA|text/n3|rdf
text/turtle|TURTLE|DATA|text/turtle|ttl
application/rdf+xml|Resource Description Framework|DATA|application/rdf+xml|rdf
http://www.w3.org/TR/rdf-testcases/#ntriples|N-TRIPLE|DATA|text/plain|nt
http://www.w3.org/TR/rdf-syntax-grammar|RDF/XML|DATA|application/rdf+xml|rdf
http://www.w3.org/TR/rdfa-syntax|RDFa|DATA|application/xhtml+xml|xhtml
http://www.openarchives.org/ore/terms|Object Reuse and Exchange Vocabulary|RESOURCE|application/rdf+xml|rdf
application/pdf|Portable Document Format|DATA|application/pdf|pdf
http://datadryad.org/profile/v3.1|Dryad Metadata Application Profile Version 3.1|METADATA|text/xml|xml
http://purl.org/dryad/terms/|Dryad Metadata Application Profile Version 3.0|METADATA|text/xml|xml
application/vnd.ms-excel|Microsoft Excel file format|DATA|application/vnd.ms-excel|xls
application/msword|Microsoft Word file format|DATA|application/msword|doc
anvl/erc-v02|Kernel Metadata and Electronic Resource Citations (ERCs), 2010.05.13|DATA|text/anvl|anvl
nexus/1997|NEXUS File Format for Systematic Information|DATA|text/plain|nxs
application/zip|Zip file format|DATA|application/zip|zip
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet|Microsoft Excel OpenXML|DATA|application/vnd.openxmlformats-officedocument.spreadsheetml.sheet|xlsx
application/vnd.openxmlformats-officedocument.wordprocessingml.document|Microsoft Word OpenXML|DATA|application/vnd.openxmlformats-officedocument.wordprocessingml.document|docx
application/x-fasta|FASTA sequence file|DATA|application/x-fasta|fasta
text/xml|Extensible Markup Language|DATA|text/xml|xml
application/xml|Extensible Markup Language Application|DATA|application/xml|xml
application/rtf|Rich Text Format|DATA|application/rtf|rtf
text/html|Hypertext Markup Language|DATA|text/html|html
application/postscript|Postscript|DATA|application/postscript|ps
audio/x-wav|Wave Audio Format|DATA|audio/x-wav|wav
application/mathematica|Mathematica Notebook|DATA|application/mathematica|nb
video/quicktime|Quicktime Video|DATA|video/quicktime|mov
application/x-gzip|GZIP Format|DATA|application/x-gzip|gz
application/x-python|Python programming language script|DATA|text/x-python|py
video/x-ms-wmv|Windows Media Video File|DATA|video/x-ms-wmv|wmv
audio/x-ms-wma|Windows Media Audio File|DATA|audio/x-ms-wma|wma
video/avi|Microsoft Audio Video Interleave (AVI) File|DATA|video/avi|avi
video/mpeg|MPEG-1 Video|DATA|video/mpeg|mpg
audio/mpeg|MPEG-1 or MPEG-2 Audio Layer III|DATA|audio/mpeg|mp3
video/mp4|MPEG-4 Video|DATA|video/mp4|mp4
application/x-tar|Tape Archive File|DATA|application/x-tar|tar
application/x-bzip2|Bzip2 Compressed File|DATA|application/x-bzip2|zip
application/vnd.google-earth.kml+xml|Google Earth Keyhole Markup Language (KML)|DATA|application/vnd.google-earth.kml+xml|kml
application/x-rar-compressed|Roshal Archive File|DATA|application/x-rar-compressed|rar
application/vnd.ms-excel.sheet.binary.macroEnabled.12|Microsoft Office Excel 2007 binary workbooks|DATA|application/vnd.ms-excel.sheet.binary.macroEnabled.12|xls
application/vnd.ms-powerpoint|Microsoft Office Powerpoint|DATA|application/vnd.ms-powerpoint|ppt
application/vnd.openxmlformats-officedocument.presentationml.presentation|Microsoft Office OpenXML Presentation|DATA|application/vnd.openxmlformats-officedocument.presentationml.presentation|pptx
-//ecoinformatics.org//eml-access-2.0.0beta4//EN|Ecological Metadata Language, Access module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-attribute-2.0.0beta4//EN|Ecological Metadata Language, Attribute module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-constraint-2.0.0beta4//EN|Ecological Metadata Language, Constraint module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-coverage-2.0.0beta4//EN|Ecological Metadata Language, Coverage module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-dataset-2.0.0beta4//EN|Ecological Metadata Language, Dataset module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-distribution-2.0.0beta4//EN|Ecological Metadata Language, Distribution module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-entity-2.0.0beta4//EN|Ecological Metadata Language, Entity module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-literature-2.0.0beta4//EN|Ecological Metadata Language, Literature module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-party-2.0.0beta4//EN|Ecological Metadata Language, Party module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-physical-2.0.0beta4//EN|Ecological Metadata Language, Physical module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-project-2.0.0beta4//EN|Ecological Metadata Language, Project module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-protocol-2.0.0beta4//EN|Ecological Metadata Language, Protocol module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-resource-2.0.0beta4//EN|Ecological Metadata Language, Resource module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-software-2.0.0beta4//EN|Ecological Metadata Language, Software module, version 2.0.0beta4|METADATA|text/xml|xml
-//ecoinformatics.org//eml-access-2.0.0beta6//EN|Ecological Metadata Language, Access module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-attribute-2.0.0beta6//EN|Ecological Metadata Language, Attribute module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-constraint-2.0.0beta6//EN|Ecological Metadata Language, Constraint module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-coverage-2.0.0beta6//EN|Ecological Metadata Language, Coverage module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-dataset-2.0.0beta6//EN|Ecological Metadata Language, Dataset module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-distribution-2.0.0beta6//EN|Ecological Metadata Language, Distribution module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-entity-2.0.0beta6//EN|Ecological Metadata Language, Entity module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-literature-2.0.0beta6//EN|Ecological Metadata Language, Literature module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-party-2.0.0beta6//EN|Ecological Metadata Language, Party module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-physical-2.0.0beta6//EN|Ecological Metadata Language, Physical module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-project-2.0.0beta6//EN|Ecological Metadata Language, Project module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-protocol-2.0.0beta6//EN|Ecological Metadata Language, Protocol module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-resource-2.0.0beta6//EN|Ecological Metadata Language, Resource module, version 2.0.0beta6|METADATA|text/xml|xml
-//ecoinformatics.org//eml-software-2.0.0beta6//EN|Ecological Metadata Language, Software module, version 2.0.0beta6|METADATA|text/xml|xml
ddi:codebook:2_5|Data Documentation Initiative, Codebook version 2.5|METADATA|text/xml|xml
http://www.icpsr.umich.edu/DDI|Data Documentation Initiative, Codebook version 2.1|METADATA|text/xml|xml
http://purl.org/ornl/schema/mercury/terms/v1.0|Oak Ridge National Lab Mercury Metadata version 1.0|METADATA|text/xml|xml
http://datacite.org/schema/kernel-3.0|DataCite Metadata Schema version 3.0|METADATA|text/xml|xml
http://datacite.org/schema/kernel-3.1|DataCite Metadata Schema version 3.1|METADATA|text/xml|xml
http://www.nexml.org/2009|NeXML 2009|DATA|text/xml|xml
http://ns.dataone.org/metadata/schema/onedcx/v1.0|DataONE Dublin Core Extended v1.0|METADATA|text/xml|xml
http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html|AnnotatorJS 1.2.x Annotation model|RESOURCE|application/json|json
http://www.isotc211.org/2005/gmd|Geographic MetaData (GMD) Extensible Markup Language|METADATA|text/xml|xml
http://www.isotc211.org/2005/gmd-noaa|NOAA Variant Geographic MetaData (GMD) Extensible Markup Language|METADATA|text/xml|xml
http://www.isotc211.org/2005/gmd-pangaea|PANGAEA Variant Geographic MetaData (GMD) Extensible Markup Language|METADATA|text/xml|xml
application/bagit-097|BagIt File Packaging Format Version 0.97|DATA||
text/tsv|Tab Separated Values Text|DATA|text/tab-separated-values|tsv
application/R|R programming language script|DATA|text/x-rsrc|R
application/MATLAB|MATLAB programming language script|DATA|text/x-matlab|m
application/SAS|SAS programming language script|DATA|text/x-sas|sas
application/vnd.google-earth.kmz|Google Earth Keyhole Markup Language (KML) Compressed archive|DATA|application/vnd.google-earth.kmz|kmz
application/MATLAB-v7.3|Mathworks MATLAB version 7.3 (R2006b or later) binary file - HDF5 compatible|DATA|application/octet-stream|mat
application/MATLAB-v7|Mathworks MATLAB version 7 (R14 or later) binary file|DATA|application/octet-stream|mat
application/MATLAB-v6|Mathworks MATLAB version 6 (R8 or later) binary file|DATA|application/octet-stream|mat
application/MATLAB-v4|Mathworks MATLAB version 4 binary file|DATA|application/octet-stream|mat
application/json|JavaScript Object Notation (JSON) file|DATA|application/json|json
application/json-ld|JavaScript Object Notation (JSON) Linked Data file|DATA|application/ld+json|json
text/markdown|Markdown file|DATA|text/markdown|md
text/x-rmarkdown|R Markdown file|DATA|text/markdown|Rmd
image/x-raw|RAW digital sensor image file|DATA|application/octet-stream|raw
http://www.openarchives.org/OAI/2.0/oai_dc/|OAI-PMH Dublin Core v2.0, with online related resource|METADATA|text/xml|xml
application/x-hdf|Hierarchical Data Format version 4 (HDF4)|DATA|application/x-hdf|h4
application/x-hdf5|Hierarchical Data Format version 5 (HDF5)|DATA|application/x-hdf5|h5
https://purl.dataone.org/collections-1.0.0|Dataset collections v1.0.0|METADATA|text/xml|xml
https://purl.dataone.org/portals-1.0.0|Dataset portals v1.0.0|METADATA|text/xml|xml
https://purl.dataone.org/collections-1.1.0|Dataset collections v1.1.0|METADATA|text/xml|xml
https://purl.dataone.org/portals-1.1.0|Dataset portals v1.1.0|METADATA|text/xml|xml
application/vnd.shp+zip|Esri Shapefile (zipped)|DATA|application/vnd.shp+zip|zip
image/geotiff|GeoTIFF|DATA|image/tiff|tiff
image/geotiff+zip|GeoTIFF (zipped)|DATA|image/tiff+zip|zip
https://doi.org/10.5063/schema/codemeta-1.0|CodeMeta, version 1.0|DATA|application/ld+json|json
https://doi.org/10.5063/schema/codemeta-2.0|CodeMeta, version 2.0|DATA|application/ld+json|json
application/x-sh|Bourne shell script|DATA|application/x-sh|sh
application/x-ipynb+json|Jupyter Notebook|DATA|application/x-ipynb+json|ipynb
science-on-schema.org/Dataset;ld+json|JSON-LD metadata|METADATA|application/ld+json|jsonld
application/geopackage+sqlite3|GeoPackage Encoding Standard (OGC) Format Family|DATA|application/geopackage+sqlite3|gpkg
application/geo+json|GeoJSON|DATA|application/geo+json|json
application/vnd.gdb+zip|Esri File Geodatabase (zipped)|DATA|application/vnd.gdb+zip|zip
application/vnd.apache.parquet|Apache Parquet|DATA|application/vnd.apache.parquet|parquet
application/vnd.sqlite3|SQLite Database|DATA|application/vnd.sqlite3|db
https://ns.dataone.org/service/types/v2.0#SystemMetadata|System Metadata|METADATA|text/xml|xml
http://ns.dataone.org/service/types/v2.0#ObjectFormatList|Object Format List|METADATA|text/xml|xml
application/x-cdf|Common Data Format (CDF)|DATA|application/x-cdf|cdf
application/fits|Flexible Image Transport System (FITS)|DATA|application/fits|fits
Zarr|Zarr|DATA|application/x+zarr|zarr
ASDF|Advanced Scientific Data Format (ASDF)|DATA|application/x-asdf+yaml|asdf
application/gpx+xml|Global Positioning System XML (GPX)|DATA|application/gpx+xml|gpx`
      .trim()
      .split("\n")
      .map((row) => {
        const [formatId, formatName, formatType, mediaType, extension] =
          row.split("|");
        return {
          formatId,
          formatName,
          formatType,
          ...(mediaType ? { mediaType } : {}),
          ...(extension ? { extension } : {}),
        };
      }),
  );

  const FALLBACK_FORMAT_NAMES = Object.fromEntries(
    FALLBACK_FORMATS.map(({ formatId, formatName }) => [formatId, formatName]),
  );

  /**
   * @class ObjectFormats
   * @classdesc ObjectFormats represents the DataONE object format list found at
   * https://cn.dataone.org/cn/v2/formats, or the Coordinating Node environment
   * configured `AppModel.d1CNBaseUrl` This collection starts with built-in
   * fallback definitions and refreshes from the configured formats service when
   * available.
   * @classcategory Collections
   * @augments Backbone.Collection
   * @class
   */
  const ObjectFormats = Backbone.Collection.extend(
    /** @lends ObjectFormats.prototype */ {
      FORMAT_IDS,
      DEFAULT_FORMAT_ID,
      FORMAT_TYPES,
      FORMAT_TYPE_VALUES,
      EML_FORMATS,
      FALLBACK_FORMATS,

      model: ObjectFormat,

      /**
       * Initialize fallback and remote-fetch state for the collection.
       * @param {object[]|Backbone.Model[]} [models] Initial format models.
       * @param {object} [options] Collection options.
       * @param {boolean} [options.remote] Whether the models are remote
       * formats.
       * @param {boolean} [options.fallback] Set false to skip fallback formats.
       * @since 0.0.0
       */
      initialize(models, options = {}) {
        this.hasRemoteFormats = options.remote === true;
        this.usingFallback = models == null && options.fallback !== false;
        if (this.usingFallback) {
          this.reset(FALLBACK_FORMATS, { silent: true });
        }
      },

      /**
       * The constructed URL of the collection (/cn/v2/formats)
       * @returns {string} - The URL to use during fetch
       */
      url() {
        // no need for authentication token, just the URL
        return MetacatUI.appModel.get("formatsServiceUrl");
      },

      /**
       * Retrieve the formats from the Coordinating Node
       * @param {object} [options] Options to pass to Backbone fetch.
       * @augments Backbone.Collection#fetch
       * @returns {jqXHR} Backbone fetch request.
       */
      fetch(options) {
        const fetchOptions = _.extend({ dataType: "text" }, options);
        const { success } = fetchOptions;
        fetchOptions.success = (collection, response, fetchOptionsArg) => {
          Object.assign(collection, {
            hasRemoteFormats: true,
            usingFallback: false,
            lastFetchError: null,
          });
          if (typeof success === "function") {
            success.call(
              fetchOptions.context,
              collection,
              response,
              fetchOptionsArg,
            );
          }
        };
        return Backbone.Model.prototype.fetch.call(this, fetchOptions);
      },

      /**
       * Parse the XML response from the CN
       * @param {string|object} response XML response text, or parsed formats.
       * @returns {object[]} Parsed object formats.
       */
      parse(response) {
        // If the collection is already parsed, just return it
        if (typeof response === "object") return response;

        // Otherwise, parse it
        const x2js = new X2JS();
        const formats = x2js.xml_str2json(response);

        return formats.objectFormatList.objectFormat;
      },

      /**
       * Convert a DataONE format ID into a human-readable format name.
       * @param {string} formatId Format ID to convert.
       * @returns {string} Friendly format name, or the original value when no
       * match is available.
       * @since 0.0.0
       */
      getFriendlyFormat(formatId) {
        if (!formatId) return formatId;
        return (
          FRIENDLY_FORMAT_NAMES[formatId] ||
          this.findWhere({ formatId })?.get("formatName") ||
          formatId
        );
      },

      /**
       * Given a formatId, filename, and/or mediaType, return the best matching
       * formatId from the collection.
       * @param {object} props Format matching properties.
       * @param {string} [props.formatId] - The formatId to match against the
       * collection
       * @param {string} [props.filename] - The filename to match against the
       * collection
       * @param {string} [props.mediaType] - The mediaType to match against the
       * collection
       * @returns {string} - The best matching formatId from the collection, or
       * the default formatId if no match is found.
       * @since 0.0.0
       */
      getFormatId({ formatId, filename, mediaType }) {
        if (formatId) return formatId;

        const file = ValueUtilities.normalizeText(filename);
        const mt = ValueUtilities.normalizeText(mediaType);
        const ext = ValueUtilities.extractFileExtension(file);
        const singleFormatId = (models) =>
          models.length === 1 ? models[0].get("formatId") : null;

        const formatIdMedia = mt
          ? this.findWhere({ formatId: mt })?.get("formatId") ||
            singleFormatId(this.where({ mediaType: mt }))
          : null;
        let formatIdExt = null;
        if (ext) {
          const preferredFormatId = PREFERRED_EXTENSION_FORMAT_IDS[ext];
          formatIdExt = preferredFormatId
            ? this.findWhere({ formatId: preferredFormatId })?.get("formatId")
            : singleFormatId(
                this.filter(
                  (format) =>
                    ValueUtilities.normalizeText(
                      format.get("extension"),
                    )?.toLowerCase() === ext,
                ),
              );
        }

        // A spreadsheet media type can mask a plain CSV file; prefer the
        // extension so ".csv" files are not reported as Excel.
        if (
          formatIdMedia === "application/vnd.ms-excel" &&
          formatIdExt === "text/csv"
        ) {
          return formatIdExt;
        }

        return formatIdMedia || formatIdExt || DEFAULT_FORMAT_ID;
      },

      /**
       * Determine the DataONE format type for a format signal.
       * @param {object} props Format properties.
       * @param {string} [props.formatType] Explicit format type.
       * @param {string} [props.formatId] DataONE format ID.
       * @param {string} [props.filename] File name used for extension matching.
       * @param {string} [props.mediaType] Media type used for format matching.
       * @returns {string|null} One of "RESOURCE", "METADATA", "DATA", or null
       * when no match is available.
       * @since 0.0.0
       */
      getFormatType(props) {
        const { formatType } = props;
        if (formatType) {
          const normalizedFormatType =
            ValueUtilities.normalizeText(formatType)?.toLowerCase();
          const matchedFormatType = FORMAT_TYPE_VALUES.find(
            (type) => type.toLowerCase() === normalizedFormatType,
          );
          if (matchedFormatType) return matchedFormatType;
        }
        const format = this.findWhere({ formatId: this.getFormatId(props) });
        return format ? format.get("formatType") : null;
      },

      /**
       * Check whether format properties identify science metadata.
       * @param {object} props Format properties accepted by
       * {@link ObjectFormats#getFormatType}.
       * @returns {boolean} True when the format type is METADATA.
       * @since 0.0.0
       */
      isMetadata(props) {
        return this.getFormatType(props) === FORMAT_TYPES.METADATA;
      },

      /**
       * Check whether format properties identify data.
       * @param {object} props Format properties accepted by
       * {@link ObjectFormats#getFormatType}.
       * @returns {boolean} True when the format type is DATA.
       * @since 0.0.0
       */
      isData(props) {
        return this.getFormatType(props) === FORMAT_TYPES.DATA;
      },

      /**
       * Check whether format properties identify a resource object.
       * @param {object} props Format properties accepted by
       * {@link ObjectFormats#getFormatType}.
       * @returns {boolean} True when the format type is RESOURCE.
       * @since 0.0.0
       */
      isResource(props) {
        return this.getFormatType(props) === FORMAT_TYPES.RESOURCE;
      },

      /**
       * Check whether format properties identify an EML document.
       * @param {object} props Format properties.
       * @param {string} [props.formatId] DataONE format ID.
       * @param {string} [props.filename] File name used for extension matching.
       * @param {string} [props.mediaType] Media type used for format matching.
       * @returns {boolean} True when the resolved format ID is an EML format.
       * @since 0.0.0
       */
      isEML(props) {
        const formatIdToUse = this.getFormatId(props);
        return EML_FORMATS.some((emlFormat) =>
          ValueUtilities.matchWildcard(formatIdToUse, emlFormat),
        );
      },

      /**
       * Check whether format properties identify an ORE resource map.
       * @param {object} props Format properties.
       * @param {string} [props.formatId] DataONE format ID.
       * @param {string} [props.filename] File name used for extension matching.
       * @param {string} [props.mediaType] Media type used for format matching.
       * @returns {boolean} True when the resolved format ID is the ORE format.
       * @since 0.0.0
       */
      isResourceMap(props) {
        return this.getFormatId(props) === FORMAT_IDS.RESOURCE_MAP;
      },
    },
  );

  /**
   * Convert a DataONE format ID into a human-readable name using built-in
   * fallback knowledge.
   * @param {string} formatId Format ID to convert.
   * @returns {string} Friendly format name, or the original value when no match
   * is available.
   * @since 0.0.0
   */
  ObjectFormats.getFriendlyFormat = (formatId) =>
    FRIENDLY_FORMAT_NAMES[formatId] ||
    FALLBACK_FORMAT_NAMES[formatId] ||
    formatId;

  ObjectFormats.FALLBACK_FORMATS = FALLBACK_FORMATS;

  return ObjectFormats;
});
