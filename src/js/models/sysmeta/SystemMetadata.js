define([
  "common/DataONEXmlUtilities",
  "common/XMLUtilities",
  "common/XMLTypes",
  "common/DateUtilities",
  "common/ValueUtilities",
  "common/ValidationUtilities",
  "models/sysmeta/Checksum",
  "models/sysmeta/AccessPolicy",
  "models/sysmeta/ReplicationPolicy",
  "models/sysmeta/ReplicaList",
  "models/sysmeta/MediaType",
  "models/sysmeta/SysMetaSchema",
], (
  DataONEXmlUtilities,
  XMLUtilities,
  XMLTypes,
  DateUtilities,
  ValueUtilities,
  ValidationUtilities,
  Checksum,
  AccessPolicy,
  ReplicationPolicy,
  ReplicaList,
  MediaType,
  SysMetaSchema,
) => {
  const XMLNS_NAMESPACE_URI = "http://www.w3.org/2000/xmlns/";
  const CANONICAL_XML_DECLARATION =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const {
    CANONICAL_XML,
    NODE_ORDER,
    PROPERTY_ORDER,
    SIMPLE_FIELD_DEFINITIONS,
    DEFAULT_SIMPLE_FIELD_VALUES,
    OPTIONAL_PROPERTIES,
    getPropertyName,
  } = SysMetaSchema;
  const { normalizeText, isPlainObject } = ValueUtilities;
  const {
    createValidationError,
    createValidationIssue,
    createValidationException,
  } = ValidationUtilities;

  const SIMPLE_TYPE_BY_FIELD = Object.fromEntries(
    SIMPLE_FIELD_DEFINITIONS.map(({ field, type }) => [field, type]),
  );
  const OPTIONAL_PROPERTY_SET = new Set(OPTIONAL_PROPERTIES);

  /**
   * Typed DataONE System Metadata domain model with direct root properties,
   * owned child domains, tolerant XML parsing, and canonical v2 XML
   * serialization.
   *
   * Parsing silently repairs harmless XML shape issues such as missing
   * namespaces, unknown child elements, out-of-order known children, and
   * duplicate singleton elements where the last value wins. `parseWarnings`
   * is only populated when parsing had to drop invalid optional content.
   * @property {number|null} serialVersion Optional sysmeta serial version.
   * @property {string|null} identifier DataONE identifier.
   * @property {string|null} formatId DataONE format identifier.
   * @property {number|null} size Object size in bytes.
   * @property {string|null} submitter Optional submitter subject.
   * @property {string|null} rightsHolder Rights holder subject.
   * @property {string|null} obsoletes PID obsoleted by this object.
   * @property {string|null} obsoletedBy PID that obsoletes this object.
   * @property {boolean|null} archived Archived flag.
   * @property {Date|null} dateUploaded Upload timestamp.
   * @property {Date|null} dateSysMetadataModified Sysmeta-modified timestamp.
   * @property {string|null} originMemberNode Origin member node.
   * @property {string|null} authoritativeMemberNode Authoritative member node.
   * @property {string|null} seriesId Optional series identifier.
   * @property {string|null} fileName Optional file name.
   * @property {Checksum} checksum Owned checksum value object.
   * @property {AccessPolicy} accessPolicy Owned access-policy collection.
   * @property {ReplicationPolicy} replicationPolicy Owned replication policy.
   * @property {ReplicaList} replicas Owned replica collection.
   * @property {MediaType} mediaType Owned media-type value object.
   * @property {Array<object>} parseWarnings Lossy parse warnings from the most
   * recent successful XML parse.
   * @class SystemMetadata
   * @since 2.34.0
   */
  class SystemMetadata {
    /**
     * Create a SystemMetadata instance.
     * @param {object} [data] Initial system metadata values.
     */
    constructor(data = {}) {
      this.reset();
      const values = data instanceof SystemMetadata ? data.toJSON() : data;
      const normalizedValues = SystemMetadata.normalizeValues(values);
      Object.assign(this, normalizedValues);
    }

    /**
     * Parse and normalize a System Metadata XML document onto this instance.
     * Harmless XML cleanup such as missing namespaces, unknown child elements,
     * out-of-order known children, and duplicate singleton elements is
     * repaired silently. `parseWarnings` is only populated when parsing had to
     * drop invalid optional content.
     * @param {string} xmlString System Metadata XML string to parse.
     * @returns {SystemMetadata} The same instance with parsed values.
     * @throws {Error} Throws when the XML is malformed, is a DataONE error
     * document, has the wrong root element, or is missing required core data
     * after recovery.
     */
    parse(xmlString) {
      try {
        const context = "SystemMetadata XML";
        const xmlDoc = DataONEXmlUtilities.parseRequiredDocument(
          xmlString,
          context,
        );
        const root = XMLUtilities.requireDocumentElement(
          xmlDoc,
          "systemMetadata",
          context,
        );

        const parseWarnings = [];
        const parsedValues = {};

        // Parse simple text, integer, boolean, and date fields with simple parsers.
        SIMPLE_FIELD_DEFINITIONS.forEach(({ field }) => {
          const el = XMLUtilities.findLastDirectChildElement(root, field);
          parsedValues[field] = el?.textContent?.trim() || null;
        });

        // Parse complex fields
        const COMPLEX_MAP = {
          checksum: Checksum,
          accessPolicy: AccessPolicy,
          replicationPolicy: ReplicationPolicy,
          mediaType: MediaType,
        };
        Object.entries(COMPLEX_MAP).forEach(([field, Type]) => {
          parsedValues[field] = Type.parse(
            XMLUtilities.findLastDirectChildElement(root, field),
            parseWarnings,
            field,
          );
        });

        // Replicas are a special case since they can be multiple but still have
        // a singleton field name
        parsedValues.replicas = ReplicaList.parse(
          XMLUtilities.findDirectChildElements(root, "replica"),
          parseWarnings,
          "replicas",
        );

        // To avoid failures in reading and editing irregular XML, attempt to
        // recover from any parse issues
        const { normalizedValues, fatalIssues } =
          SystemMetadata.repairParsedValues(parsedValues, parseWarnings);

        if (fatalIssues.length) {
          throw createValidationException(
            "SystemMetadata XML failed validation",
            fatalIssues,
          );
        }

        Object.assign(this, normalizedValues);
        this.parseWarnings = parseWarnings;
        return this;
      } catch (error) {
        this.reset();
        this.parseWarnings = [];
        throw error;
      }
    }

    /**
     * Reset all fields to default values.
     */
    reset() {
      Object.assign(this, SystemMetadata.getDefaults());
      this.parseWarnings = [];
    }

    /**
     * Reset a single field to its default in-place.
     * @param {object} values Values object to reset a field on.
     * @param {string} field Field name to reset to default.
     */
    static resetFieldToDefault(values, field) {
      const defaults = SystemMetadata.getDefaults();
      /* eslint-disable-next-line no-param-reassign */
      values[field] = defaults[field] ?? null;
    }

    /**
     * Get default values for all sysMeta fields.
     * @returns {object} Default values object.
     */
    static getDefaults() {
      return {
        ...DEFAULT_SIMPLE_FIELD_VALUES,
        checksum: new Checksum(),
        accessPolicy: new AccessPolicy(),
        replicationPolicy: new ReplicationPolicy(),
        replicas: new ReplicaList(),
        mediaType: new MediaType(),
      };
    }

    /**
     * Validate the current System Metadata state.
     * @returns {Array<object>} Validation issues for invalid fields.
     */
    validate() {
      return SystemMetadata.validateValues(this);
    }

    /**
     * Validate values without requiring mutation of a caller-owned object.
     * @param {object} values Candidate System Metadata values.
     * @returns {Array<object>} Validation issues.
     */
    static validateValues(values) {
      const normalized = SystemMetadata.normalizeValues(values);
      const issues = SystemMetadata.validateSimpleFields(normalized);

      issues.push(...normalized.checksum.validate("checksum"));
      issues.push(...normalized.accessPolicy.validate("accessPolicy"));

      if (normalized.replicationPolicy.hasValues()) {
        issues.push(
          ...normalized.replicationPolicy.validate("replicationPolicy"),
        );
      }

      if (normalized.replicas.length > 0) {
        issues.push(...normalized.replicas.validate("replicas"));
      }

      if (!normalized.mediaType.isEmpty()) {
        issues.push(...normalized.mediaType.validate("mediaType"));
      }

      if (
        normalized.seriesId &&
        normalized.identifier &&
        normalized.seriesId === normalized.identifier
      ) {
        issues.push(
          createValidationIssue({
            field: "seriesId",
            message: "seriesId must not be identical to identifier.",
          }),
        );
      }

      return issues;
    }

    /**
     * Serialize the current System Metadata state to canonical v2 XML.
     * @param {object} [options] Serialization options.
     * @param {boolean} [options.validate] Whether to validate before
     * serializing.
     * @returns {string} Canonical v2 XML serialization.
     * @throws {Error} Throws when validation is enabled and the model is
     * invalid.
     */
    serialize({ validate = true } = {}) {
      if (validate) {
        const validationIssues = this.validate();
        if (validationIssues.length) {
          throw createValidationException(
            "SystemMetadata validation failed",
            validationIssues,
          );
        }
      }

      this.normalize();

      const doc = document.implementation.createDocument(
        CANONICAL_XML.rootNamespaceUri,
        CANONICAL_XML.rootQualifiedName,
        null,
      );
      const root = doc.documentElement;

      CANONICAL_XML.namespaceAttributes.forEach(({ name, value }) => {
        root.setAttributeNS(XMLNS_NAMESPACE_URI, name, value);
      });

      // Serialize dates as-is. dateUploaded is immutable once set (overwriting
      // it makes Metacat reject updateSystemMetadata with a 400), and the
      // server assigns the authoritative dateUploaded/dateSysMetadataModified on
      // write, so new objects intentionally serialize a null dateUploaded.

      NODE_ORDER.forEach((field) => {
        switch (field) {
          case "checksum":
          case "mediaType":
          case "replicationPolicy":
          case "accessPolicy": {
            const el = this[field]?.toElement?.(doc);
            if (el) root.appendChild(el);
            return;
          }
          case "replica":
            this.replicas.forEach((replica) => {
              const el = replica.toElement(doc);
              if (el) root.appendChild(el);
            });
            return;
          case "dateUploaded":
          case "dateSysMetadataModified":
          case "archived": {
            const serializedValue =
              XMLTypes[SIMPLE_TYPE_BY_FIELD[field]]?.serialize?.(this[field]) ??
              null;
            XMLUtilities.appendTextElement(doc, root, field, serializedValue);
            return;
          }
          default:
            if (SIMPLE_TYPE_BY_FIELD[field]) {
              XMLUtilities.appendTextElement(
                doc,
                root,
                field,
                XMLTypes[SIMPLE_TYPE_BY_FIELD[field]]?.serialize?.(
                  this[field],
                ) ?? null,
              );
              return;
            }

            XMLUtilities.appendTextElement(doc, root, field, this[field]);
        }
      });

      return `${CANONICAL_XML_DECLARATION}\n${new XMLSerializer().serializeToString(doc)}`;
    }

    /**
     * Return values for all sysMeta fields in a plain object.
     * @returns {object} Plain snapshot of the current state.
     */
    toObject() {
      return Object.fromEntries(
        PROPERTY_ORDER.map((field) => [field, this[field]]),
      );
    }

    /**
     * Return a JSON-safe snapshot of the current normalized state.
     * @returns {object} Plain system metadata JSON.
     */
    toJSON() {
      const values = SystemMetadata.normalizeValues(this.toObject());
      const checksum = values.checksum.toJSON() || {};

      return {
        ...values,
        checksum: checksum.value || null,
        checksumAlgorithm: checksum.algorithm || null,
        accessPolicy: values.accessPolicy.toJSON(),
        replicationPolicy: values.replicationPolicy.hasValues()
          ? values.replicationPolicy.toJSON()
          : null,
        dateUploaded: DateUtilities.toISOString(values.dateUploaded) || null,
        dateSysMetadataModified:
          DateUtilities.toISOString(values.dateSysMetadataModified) || null,
        replicas: values.replicas.toJSON(),
        mediaType: values.mediaType.isEmpty()
          ? null
          : values.mediaType.toJSON(),
      };
    }

    /**
     * Create an independent copy of this System Metadata.
     * @returns {SystemMetadata} Cloned System Metadata
     * @since 0.0.0
     */
    clone() {
      return new SystemMetadata(this.toJSON());
    }

    /**
     * Create a new SystemMetadata instance from XML.
     * @param {string} xmlString System Metadata XML string.
     * @returns {SystemMetadata} Parsed System Metadata instance.
     */
    static fromXml(xmlString) {
      return new SystemMetadata().parse(xmlString);
    }

    /**
     * Normalize this instance's values in-place
     * @returns {SystemMetadata} This instance with normalized values.
     */
    normalize() {
      const normalizedValues = SystemMetadata.normalizeValues(this.toObject());
      Object.assign(this, normalizedValues);
      return this;
    }

    /**
     * Normalize sysMeta values, applying defaults and type conversions when
     * necessary.
     * @param {object} values An object with sysMeta fields to normalize.
     * @returns {object} Normalized values object.
     */
    static normalizeValues(values) {
      const source = isPlainObject(values) ? values : {};

      // Start with defaults
      const normalized = this.getDefaults();

      // Normalize simple text, integer, boolean, and date fields with simple
      // normalizers.
      SIMPLE_FIELD_DEFINITIONS.forEach(({ field, type }) => {
        const rawValue =
          source[field] !== undefined
            ? source[field]
            : DEFAULT_SIMPLE_FIELD_VALUES[field];

        const normalizer = XMLTypes[type]?.normalize;
        normalized[field] =
          typeof normalizer === "function" ? normalizer(rawValue) : rawValue;
      });

      Object.entries({
        checksum: Checksum,
        accessPolicy: AccessPolicy,
        replicationPolicy: ReplicationPolicy,
        replicas: ReplicaList,
        mediaType: MediaType,
      }).forEach(([field, Type]) => {
        const val =
          field === "checksum" &&
          !(source.checksum instanceof Checksum) &&
          !isPlainObject(source.checksum)
            ? {
                value: source.checksum,
                algorithm: source.checksumAlgorithm,
              }
            : source[field];
        normalized[field] =
          val instanceof Type ? val.normalize() : Type.fromValue(val);
      });

      return normalized;
    }

    /**
     * Validate simple text, integer, boolean, and date fields.
     * @param {object} values Normalized values object.
     * @returns {Array<object>} Validation issues for simple fields.
     * @private
     */
    static validateSimpleFields(values) {
      const issues = [];

      SIMPLE_FIELD_DEFINITIONS.forEach((definition) => {
        const { field, type, requiredNonEmpty, optionalNonEmpty } = definition;
        const value = values[field];
        const validate = XMLTypes[type]?.validate;
        if (typeof validate !== "function") return;

        issues.push(
          ...validate(value, {
            field,
            required: requiredNonEmpty || field === "size",
            nonEmptyWhenPresent: optionalNonEmpty,
          }),
        );
      });

      return issues;
    }

    /**
     * Attempt to repair parsed values by resetting recoverable fields to
     * defaults and collecting fatal issues for non-recoverable fields. Invalid
     * content in optional fields is recoverable, but missing or invalid
     * required fields are fatal. Repaired fields are tracked to avoid duplicate
     * repairs and warnings when multiple issues affect the same
     * property.
     * @param {object} parsedValues Parsed candidate values.
     * @param {Array<object>} parseWarnings Parse warnings collected so far.
     * @returns {{normalizedValues: object, fatalIssues: Array<object>}}
     * Normalized values plus any fatal issues.
     * @private
     */
    static repairParsedValues(parsedValues, parseWarnings) {
      const normalizedValues = SystemMetadata.normalizeValues(parsedValues);
      const fatalIssues = [];
      const repairedFields = new Set();

      SystemMetadata.validateValues(normalizedValues).forEach((issue) => {
        const fieldName =
          normalizeText(issue.field)?.split(/[.[]/, 1)[0] || null;
        const property = getPropertyName(fieldName);

        if (!property || !OPTIONAL_PROPERTY_SET.has(property)) {
          fatalIssues.push(issue);
          return;
        }

        if (repairedFields.has(property)) {
          return;
        }

        repairedFields.add(property);
        SystemMetadata.resetFieldToDefault(normalizedValues, property);
        parseWarnings.push(
          createValidationError(
            property,
            `Ignored invalid ${property} content while parsing system metadata.`,
          ),
        );
      });

      return { normalizedValues, fatalIssues };
    }
  }

  return SystemMetadata;
});
