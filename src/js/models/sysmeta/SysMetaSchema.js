define(["common/ValueUtilities"], (ValueUtilities) => {
  // Shared text normalizer used by schema value helpers.
  const { normalizeStringChoice } = ValueUtilities;

  // XML namespace URI for the DataONE v1 system metadata schema.
  const XML_NS_V1 = "http://ns.dataone.org/service/types/v1";

  // XML namespace URI for the DataONE v2 system metadata schema.
  const XML_NS_V2 = "http://ns.dataone.org/service/types/v2.0";

  // Canonical namespace URI lookup keyed by schema version.
  const NAMESPACE_BY_VERSION = {
    v1: XML_NS_V1,
    v2: XML_NS_V2,
  };

  // Canonical XML output settings for serialized System Metadata.
  const CANONICAL_XML = {
    version: "v2",
    rootNamespaceUri: XML_NS_V2,
    rootQualifiedName: "d1_v2.0:systemMetadata",
    namespaceAttributes: [
      { name: "xmlns:d1_v2.0", value: XML_NS_V2 },
      { name: "xmlns:d1", value: XML_NS_V1 },
    ],
  };

  // Supported canonical permission values.
  const PERMISSIONS = ["read", "write", "changePermission"];

  // Supported canonical replication-status values.
  const REPLICATION_STATUSES = [
    "queued",
    "requested",
    "completed",
    "failed",
    "invalidated",
  ];

  // Reverse lookup from namespace URI to schema version.
  const VERSION_BY_NAMESPACE = Object.fromEntries(
    Object.entries(NAMESPACE_BY_VERSION).map(([version, namespace]) => [
      namespace,
      version,
    ]),
  );

  // Canonical permission lookup keyed by lowercase text.
  const PERMISSION_BY_LOWERCASE = {
    read: "read",
    write: "write",
    changepermission: "changePermission",
  };

  // Canonical replication-status lookup keyed by lowercase text.
  const REPLICATION_STATUS_BY_LOWERCASE = Object.fromEntries(
    REPLICATION_STATUSES.map((status) => [status, status]),
  );

  // Ordered schema field definitions used for parsing, validation, and output.
  const FIELD_DEFINITIONS = [
    // serialVersion is server-managed, optional in submitted sysmeta, and
    // assigned by the server after write.
    {
      field: "serialVersion",
      type: "integer",
      defaultValue: null,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "identifier",
      type: "text",
      defaultValue: null,
      requiredNonEmpty: true,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "formatId",
      type: "text",
      defaultValue: null,
      requiredNonEmpty: true,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "size",
      type: "integer",
      defaultValue: null,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "checksum",
      type: "checksum",
      defaultValue: null,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "submitter",
      type: "text",
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "rightsHolder",
      type: "text",
      defaultValue: null,
      requiredNonEmpty: true,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "accessPolicy",
      type: "complex",
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "replicationPolicy",
      type: "complex",
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "obsoletes",
      type: "text",
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "obsoletedBy",
      type: "text",
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "archived",
      type: "boolean",
      defaultValue: null,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "dateUploaded",
      type: "date",
      defaultValue: null,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "dateSysMetadataModified",
      type: "date",
      defaultValue: null,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "originMemberNode",
      type: "text",
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "authoritativeMemberNode",
      type: "text",
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "replica",
      type: "complex",
      minOccurs: 0,
      maxOccurs: Infinity,
    },
    {
      field: "seriesId",
      type: "text",
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
      versions: ["v2"],
    },
    {
      field: "mediaType",
      type: "complex",
      minOccurs: 0,
      maxOccurs: 1,
      versions: ["v2"],
    },
    {
      field: "fileName",
      type: "text",
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
      versions: ["v2"],
    },
  ];

  // Basic field types that share simple normalization/validation rules.
  const SIMPLE_TYPES = ["integer", "text", "date", "boolean"];

  // Ordered node field names derived from the schema definitions.
  const NODE_ORDER = FIELD_DEFINITIONS.map(({ field }) => field);

  // Mapping from XML/root field names to owned property names on SystemMetadata.
  const FIELD_TO_PROPERTY_NAME = {
    replica: "replicas",
  };

  /**
   * Convert an XML field name to the owned SystemMetadata property name.
   * @param {string|null|undefined} field XML field name.
   * @returns {string|null|undefined} Owned property name.
   */
  function getPropertyName(field) {
    return FIELD_TO_PROPERTY_NAME[field] || field;
  }

  // Ordered owned-property names derived from the schema definitions.
  const PROPERTY_ORDER = NODE_ORDER.map((field) => getPropertyName(field));

  // Field definitions limited to simple types.
  const SIMPLE_FIELD_DEFINITIONS = FIELD_DEFINITIONS.filter(({ type }) =>
    SIMPLE_TYPES.includes(type),
  );

  // Scalar date-field names.
  const DATE_FIELDS = SIMPLE_FIELD_DEFINITIONS.filter(
    ({ type }) => type === "date",
  ).map(({ field }) => field);

  // Optional text fields that must be non-empty when present.
  const OPTIONAL_NON_EMPTY_TEXT_FIELDS = SIMPLE_FIELD_DEFINITIONS.filter(
    ({ type, optionalNonEmpty }) => type === "text" && optionalNonEmpty,
  ).map(({ field }) => field);

  // Required non-empty fields, including checksum metadata.
  const REQUIRED_NON_EMPTY_FIELDS = [
    ...SIMPLE_FIELD_DEFINITIONS.filter(
      ({ requiredNonEmpty }) => requiredNonEmpty,
    ).map(({ field }) => field),
    "checksum",
    "checksumAlgorithm",
  ];

  // Default values for simple fields in normalized data objects.
  const DEFAULT_SIMPLE_FIELD_VALUES = FIELD_DEFINITIONS.reduce(
    (defaults, { field, defaultValue }) => {
      const newDefaults = { ...defaults };
      if (defaultValue !== undefined) {
        newDefaults[field] = defaultValue;
      }
      return newDefaults;
    },
    { checksumAlgorithm: null },
  );

  // Required owned-property names derived from schema cardinality.
  const REQUIRED_PROPERTIES = [
    ...new Set(
      FIELD_DEFINITIONS.filter(({ minOccurs }) => minOccurs > 0).map(
        ({ field }) => getPropertyName(field),
      ),
    ),
  ];

  // Optional owned-property names derived from schema cardinality.
  const OPTIONAL_PROPERTIES = [
    ...new Set(
      FIELD_DEFINITIONS.filter(({ minOccurs }) => !minOccurs).map(({ field }) =>
        getPropertyName(field),
      ),
    ),
  ];

  // Fields only available in the v2 schema.
  const V2_ONLY_FIELDS = FIELD_DEFINITIONS.filter(
    ({ versions }) =>
      Array.isArray(versions) && versions.length === 1 && versions[0] === "v2",
  ).map(({ field }) => field);

  /**
   * Shared schema constants and helpers for DataONE System Metadata.
   * @namespace SysMetaSchema
   * @since 0.0.0
   */
  const SysMetaSchema = {
    XML_NS_V1,
    XML_NS_V2,
    NAMESPACE_BY_VERSION,
    CANONICAL_XML,
    PERMISSIONS,
    REPLICATION_STATUSES,
    FIELD_DEFINITIONS,
    NODE_ORDER,
    FIELD_TO_PROPERTY_NAME,
    PROPERTY_ORDER,
    SIMPLE_TYPES,
    SIMPLE_FIELD_DEFINITIONS,
    DATE_FIELDS,
    OPTIONAL_NON_EMPTY_TEXT_FIELDS,
    REQUIRED_NON_EMPTY_FIELDS,
    DEFAULT_SIMPLE_FIELD_VALUES,
    REQUIRED_PROPERTIES,
    OPTIONAL_PROPERTIES,
    V2_ONLY_FIELDS,
    getPropertyName,

    /**
     * Get the SysMeta schema version associated with a namespace URI.
     * @param {string|null|undefined} namespaceUri XML namespace URI.
     * @returns {"v1"|"v2"|null} Schema version or null when unsupported.
     */
    getSysMetaVersion(namespaceUri) {
      return VERSION_BY_NAMESPACE[namespaceUri] || null;
    },

    /**
     * Return ordered field definitions for the requested SysMeta version.
     * @param {"v1"|"v2"} version SysMeta schema version.
     * @returns {Array<object>} Ordered field definitions for that version.
     */
    getFieldDefinitionsForVersion(version) {
      return FIELD_DEFINITIONS.filter(({ versions }) => {
        if (!Array.isArray(versions) || !versions.length) return true;
        return versions.includes(version);
      });
    },

    /**
     * Normalize a permission string to the canonical DataONE value.
     * @param {string|null|undefined} value Permission value to normalize.
     * @returns {string|null} Normalized permission value.
     */
    normalizePermission(value) {
      return normalizeStringChoice(value, PERMISSION_BY_LOWERCASE);
    },

    /**
     * Normalize a replication status string to the canonical DataONE value.
     * @param {string|null|undefined} value Replication status value to
     * normalize.
     * @returns {string|null} Normalized replication status value.
     */
    normalizeReplicationStatus(value) {
      return normalizeStringChoice(value, REPLICATION_STATUS_BY_LOWERCASE);
    },
  };

  return SysMetaSchema;
});
