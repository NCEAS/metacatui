define([
  "common/DataONEXmlUtilities",
  "common/XMLUtilities",
  "common/DateUtility",
  "common/ValueUtilities",
  "common/ValidationUtilities",
  "models/sysmeta/AccessRule",
  "models/sysmeta/AccessPolicy",
  "models/sysmeta/ReplicationPolicy",
  "models/sysmeta/Replica",
  "models/sysmeta/ReplicaList",
  "models/sysmeta/MediaType",
  "models/sysmeta/MediaTypeProperty",
  "models/sysmeta/SysMetaSchema",
], (
  DataONEXmlUtilities,
  XMLUtilities,
  DateUtility,
  ValueUtilities,
  ValidationUtilities,
  AccessRule,
  AccessPolicy,
  ReplicationPolicy,
  Replica,
  ReplicaList,
  MediaType,
  MediaTypeProperty,
  SysMetaSchema,
) => {
  const XMLNS_NAMESPACE_URI = "http://www.w3.org/2000/xmlns/";
  const {
    XML_NS_V1,
    XML_NS_V2,
    SYSMETA_NAMESPACE_BY_VERSION,
    PERMISSIONS,
    REPLICATION_STATUSES,
    SCALAR_FIELD_DEFINITIONS,
    DEFAULT_SCALAR_FIELD_VALUES,
    V2_ONLY_FIELDS,
    getSysMetaVersion,
    getFieldDefinitionsForVersion,
  } = SysMetaSchema;
  const {
    firstDefined,
    nullIfEmpty,
    normalizeText,
    normalizeBoolean,
    normalizeInteger,
    isNonEmptyString,
    isUnsignedInteger,
  } = ValueUtilities;
  const { createValidationError, cloneValidationErrors } = ValidationUtilities;
  const SCALAR_NORMALIZERS = {
    integer: normalizeInteger,
    text: normalizeText,
    boolean: normalizeBoolean,
    date: normalizeDateValue,
  };
  const SUPPORTED_ROOT_NAMESPACES = Object.values(SYSMETA_NAMESPACE_BY_VERSION);

  /**
   * Normalize a date-like input to a Date when possible.
   * @param {string|Date|null|undefined} value Date value to normalize.
   * @returns {Date|string|null} Normalized date value.
   */
  function normalizeDateValue(value) {
    if (nullIfEmpty(value) === null) return null;
    return DateUtility.toDate(value) || value;
  }

  /**
   * Determine whether a value should count as present for serialization.
   * @param {*} value Candidate value.
   * @returns {boolean} True when the value is meaningfully populated.
   */
  function hasSerializableValue(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value !== "";
    if (value instanceof Date) return DateUtility.isValidDate(value);
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value?.isEmpty === "function") return !value.isEmpty();
    if (typeof value?.hasValues === "function") return value.hasValues();
    if (typeof value?.length === "number") return value.length > 0;
    return true;
  }

  /**
   * Return the SysMeta field definitions for a schema version.
   * @param {"v1"|"v2"} version SysMeta schema version.
   * @returns {Array<object>} Ordered field definitions.
   */
  function getVersionedFieldDefinitions(version) {
    return getFieldDefinitionsForVersion(version);
  }

  /**
   * Return schema sequence definitions for direct-child validation.
   * @param {"v1"|"v2"} version SysMeta schema version.
   * @returns {Array<{name:string,minOccurs:number,maxOccurs:number}>}
   * Direct-child sequence definitions.
   */
  function getSequenceDefinitions(version) {
    return getVersionedFieldDefinitions(version).map(
      ({ field, minOccurs = 0, maxOccurs = 1 }) => ({
        name: field,
        minOccurs,
        maxOccurs,
      }),
    );
  }

  /**
   * Determine the schema version for a parsed sysmeta root element.
   * @param {Element} root Parsed `systemMetadata` root element.
   * @param {string} context Context label for parse errors.
   * @returns {"v1"|"v2"} SysMeta schema version.
   */
  function getParsedSysMetaVersion(root, context) {
    XMLUtilities.requireNamespaceUri(root, SUPPORTED_ROOT_NAMESPACES, context);
    const version = getSysMetaVersion(root?.namespaceURI);
    if (version) return version;

    throw new Error(
      `${context}: unsupported systemMetadata namespace URI "${root?.namespaceURI || ""}"`,
    );
  }

  /**
   * Determine which SysMeta schema version should be used for serialization.
   * @param {object} data Normalized SysMeta data.
   * @param {object} xmlFormatState Current XML format state.
   * @returns {"v1"|"v2"} Serialization version.
   */
  function getSerializationVersion(
    data,
    xmlFormatState = createXmlFormatState(),
  ) {
    const hasV2Values = V2_ONLY_FIELDS.some((field) =>
      hasSerializableValue(data[field]),
    );
    if (hasV2Values) return "v2";

    return getSysMetaVersion(xmlFormatState?.rootNamespaceURI) || "v2";
  }

  /**
   * Create the default namespace declarations used for serialized sysmeta XML.
   * @param {"v1"|"v2"} [version="v2"] SysMeta schema version.
   * @returns {Array<{name: string, value: string}>} Namespace attributes.
   */
  function createDefaultNamespaceAttributes(version = "v2") {
    if (version === "v1") {
      return [{ name: "xmlns:ns2", value: XML_NS_V1 }];
    }

    return [
      { name: "xmlns:ns2", value: XML_NS_V1 },
      { name: "xmlns:ns3", value: XML_NS_V2 },
    ];
  }

  /**
   * Create per-instance XML format state for sysmeta output.
   * @param {object} [options] XML format options.
   * @param {"v1"|"v2"} [options.version="v2"] SysMeta schema version.
   * @returns {object} XML format state.
   */
  function createXmlFormatState({ version = "v2" } = {}) {
    const rootNamespaceURI = SYSMETA_NAMESPACE_BY_VERSION[version] || XML_NS_V2;
    return {
      xmlDeclaration: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      rootNamespaceURI,
      rootQualifiedName:
        version === "v1" ? "ns2:systemMetadata" : "ns3:systemMetadata",
      namespaceAttributes: createDefaultNamespaceAttributes(version),
    };
  }

  /**
   * Apply stored namespace declarations to a sysmeta root element.
   * @param {Element} root Root systemMetadata element.
   * @param {object} xmlFormatState XML format state.
   * @returns {Element} The same root element.
   */
  function applyRootAttributes(root, xmlFormatState = createXmlFormatState()) {
    const namespaceAttributes = xmlFormatState.namespaceAttributes;

    namespaceAttributes.forEach(({ name, value }) => {
      if (name === "xmlns" || name.startsWith("xmlns:")) {
        root.setAttributeNS(XMLNS_NAMESPACE_URI, name, value);
        return;
      }

      root.setAttribute(name, value);
    });

    return root;
  }

  /**
   * Create the default System Metadata field values.
   * @returns {object} Default System Metadata data.
   * @since 0.0.0
   */
  function createDefaults() {
    return {
      ...DEFAULT_SCALAR_FIELD_VALUES,
      accessPolicy: new AccessPolicy(),
      replicationPolicy: null,
      replica: new ReplicaList(),
      mediaType: null,
    };
  }

  /**
   * Normalize configured scalar sysmeta fields in place.
   * @param {object} normalized Normalized sysmeta object.
   * @returns {object} The same normalized object.
   */
  function normalizeScalarFields(normalized) {
    SCALAR_FIELD_DEFINITIONS.forEach(({ field, kind }) => {
      const normalize = SCALAR_NORMALIZERS[kind];
      if (typeof normalize === "function")
        normalized[field] = normalize(normalized[field]);
    });
    normalized.checksum = normalizeText(normalized.checksum);
    normalized.checksumAlgorithm = normalizeText(normalized.checksumAlgorithm);
    return normalized;
  }

  /**
   * Parse top-level scalar sysmeta fields from the root element.
   * @param {Element} root Parsed `systemMetadata` root element.
   * @param {Array<object>} fieldDefinitions Ordered scalar field definitions.
   * @returns {object} Parsed scalar field values.
   */
  function parseScalarFields(
    root,
    fieldDefinitions = SCALAR_FIELD_DEFINITIONS,
  ) {
    const parsed = {};

    fieldDefinitions.forEach(({ field }) => {
      parsed[field] = XMLUtilities.getDirectChildText(root, field);
    });

    return parsed;
  }

  /**
   * Validate normalized scalar sysmeta fields against the schema metadata.
   * @param {object} data Normalized sysmeta data.
   * @returns {Array<object>} Validation errors for invalid scalar fields.
   */
  function validateScalarFields(data) {
    const errors = [];

    SCALAR_FIELD_DEFINITIONS.forEach((definition) => {
      const { field, kind, requiredNonEmpty, optionalNonEmpty } = definition;
      const value = data[field];

      if (kind === "text") {
        if (requiredNonEmpty && !isNonEmptyString(value)) {
          errors.push(
            createValidationError(
              field,
              `${field} is required and must be a non-empty string.`,
            ),
          );
        } else if (
          optionalNonEmpty &&
          value !== null &&
          value !== undefined &&
          !isNonEmptyString(value)
        ) {
          errors.push(
            createValidationError(
              field,
              `${field} must be a non-empty string when present.`,
            ),
          );
        }
        return;
      }

      if (kind === "integer") {
        if (field === "size") {
          if (!isUnsignedInteger(value)) {
            errors.push(
              createValidationError(
                field,
                "size is required and must be an unsigned integer.",
              ),
            );
          }
        } else if (value !== null && !isUnsignedInteger(value)) {
          errors.push(
            createValidationError(
              field,
              `${field} must be an unsigned integer when present.`,
            ),
          );
        }
        return;
      }

      if (kind === "boolean") {
        if (value !== null && typeof value !== "boolean") {
          errors.push(
            createValidationError(
              field,
              `${field} must be a boolean when present.`,
            ),
          );
        }
        return;
      }

      if (kind === "date") {
        if (value !== null && !DateUtility.isValidDate(value)) {
          errors.push(
            createValidationError(field, `${field} must be a valid date.`),
          );
        }
      }
    });

    if (!isNonEmptyString(data.checksum)) {
      errors.push(
        createValidationError(
          "checksum",
          "checksum is required and must be a non-empty string.",
        ),
      );
    }

    if (!isNonEmptyString(data.checksumAlgorithm)) {
      errors.push(
        createValidationError(
          "checksumAlgorithm",
          "checksumAlgorithm is required and must be a non-empty string.",
        ),
      );
    }

    return errors;
  }

  /**
   * Serialize a date-like value for JSON output while preserving invalid
   * non-Date values for inspection.
   * @param {*} value Date-like value.
   * @returns {*|null} ISO string for valid Dates, null for nullish values, or
   * the original non-Date value.
   */
  function serializeJsonDateValue(value) {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return DateUtility.toISOString(value) || null;
    return value;
  }

  /**
   * Convert normalized sysmeta data into an explicit JSON-safe object.
   * @param {object} data Normalized sysmeta data.
   * @returns {object} Plain JSON-safe sysmeta data.
   */
  function serializeDataToJson(data) {
    return {
      serialVersion: data.serialVersion,
      identifier: data.identifier,
      formatId: data.formatId,
      size: data.size,
      checksum: data.checksum,
      checksumAlgorithm: data.checksumAlgorithm,
      submitter: data.submitter,
      rightsHolder: data.rightsHolder,
      accessPolicy: data.accessPolicy.toJSON(),
      replicationPolicy: data.replicationPolicy
        ? data.replicationPolicy.toJSON()
        : null,
      obsoletes: data.obsoletes,
      obsoletedBy: data.obsoletedBy,
      archived: data.archived,
      dateUploaded: serializeJsonDateValue(data.dateUploaded),
      dateSysMetadataModified: serializeJsonDateValue(
        data.dateSysMetadataModified,
      ),
      originMemberNode: data.originMemberNode,
      authoritativeMemberNode: data.authoritativeMemberNode,
      replica: data.replica.toJSON().map((replica) => ({
        ...replica,
        replicaVerified: serializeJsonDateValue(replica.replicaVerified),
      })),
      seriesId: data.seriesId,
      mediaType: data.mediaType ? data.mediaType.toJSON() : null,
      fileName: data.fileName,
    };
  }

  /**
   * Typed DataONE System Metadata domain model with normalization, validation,
   * XML parsing, and XML serialization support. Nested sysmeta structures such
   * as access policy, replication policy, replicas, and media type are
   * represented by dedicated value objects.
   * @property {object} data Normalized System Metadata field values.
   * @property {Array<Error>} errors Parse or fetch-related errors captured on
   * the instance.
   * @property {Array<object>} validationErrors Validation errors produced by
   * {@link SystemMetadata#validate}.
   * @property {boolean} hasParseError Indicates whether the most recent parse
   * attempt failed.
   * @property {boolean} parsed Indicates whether system metadata has been
   * parsed from XML.
   * @class SystemMetadata
   * @since 2.34.0
   */
  class SystemMetadata {
    /**
     * Creates an instance of SystemMetadata.
     * @param {object} data SystemMetadata fields and values, if known.
     */
    constructor(data = {}) {
      this.errors = [];
      this.validationErrors = [];
      this.parsed = false;
      this.hasParseError = false;
      this.fetchedXmlString = null;
      this._xmlFormatState = createXmlFormatState();
      this.data = this.constructor.normalizeData(data);
    }

    /**
     * Normalize raw System Metadata input into the internal data shape.
     * @param {object} [data] Raw System Metadata field values.
     * @returns {object} Normalized System Metadata data.
     * @since 0.0.0
     */
    static normalizeData(data = {}) {
      const defaults = createDefaults();
      const keys = Object.keys(defaults);
      const normalized = {};

      keys.forEach((key) => {
        normalized[key] = firstDefined(data[key], defaults[key]);
      });

      normalizeScalarFields(normalized);
      normalized.accessPolicy = AccessPolicy.fromValue(normalized.accessPolicy);
      normalized.replicationPolicy = ReplicationPolicy.fromValue(
        normalized.replicationPolicy,
      );
      normalized.replica = ReplicaList.fromValue(normalized.replica);
      normalized.mediaType = MediaType.fromValue(normalized.mediaType);

      return normalized;
    }

    /**
     * Reset per-instance parse/validation state.
     * @param {object} [options] Reset options.
     * @param {string|null} [options.xmlString] Last fetched XML string.
     */
    resetState({ xmlString = null } = {}) {
      this.errors = [];
      this.validationErrors = [];
      this.parsed = false;
      this.hasParseError = false;
      this.fetchedXmlString = xmlString;
      this._xmlFormatState = createXmlFormatState();
      this.data = this.constructor.normalizeData();
    }

    /**
     * Record a parse failure on the instance and return the error.
     * @param {Error} error Error encountered while parsing.
     * @returns {Error} The same error.
     */
    recordParseFailure(error) {
      this.parsed = false;
      this.hasParseError = true;
      this.validationErrors = Array.isArray(error?.validationErrors)
        ? cloneValidationErrors(error.validationErrors)
        : [];
      this.data = this.constructor.normalizeData();
      if (error) {
        this.errors.push(error);
      }
      return error;
    }

    /**
     * Re-normalize current data to protect validation/serialization boundaries
     * from direct external mutation.
     * @returns {object} Normalized sysmeta data.
     */
    normalizeCurrentData() {
      this.data = this.constructor.normalizeData(this.data);
      return this.data;
    }

    /**
     * Capture XML format details from parsed sysmeta XML.
     * @param {string} xmlString Original XML string.
     * @param {Element} root Parsed `systemMetadata` root element.
     */
    captureXmlFormatState(xmlString, root) {
      const version = getSysMetaVersion(root?.namespaceURI) || "v2";
      const defaultXmlFormatState = createXmlFormatState({ version });
      const rootNamespaceAttributes = XMLUtilities.getNamespaceAttributes(root);

      this._xmlFormatState = {
        ...defaultXmlFormatState,
        xmlDeclaration:
          XMLUtilities.extractXmlDeclaration(xmlString) ||
          defaultXmlFormatState.xmlDeclaration,
        rootQualifiedName:
          root.tagName ||
          root.nodeName ||
          defaultXmlFormatState.rootQualifiedName,
        rootNamespaceURI:
          root.namespaceURI || defaultXmlFormatState.rootNamespaceURI,
        namespaceAttributes:
          rootNamespaceAttributes.length > 0
            ? rootNamespaceAttributes
            : createDefaultNamespaceAttributes(version),
      };
    }

    /**
     * Parse a System Metadata XML document into normalized field values.
     * @param {string} xmlString System Metadata XML string to parse.
     * @returns {object} Normalized System Metadata data.
     * @throws {Error} Throws when the XML is invalid or does not contain a
     * system metadata root element.
     * @since 0.0.0
     */
    parse(xmlString) {
      const context = "SystemMetadata XML";
      this.resetState({ xmlString });

      let xmlDoc = null;
      try {
        xmlDoc = XMLUtilities.parseRequiredXmlString(xmlString, context);
      } catch (error) {
        throw this.recordParseFailure(error);
      }

      const parsedServiceError = DataONEXmlUtilities.parseErrorXml(
        xmlDoc,
        context,
      );
      if (parsedServiceError) {
        throw this.recordParseFailure(
          DataONEXmlUtilities.toError(parsedServiceError),
        );
      }

      let root = null;
      try {
        root = XMLUtilities.requireDocumentElement(
          xmlDoc,
          "systemMetadata",
          context,
        );
      } catch (error) {
        throw this.recordParseFailure(error);
      }

      let version = null;
      try {
        version = getParsedSysMetaVersion(root, context);
        XMLUtilities.requireAllowedAttributeNames(root, [], context);
        XMLUtilities.requireDirectChildSequence(
          root,
          getSequenceDefinitions(version),
          context,
        );
      } catch (error) {
        throw this.recordParseFailure(error);
      }

      this.captureXmlFormatState(xmlString, root);

      try {
        const scalarFieldDefinitions = getVersionedFieldDefinitions(
          version,
        ).filter(({ scalar }) => scalar);
        const scalarFields = parseScalarFields(root, scalarFieldDefinitions);
        const checksumElement = XMLUtilities.findDirectChildElement(
          root,
          "checksum",
        );
        const accessPolicyElement = XMLUtilities.findDirectChildElement(
          root,
          "accessPolicy",
        );
        const replicationPolicyElement = XMLUtilities.findDirectChildElement(
          root,
          "replicationPolicy",
        );
        const mediaTypeElement = XMLUtilities.findDirectChildElement(
          root,
          "mediaType",
        );

        XMLUtilities.requireAllowedAttributeNames(
          checksumElement,
          ["algorithm"],
          context,
        );

        const parsed = {
          ...scalarFields,
          checksum: XMLUtilities.getElementText(checksumElement),
          checksumAlgorithm: XMLUtilities.getRequiredAttribute(
            checksumElement,
            "algorithm",
            context,
          ),
          accessPolicy: accessPolicyElement
            ? AccessPolicy.fromElement(accessPolicyElement)
            : new AccessPolicy(),
          replicationPolicy: replicationPolicyElement
            ? ReplicationPolicy.fromElement(replicationPolicyElement)
            : null,
          replica: new ReplicaList(
            XMLUtilities.findDirectChildElements(root, "replica").map(
              (replicaElement) => Replica.fromElement(replicaElement),
            ),
          ),
          mediaType: mediaTypeElement
            ? MediaType.fromElement(mediaTypeElement)
            : null,
        };

        this.data = this.constructor.normalizeData(parsed);
        this.parsed = true;

        const validationErrors = this.validate();
        if (validationErrors.length) {
          const error = new Error("SystemMetadata XML failed validation");
          error.validationErrors = cloneValidationErrors(validationErrors);
          throw error;
        }

        return this.data;
      } catch (error) {
        throw this.recordParseFailure(error);
      }
    }

    /**
     * Validate the current System Metadata state.
     * @returns {Array<object>} Validation errors for invalid fields.
     * @since 0.0.0
     */
    validate() {
      const data = this.normalizeCurrentData();
      const errors = validateScalarFields(data);

      if (
        data.seriesId &&
        data.identifier &&
        data.seriesId === data.identifier
      ) {
        errors.push(
          createValidationError(
            "seriesId",
            "seriesId must not be identical to identifier.",
          ),
        );
      }

      if (data.accessPolicy.length > 0) {
        errors.push(...data.accessPolicy.validate("accessPolicy"));
      }

      if (data.replicationPolicy) {
        errors.push(...data.replicationPolicy.validate("replicationPolicy"));
      }

      if (data.replica.length > 0) {
        errors.push(...data.replica.validate("replica"));
      }

      if (data.mediaType) {
        errors.push(...data.mediaType.validate("mediaType"));
      }

      this.validationErrors = errors;
      return errors;
    }

    /**
     * Serialize the current System Metadata state to XML.
     * @param {object} [options] Serialization options.
     * @param {boolean} [options.validate] Whether to validate before
     * serializing.
     * @returns {string} Serialized System Metadata XML string.
     * @throws {Error} Throws when validation is enabled and the model is
     * invalid.
     * @since 0.0.0
     */
    serialize({ validate = true } = {}) {
      const data = this.normalizeCurrentData();
      if (validate) {
        const validationErrors = this.validate();
        if (validationErrors.length) {
          const error = new Error("SystemMetadata validation failed");
          error.validationErrors = cloneValidationErrors(validationErrors);
          throw error;
        }
      }

      const serializationVersion = getSerializationVersion(
        data,
        this._xmlFormatState,
      );
      const baseXmlFormatState =
        getSysMetaVersion(this._xmlFormatState?.rootNamespaceURI) ===
        serializationVersion
          ? this._xmlFormatState
          : createXmlFormatState({ version: serializationVersion });
      const xmlFormatState = {
        ...baseXmlFormatState,
        xmlDeclaration:
          this._xmlFormatState?.xmlDeclaration ||
          baseXmlFormatState.xmlDeclaration,
        rootNamespaceURI:
          SYSMETA_NAMESPACE_BY_VERSION[serializationVersion] ||
          baseXmlFormatState.rootNamespaceURI,
      };

      const doc = XMLUtilities.createXmlDocument(
        xmlFormatState?.rootNamespaceURI || null,
        xmlFormatState?.rootQualifiedName || "systemMetadata",
      );
      const root = doc.documentElement;
      applyRootAttributes(root, xmlFormatState);

      const replicationPolicy = ReplicationPolicy.fromValue(
        data.replicationPolicy,
      );
      const rootOrder = getVersionedFieldDefinitions(serializationVersion).map(
        ({ field }) => field,
      );

      rootOrder.forEach((field) => {
        switch (field) {
          case "checksum": {
            if (data.checksum === null || data.checksum === undefined) {
              break;
            }
            const checksum = XMLUtilities.appendTextElement(
              doc,
              root,
              "checksum",
              data.checksum,
            );
            if (
              checksum &&
              data.checksumAlgorithm !== null &&
              data.checksumAlgorithm !== undefined
            ) {
              checksum.setAttribute(
                "algorithm",
                String(data.checksumAlgorithm),
              );
            }
            break;
          }
          case "accessPolicy": {
            const accessPolicy = data.accessPolicy.toElement(doc);
            if (accessPolicy) root.appendChild(accessPolicy);
            break;
          }
          case "replicationPolicy": {
            const element = replicationPolicy?.toElement(doc);
            if (element) root.appendChild(element);
            break;
          }
          case "replica":
            data.replica.forEach((replica) => {
              const element = replica.toElement(doc);
              if (element) root.appendChild(element);
            });
            break;
          case "mediaType": {
            const mediaType = data.mediaType?.toElement(doc);
            if (mediaType) root.appendChild(mediaType);
            break;
          }
          case "dateUploaded":
          case "dateSysMetadataModified":
            XMLUtilities.appendTextElement(
              doc,
              root,
              field,
              DateUtility.toXmlDateTimeString(data[field]) || null,
            );
            break;
          case "archived":
            XMLUtilities.appendTextElement(
              doc,
              root,
              field,
              data[field] === null ? null : String(data[field]),
            );
            break;
          default:
            XMLUtilities.appendTextElement(doc, root, field, data[field]);
        }
      });

      this._xmlFormatState = xmlFormatState;
      return XMLUtilities.serializeXmlDocument(
        doc,
        xmlFormatState?.xmlDeclaration || null,
      );
    }

    /**
     * Serialize the current System Metadata state to XML.
     * @param {object} [options] Serialization options passed to
     * {@link SystemMetadata#serialize}.
     * @returns {string} Serialized System Metadata XML string.
     * @since 0.0.0
     */
    toXML(options) {
      return this.serialize(options);
    }

    /**
     * Return a JSON-serializable representation of the SystemMetadata.
     * @returns {object} The JSON representation of the SystemMetadata, as a new
     * and unreferenced object.
     * @param {boolean} [includeErrors] Whether to include any parsing errors in
     * the output. If true, the `errors` array will contain plain JSON-safe
     * error objects. If false, no errors will be included.
     * @param {Array} [otherFields] An array of other SystemMetadata fields to
     * include in the output, if they exist on the instance.
     */
    toJSON(includeErrors = true, otherFields = []) {
      const json = serializeDataToJson(this.normalizeCurrentData());
      if (includeErrors) {
        json.errors = Array.isArray(this.errors)
          ? this.errors.map((error) => DataONEXmlUtilities.toPlainError(error))
          : [];
        if (this.hasParseError && !json.errors.length) {
          json.errors.push({
            name: "ParseError",
            message: "Failed to parse SystemMetadata XML",
          });
        }
        if (this.validationErrors.length) {
          json.validationErrors = cloneValidationErrors(this.validationErrors);
        }
      }
      if (Array.isArray(otherFields) && otherFields.length > 0) {
        otherFields.forEach((field) => {
          if (this[field] !== undefined) {
            json[field] = this[field];
          }
        });
      }
      return json;
    }

    /**
     * Create a SystemMetadata instance from an XML string.
     * @param {string} xmlString XML string to parse.
     * @returns {SystemMetadata} Parsed SystemMetadata instance.
     */
    static fromXml(xmlString) {
      const sysMeta = new SystemMetadata();
      sysMeta.parse(xmlString);
      return sysMeta;
    }
  }

  SystemMetadata.AccessRule = AccessRule;
  SystemMetadata.AccessPolicy = AccessPolicy;
  SystemMetadata.ReplicationPolicy = ReplicationPolicy;
  SystemMetadata.Replica = Replica;
  SystemMetadata.ReplicaList = ReplicaList;
  SystemMetadata.MediaType = MediaType;
  SystemMetadata.MediaTypeProperty = MediaTypeProperty;
  SystemMetadata.PERMISSIONS = PERMISSIONS;
  SystemMetadata.REPLICATION_STATUSES = REPLICATION_STATUSES;
  SystemMetadata.XML_NS_V1 = XML_NS_V1;
  SystemMetadata.XML_NS_V2 = XML_NS_V2;

  return SystemMetadata;
});
