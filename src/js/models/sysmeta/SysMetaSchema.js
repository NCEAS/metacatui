define(["common/ValueUtilities"], (ValueUtilities) => {
  const { normalizeText } = ValueUtilities;

  const XML_NS_V1 = "http://ns.dataone.org/service/types/v1";
  const XML_NS_V2 = "http://ns.dataone.org/service/types/v2.0";
  const SYSMETA_NAMESPACE_BY_VERSION = {
    v1: XML_NS_V1,
    v2: XML_NS_V2,
  };

  const PERMISSIONS = ["read", "write", "changePermission"];
  const REPLICATION_STATUSES = [
    "queued",
    "requested",
    "completed",
    "failed",
    "invalidated",
  ];

  const FIELD_DEFINITIONS = [
    {
      field: "serialVersion",
      kind: "integer",
      scalar: true,
      defaultValue: null,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "identifier",
      kind: "text",
      scalar: true,
      defaultValue: null,
      requiredNonEmpty: true,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "formatId",
      kind: "text",
      scalar: true,
      defaultValue: null,
      requiredNonEmpty: true,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "size",
      kind: "integer",
      scalar: true,
      defaultValue: null,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "checksum",
      kind: "checksum",
      defaultValue: null,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "submitter",
      kind: "text",
      scalar: true,
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "rightsHolder",
      kind: "text",
      scalar: true,
      defaultValue: null,
      requiredNonEmpty: true,
      minOccurs: 1,
      maxOccurs: 1,
    },
    {
      field: "accessPolicy",
      kind: "complex",
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "replicationPolicy",
      kind: "complex",
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "obsoletes",
      kind: "text",
      scalar: true,
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "obsoletedBy",
      kind: "text",
      scalar: true,
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "archived",
      kind: "boolean",
      scalar: true,
      defaultValue: false,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "dateUploaded",
      kind: "date",
      scalar: true,
      defaultValue: null,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "dateSysMetadataModified",
      kind: "date",
      scalar: true,
      defaultValue: null,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "originMemberNode",
      kind: "text",
      scalar: true,
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "authoritativeMemberNode",
      kind: "text",
      scalar: true,
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
    },
    {
      field: "replica",
      kind: "complex",
      minOccurs: 0,
      maxOccurs: Infinity,
    },
    {
      field: "seriesId",
      kind: "text",
      scalar: true,
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
      versions: ["v2"],
    },
    {
      field: "mediaType",
      kind: "complex",
      minOccurs: 0,
      maxOccurs: 1,
      versions: ["v2"],
    },
    {
      field: "fileName",
      kind: "text",
      scalar: true,
      defaultValue: null,
      optionalNonEmpty: true,
      minOccurs: 0,
      maxOccurs: 1,
      versions: ["v2"],
    },
  ];

  const ROOT_NODE_ORDER = FIELD_DEFINITIONS.map(({ field }) => field);

  const SCALAR_FIELD_DEFINITIONS = FIELD_DEFINITIONS.filter(
    ({ scalar }) => scalar,
  ).map(({ scalar, ...definition }) => definition);

  const DATE_FIELDS = SCALAR_FIELD_DEFINITIONS.filter(
    ({ kind }) => kind === "date",
  ).map(({ field }) => field);

  const OPTIONAL_NON_EMPTY_TEXT_FIELDS = SCALAR_FIELD_DEFINITIONS.filter(
    ({ kind, optionalNonEmpty }) => kind === "text" && optionalNonEmpty,
  ).map(({ field }) => field);

  const REQUIRED_NON_EMPTY_FIELDS = [
    ...SCALAR_FIELD_DEFINITIONS.filter(
      ({ requiredNonEmpty }) => requiredNonEmpty,
    ).map(({ field }) => field),
    "checksum",
    "checksumAlgorithm",
  ];

  const DEFAULT_SCALAR_FIELD_VALUES = FIELD_DEFINITIONS.reduce(
    (defaults, { field, defaultValue }) => {
      if (defaultValue !== undefined) {
        defaults[field] = defaultValue;
      }
      return defaults;
    },
    { checksumAlgorithm: null },
  );

  const V2_ONLY_FIELDS = FIELD_DEFINITIONS.filter(
    ({ versions }) => Array.isArray(versions) && versions.length === 1 && versions[0] === "v2",
  ).map(({ field }) => field);

  /**
   * Get the SysMeta schema version associated with a namespace URI.
   * @param {string|null|undefined} namespaceUri XML namespace URI.
   * @returns {"v1"|"v2"|null} Schema version or null when unsupported.
   */
  function getSysMetaVersion(namespaceUri) {
    if (namespaceUri === XML_NS_V1) return "v1";
    if (namespaceUri === XML_NS_V2) return "v2";
    return null;
  }

  /**
   * Return ordered field definitions for the requested SysMeta version.
   * @param {"v1"|"v2"} version SysMeta schema version.
   * @returns {Array<object>} Ordered field definitions for that version.
   */
  function getFieldDefinitionsForVersion(version) {
    return FIELD_DEFINITIONS.filter(({ versions }) => {
      if (!Array.isArray(versions) || !versions.length) return true;
      return versions.includes(version);
    });
  }

  /**
   * Normalize a permission string to the canonical DataONE value.
   * @param {string|null|undefined} value Permission value to normalize.
   * @returns {string|null} Normalized permission value.
   */
  function normalizePermission(value) {
    const normalized = normalizeText(value);
    if (normalized === null) return null;

    const lower = normalized.toLowerCase();
    if (lower === "read" || lower === "write") return lower;
    if (lower === "changepermission") return "changePermission";

    return normalized;
  }

  /**
   * Normalize a replication status string to the canonical DataONE value.
   * @param {string|null|undefined} value Replication status value to
   * normalize.
   * @returns {string|null} Normalized replication status value.
   */
  function normalizeReplicationStatus(value) {
    const normalized = normalizeText(value);
    if (normalized === null) return null;

    const lower = normalized.toLowerCase();
    if (REPLICATION_STATUSES.includes(lower)) return lower;

    return normalized;
  }

  return {
    XML_NS_V1,
    XML_NS_V2,
    SYSMETA_NAMESPACE_BY_VERSION,
    PERMISSIONS,
    REPLICATION_STATUSES,
    FIELD_DEFINITIONS,
    ROOT_NODE_ORDER,
    SCALAR_FIELD_DEFINITIONS,
    DATE_FIELDS,
    OPTIONAL_NON_EMPTY_TEXT_FIELDS,
    REQUIRED_NON_EMPTY_FIELDS,
    DEFAULT_SCALAR_FIELD_VALUES,
    V2_ONLY_FIELDS,
    getSysMetaVersion,
    getFieldDefinitionsForVersion,
    normalizePermission,
    normalizeReplicationStatus,
  };
});
