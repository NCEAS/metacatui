define([
  "common/UrlUtilities",
  "common/ValueUtilities",
  "common/XMLUtilities",
], (UrlUtilities, ValueUtilities, XMLUtilities) => {
  // Classnames existing in the rertuned HTML that we want to reference in code,
  // plus classes we add to the HTML for styling and selection.
  const CLASS_NAMES = {
    active: "active",
    annotation: "annotation",
    attributeListTable: "attributeListTable",
    btn: "btn",
    citation: "citation",
    collapse: "collapse",
    container: "container",
    controlGroup: "control-group",
    controlLabel: "control-label",
    controls: "controls",
    controlsWell: "controls-well",
    copy: "copy",
    eastBoundingCoordinate: "eastBoundingCoordinate",
    entityDetails: "entitydetails",
    entityName: "entityName",
    formHorizontal: "form-horizontal",
    geographicCoverage: "geographicCoverage",
    geographicDescription: "geographicDescription",
    icon: "icon",
    iconInfoSign: "icon-info-sign",
    iconOk: "icon-ok",
    markdown: "markdown",
    northBoundingCoordinate: "northBoundingCoordinate",
    rowFluid: "row-fluid",
    southBoundingCoordinate: "southBoundingCoordinate",
    span10: "span10",
    span12: "span12",
    taxonomicCoverage: "taxonomicCoverage",
    tooltipThis: "tooltip-this",
    well: "well",
    westBoundingCoordinate: "westBoundingCoordinate",
  };

  const IDS = {
    downloadPackage: "downloadPackage",
    metadata: "Metadata",
    viewMetadataCitationLink: "viewMetadataCitationLink",
  };

  const STATUS = Object.freeze({
    OK: "ok",
    EMPTY: "empty",
    TRANSFORM_ERROR: "transformError",
    UNSTYLED: "unstyled",
  });

  const TRANSFORM_ERROR_TEXT = "Error transforming document";
  const ENTITY_SECTION_SELECTOR = `.${CLASS_NAMES.entityDetails}`;
  const ENTITY_PID_ATTRIBUTE = "data-id";
  const ENTITY_FILENAME_ATTRIBUTE = "data-filename";
  const ENTITY_OBJECT_NAME_ATTRIBUTE = "data-object-name";
  const ENTITY_NAME_ATTRIBUTE = "data-entity-name";

  const ECOGRID_PREFIX = "ecogrid://";

  /**
   * The ViewServiceDoc handles HTML returned from the MetacatUI view service.
   * It handles parsing, normalizing, and annotating the HTML, including
   * rewriting legacy ecogrid links, marking taxonomic coverage sections, and
   * marking the first row of attribute tables as active. It also collects
   * entity summaries from the HTML, including PIDs, file names, and object
   * URLs.
   * @class ViewServiceDoc
   * @since 0.0.0
   */
  class ViewServiceDoc {
    /**
     * @param {object} [options] Constructor options
     * @param {string} [options.pid] PID or SID rendered by the view service
     * @param {string} [options.rawHtml] Raw HTML returned by the service
     * @param {string} [options.url] Final response URL
     * @param {string} [options.contentType] Response content type
     * @param {string} [options.resolveBaseUrl] Resolve URL used for legacy
     * ecogrid link rewrites.
     */
    constructor({
      pid = null,
      rawHtml = "",
      url = null,
      contentType = null,
      resolveBaseUrl = null,
    } = {}) {
      this.pid = ViewServiceDoc.normalizeIdentifier(pid);
      this.rawHtml = ViewServiceDoc.normalizeHtml(rawHtml);
      this.html = this.rawHtml;
      this.template = null;
      this.url = ValueUtilities.normalizeText(url);
      this.contentType = ValueUtilities.normalizeText(contentType);
      this.resolveBaseUrl = UrlUtilities.normalizeUrl(resolveBaseUrl);
      this.status = this.rawHtml.trim() ? STATUS.OK : STATUS.EMPTY;
      this.hasMetadataRoot = false;
      this.entities = [];
      this.entityPids = [];
      this.warnings = [];
      this.mutations = [];
    }

    /**
     * Parse and normalize the rendered HTML.
     * @param {string} [rawHtml] Raw HTML. Defaults to the current `rawHtml`
     * @param {object} [options] Parse options
     * @param {string} [options.resolveBaseUrl] Resolve URL for ecogrid links
     * @returns {ViewServiceDoc} This instance
     */
    parse(rawHtml = this.rawHtml, options = {}) {
      this.rawHtml = ViewServiceDoc.normalizeHtml(rawHtml);
      if (options.resolveBaseUrl) {
        this.resolveBaseUrl = UrlUtilities.normalizeUrl(options.resolveBaseUrl);
      }

      this.html = this.rawHtml;
      this.template = null;
      this.status = STATUS.OK;
      this.hasMetadataRoot = false;
      this.entities = [];
      this.entityPids = [];
      this.warnings = [];
      this.mutations = [];

      const trimmedHtml = this.rawHtml.trim();
      if (!trimmedHtml) {
        this.status = STATUS.EMPTY;
        return this;
      }

      if (ViewServiceDoc.isTransformError(trimmedHtml)) {
        this.status = STATUS.TRANSFORM_ERROR;
        return this;
      }

      const template = this.createTemplate();
      if (!template) return this;

      const root = template.content;
      this.hasMetadataRoot = Boolean(root.querySelector(`#${IDS.metadata}`));
      this.status = this.hasMetadataRoot ? STATUS.OK : STATUS.UNSTYLED;

      this.markLegacyTaxonomicCoverage(root);
      this.rewriteEcoGridLinks(root);
      this.markAttributeTableDefaults(root);
      this.annotateEntitySections(root);

      this.entities = this.collectEntities(root);
      this.entityPids = ValueUtilities.dedupeStrings(
        this.entities.map((entity) => entity.pid).filter(Boolean),
      );
      this.html = template.innerHTML;
      this.template = template;

      return this;
    }

    /**
     * Create a detached template for temporary HTML parsing.
     * @returns {HTMLTemplateElement|null} Parsed template, or null when the
     * current runtime does not provide DOM APIs.
     */
    createTemplate() {
      const template = globalThis.document.createElement("template");
      template.innerHTML = this.rawHtml;
      return template;
    }

    /**
     * Mark legacy taxonomic coverage sections for styling.
     * @param {DocumentFragment} root Detached parse root
     * @returns {number} Number of sections marked
     */
    markLegacyTaxonomicCoverage(root) {
      if (!root || root.querySelector(`.${CLASS_NAMES.taxonomicCoverage}`)) {
        return 0;
      }

      let count = 0;
      root.querySelectorAll("h4").forEach((heading) => {
        if (!ViewServiceDoc.textIncludes(heading, "Taxonomic Range")) return;
        const container = heading.parentElement;
        if (!container) return;
        container.classList.add(CLASS_NAMES.taxonomicCoverage);
        count += 1;
      });

      if (count) this.recordMutation("markLegacyTaxonomicCoverage", { count });
      return count;
    }

    /**
     * Rewrite legacy ecogrid links to resolve service links when configured.
     * @param {DocumentFragment} root Detached parse root
     * @returns {number} Number of links rewritten
     */
    rewriteEcoGridLinks(root) {
      const baseUrl = UrlUtilities.normalizeUrl(this.resolveBaseUrl);
      if (!root || !baseUrl) return 0;

      let count = 0;
      root.querySelectorAll("a").forEach((candidate) => {
        const link = candidate;
        const result = ViewServiceDoc.rewriteEcoGridLink(
          link.textContent,
          baseUrl,
        );
        if (!result) return;

        link.setAttribute("href", result.url);
        link.textContent = result.pid;
        count += 1;
      });

      if (count) this.recordMutation("rewriteEcoGridLinks", { count });
      return count;
    }

    /**
     * Rewrite one legacy ecogrid label to a resolve service URL.
     * @param {string} link Link text that may contain an ecogrid PID
     * @param {string} baseUrl Resolve service base URL
     * @returns {{pid:string,url:string}|false} Rewrite data, or false when the
     * link cannot be rewritten.
     */
    static rewriteEcoGridLink(link, baseUrl) {
      const pid = ViewServiceDoc.extractEcoGridPid(link);
      const normalizedBaseUrl = UrlUtilities.normalizeUrl(baseUrl);
      if (!pid || !normalizedBaseUrl) return false;
      const encodedPid = UrlUtilities.encodeDataONEPidForPath(pid);
      const url = UrlUtilities.buildUrl(normalizedBaseUrl, encodedPid, {
        encodePath: false,
      });
      return { pid, url };
    }

    /**
     * Mark the first row in each attribute list table active.
     * @param {DocumentFragment} root Detached parse root
     * @returns {number} Number of rows marked
     */
    markAttributeTableDefaults(root) {
      if (!root) return 0;

      let count = 0;
      root
        .querySelectorAll(`.${CLASS_NAMES.attributeListTable}`)
        .forEach((table) => {
          const row = table.querySelector("tr");
          if (!row) return;
          row.classList.add(CLASS_NAMES.active);
          count += 1;
        });

      if (count) this.recordMutation("markAttributeTableDefaults", { count });
      return count;
    }

    /**
     * Normalize and annotate entity sections using identifiers already present
     * in the rendered HTML.
     * @param {DocumentFragment} root Detached parse root
     * @returns {number} Number of sections annotated
     */
    annotateEntitySections(root) {
      if (!root) return 0;

      let count = 0;
      this.getCandidateEntitySections(root).forEach((section) => {
        if (this.annotateEntitySection(section)) count += 1;
      });

      if (count) this.recordMutation("annotateEntitySections", { count });
      return count;
    }

    /**
     * Find possible entity sections in rendered metadata
     * @param {DocumentFragment} root Detached parse root
     * @returns {Element[]} Candidate entity section elements
     */
    getCandidateEntitySections(root) {
      if (!root) return [];

      const sections = [];
      const addSection = (section) => {
        if (!section || sections.includes(section)) return;
        sections.push(section);
      };

      root.querySelectorAll(ENTITY_SECTION_SELECTOR).forEach(addSection);

      root.querySelectorAll("a[data-pid]").forEach((link) => {
        addSection(this.constructor.getEntityContainerForLink(link));
      });

      root.querySelectorAll("[data-object-name]").forEach((element) => {
        addSection(element.closest(ENTITY_SECTION_SELECTOR));
      });

      root
        .querySelectorAll(`.${CLASS_NAMES.entityName}[data-entity-name]`)
        .forEach((name) => {
          addSection(name.closest(ENTITY_SECTION_SELECTOR));
        });

      return sections;
    }

    /**
     * Add entity details class and useful data attributes to one section.
     * @param {Element} section Entity section element
     * @param {string} [pid] PID to set. Falls back to identifiers already
     * present in the section.
     * @returns {string|null} A selector for the annotated section
     */
    annotateEntitySection(section, pid = null) {
      if (!section?.classList) return null;
      const normalizedPid =
        ViewServiceDoc.normalizeIdentifier(pid) ||
        this.inferEntityPidFromSection(section);
      const entityName = this.getEntityName(section);
      const objectName = this.getObjectName(section);
      const fileName = objectName;

      section.classList.add(CLASS_NAMES.entityDetails);
      if (normalizedPid) {
        section.setAttribute(ENTITY_PID_ATTRIBUTE, normalizedPid);
      }
      if (fileName) {
        section.setAttribute(ENTITY_FILENAME_ATTRIBUTE, fileName);
        section.setAttribute(ENTITY_OBJECT_NAME_ATTRIBUTE, fileName);
      }
      if (entityName) {
        section.setAttribute(ENTITY_NAME_ATTRIBUTE, entityName);
      }

      return ViewServiceDoc.getSelector({
        pid: normalizedPid,
        fileName,
        entityName,
      });
    }

    /**
     * Infer an entity PID from markup inside an entity section.
     * @param {Element} section Candidate entity section
     * @returns {string|null} Normalized PID, or null when not found
     */
    inferEntityPidFromSection(section) {
      if (!section?.querySelector) return null;

      const dataId = ViewServiceDoc.normalizeIdentifier(
        section.getAttribute("data-id"),
      );
      if (dataId) return dataId;

      const pidLink = section.querySelector("a[data-pid]");
      const dataPid = ViewServiceDoc.normalizeIdentifier(
        pidLink?.getAttribute("data-pid"),
      );
      if (dataPid) return dataPid;

      const distributionPid =
        this.constructor.inferEntityPidFromDistributionLinks(section);
      if (distributionPid) return distributionPid;

      return null;
    }

    /**
     * Infer a PID from online distribution links inside a section.
     * @param {Element} section Candidate entity section
     * @returns {string|null} Normalized PID, or null when not found
     */
    static inferEntityPidFromDistributionLinks(section) {
      if (!section?.querySelectorAll) return null;

      const dataPidLink = Array.from(section.querySelectorAll("a")).find(
        (link) =>
          ViewServiceDoc.normalizeIdentifier(link.getAttribute("data-pid")),
      );
      if (dataPidLink) {
        return ViewServiceDoc.normalizeIdentifier(
          dataPidLink.getAttribute("data-pid"),
        );
      }

      const links = Array.from(section.querySelectorAll("a"));
      for (let i = 0; i < links.length; i += 1) {
        const pid = ViewServiceDoc.extractPidFromHref(
          links[i].getAttribute("href"),
        );
        if (pid) return pid;
      }

      return null;
    }

    /**
     * Find the section that describes one data entity.
     * @param {object} params Lookup params
     * @param {string} params.pid Entity PID
     * @param {string} [params.fileName] Entity file name
     * @param {string} [params.metadataPid] Current metadata PID
     * @param {DocumentFragment} params.root Detached parse root
     * @returns {Element|null} Matching entity section
     */
    findEntitySection({
      pid,
      fileName = "",
      metadataPid = this.pid,
      root,
    } = {}) {
      if (!root) return null;

      const normalizedPid = ViewServiceDoc.normalizeIdentifier(pid);
      const normalizedFileName = ValueUtilities.normalizeText(fileName);
      if (!normalizedPid && !normalizedFileName) return null;

      const selected = this.constructor.findEntitySectionBySelector(root, {
        pid: normalizedPid,
        fileName: normalizedFileName,
      });
      if (selected) return selected;

      if (!normalizedPid) {
        return this.findEntitySectionByFileName(root, normalizedFileName);
      }

      const existing = this.constructor.findEntitySectionByDataId(
        root,
        normalizedPid,
      );
      if (existing) return existing;

      if (
        metadataPid &&
        normalizedPid === ViewServiceDoc.normalizeIdentifier(metadataPid)
      ) {
        return root.querySelector(`#${IDS.metadata}`) || null;
      }

      const linked = this.constructor.findEntitySectionByPidLink(
        root,
        normalizedPid,
      );
      if (linked) return linked;

      const anchored = this.findEntitySectionByAnchor(root, normalizedPid);
      if (anchored) return anchored;

      const onlineDistribution = this.findEntitySectionByDistributionLink(
        root,
        normalizedPid,
      );
      if (onlineDistribution) return onlineDistribution;

      const named = this.findEntitySectionByFileName(root, fileName);
      if (named) return named;

      return null;
    }

    /**
     * Find and annotate the section that describes one data entity.
     * @param {object} params Lookup params
     * @returns {Element|null} Matching annotated entity section
     */
    findAndAnnotateEntitySection(params = {}) {
      const section = this.findEntitySection(params);
      if (!section) return null;

      this.annotateEntitySection(section, params.pid);
      return section;
    }

    /**
     * Find an entity section by standardized data attributes.
     * @param {DocumentFragment|Element} root Search root
     * @param {object} criteria Selector criteria
     * @returns {Element|null} Matching section
     */
    static findEntitySectionBySelector(root, criteria = {}) {
      const selector = ViewServiceDoc.getSelector(criteria);
      if (!root?.querySelector || !selector) return null;
      if (root.matches?.(selector)) return root;
      return root.querySelector(selector);
    }

    /**
     * Find an entity section by existing data-id.
     * @param {DocumentFragment} root Detached parse root
     * @param {string} pid Normalized PID
     * @returns {Element|null} Matching section
     */
    static findEntitySectionByDataId(root, pid) {
      const xmlSafePid = XMLUtilities.getXMLSafeID(pid);
      if (
        root.matches?.(ENTITY_SECTION_SELECTOR) &&
        ViewServiceDoc.dataIdMatchesPid(
          root.getAttribute("data-id"),
          pid,
          xmlSafePid,
        )
      ) {
        return root;
      }

      const sections = Array.from(
        root.querySelectorAll(ENTITY_SECTION_SELECTOR),
      );
      return (
        sections.find((section) =>
          ViewServiceDoc.dataIdMatchesPid(
            section.getAttribute("data-id"),
            pid,
            xmlSafePid,
          ),
        ) || null
      );
    }

    /**
     * Find an entity section containing a link with data-pid.
     * @param {DocumentFragment} root Detached parse root
     * @param {string} pid Normalized PID
     * @returns {Element|null} Matching section
     */
    static findEntitySectionByPidLink(root, pid) {
      const link = Array.from(
        root.querySelectorAll(`${ENTITY_SECTION_SELECTOR} a`),
      ).find(
        (candidate) =>
          ViewServiceDoc.normalizeIdentifier(
            candidate.getAttribute("data-pid"),
          ) === pid,
      );
      return link?.closest(ENTITY_SECTION_SELECTOR) || null;
    }

    /**
     * Find an entity section by anchor ID.
     * @param {DocumentFragment} root Detached parse root
     * @param {string} pid Normalized PID
     * @returns {Element|null} Matching section
     */
    findEntitySectionByAnchor(root, pid) {
      const xmlSafePid = XMLUtilities.getXMLSafeID(pid);
      const link = Array.from(root.querySelectorAll("a")).find((candidate) => {
        const id = candidate.getAttribute("id");
        return id === pid || id === xmlSafePid;
      });

      return link ? this.constructor.getEntityContainerForLink(link) : null;
    }

    /**
     * Find an entity section by a legacy Online Distribution Info link.
     * @param {DocumentFragment} root Detached parse root
     * @param {string} pid Normalized PID
     * @returns {Element|null} Matching section
     */
    findEntitySectionByDistributionLink(root, pid) {
      const labels = Array.from(
        root.querySelectorAll(`.${CLASS_NAMES.controlLabel}`),
      ).filter((label) =>
        ViewServiceDoc.textIncludes(label, "Online Distribution Info"),
      );

      for (let i = 0; i < labels.length; i += 1) {
        const well = labels[i].nextElementSibling;
        if (well?.classList?.contains(CLASS_NAMES.controlsWell)) {
          const link = Array.from(well.querySelectorAll("a")).find(
            (candidate) =>
              ViewServiceDoc.hrefMatchesPid(
                candidate.getAttribute("href"),
                pid,
              ),
          );
          if (link) return this.constructor.getEntityContainerForLink(link);
        }
      }

      return null;
    }

    /**
     * Find an entity section by object or entity file name.
     * @param {DocumentFragment} root Detached parse root
     * @param {string} fileName File name
     * @returns {Element|null} Matching section
     */
    findEntitySectionByFileName(root, fileName) {
      const normalizedFileName = ValueUtilities.normalizeText(fileName);
      if (!normalizedFileName) return null;

      const selected = this.constructor.findEntitySectionBySelector(root, {
        fileName: normalizedFileName,
      });
      if (selected) return selected;

      const dataObjectNameMatch = Array.from(
        root.querySelectorAll(`${ENTITY_SECTION_SELECTOR} [data-object-name]`),
      ).find(
        (candidate) =>
          ValueUtilities.normalizeText(
            candidate.getAttribute("data-object-name"),
          ) === normalizedFileName,
      );
      if (dataObjectNameMatch) {
        return dataObjectNameMatch.closest(ENTITY_SECTION_SELECTOR);
      }

      const labels = Array.from(
        root.querySelectorAll(
          `${ENTITY_SECTION_SELECTOR} .${CLASS_NAMES.controlLabel}`,
        ),
      ).filter(
        (label) =>
          ViewServiceDoc.textIncludes(label, "Object Name") ||
          ViewServiceDoc.textIncludes(label, "Entity Name"),
      );

      for (let i = 0; i < labels.length; i += 1) {
        const well = labels[i].nextElementSibling;
        if (
          well?.classList?.contains(CLASS_NAMES.controlsWell) &&
          ViewServiceDoc.textIncludes(well, normalizedFileName)
        ) {
          const section = labels[i].closest(ENTITY_SECTION_SELECTOR);
          if (section) return section;
        }
      }

      return null;
    }

    /**
     * Return the nearest entity container for a link, promoting a form section
     * when needed to match legacy view-service markup.
     * @param {Element} link Link element
     * @returns {Element|null} Entity container
     */
    static getEntityContainerForLink(link) {
      const existingContainer = link.closest(ENTITY_SECTION_SELECTOR);
      if (existingContainer) return existingContainer;

      const form = link.closest("form");
      if (!form) return null;

      let container = link;
      while (container.parentElement && container.parentElement !== form) {
        container = container.parentElement;
      }
      if (container.parentElement !== form) return null;

      return container;
    }

    /**
     * Collect entity summaries from annotated sections.
     * @param {DocumentFragment} root Detached parse root
     * @returns {object[]} Plain entity summaries
     */
    collectEntities(root) {
      if (!root) return [];

      const seen = new Set();
      const entities = [];

      this.getCandidateEntitySections(root).forEach((section, index) => {
        const entity = this.summarizeEntitySection(section, index);
        const key =
          entity.pid ||
          entity.objectName ||
          entity.entityName ||
          entity.sectionId ||
          String(index);
        if (seen.has(key)) return;
        seen.add(key);
        entities.push(entity);
      });

      return entities;
    }

    /**
     * Build a plain summary from one entity section.
     * @param {Element} section Entity section
     * @param {number} index Entity index
     * @returns {object} Entity summary
     */
    summarizeEntitySection(section, index = 0) {
      const pid =
        ViewServiceDoc.normalizeIdentifier(
          section?.getAttribute?.("data-id"),
        ) || this.inferEntityPidFromSection(section);
      const entityName = this.getEntityName(section);
      const objectName = this.getObjectName(section);
      const objectUrl = this.constructor.getEntityObjectUrl(section, pid);
      const selector = ViewServiceDoc.getSelector({
        pid,
        fileName: objectName,
        entityName,
      });

      return {
        pid,
        entityName,
        objectName,
        fileName: objectName,
        objectUrl,
        selector,
        sectionId: ValueUtilities.normalizeText(section?.getAttribute?.("id")),
        sectionIndex: index,
      };
    }

    /**
     * Get the entity display name from a section.
     * @param {Element} section Entity section
     * @returns {string|null} Entity name
     */
    getEntityName(section) {
      if (!section?.querySelector) return null;

      const annotatedEntityName = ValueUtilities.normalizeText(
        section.getAttribute(ENTITY_NAME_ATTRIBUTE),
      );
      if (annotatedEntityName) return annotatedEntityName;

      const entityName = ValueUtilities.normalizeText(
        section
          .querySelector(`.${CLASS_NAMES.entityName}[data-entity-name]`)
          ?.getAttribute("data-entity-name"),
      );
      if (entityName) return entityName;

      return this.constructor.getControlValue(section, "Entity Name");
    }

    /**
     * Get the object/file name from a section.
     * @param {Element} section Entity section
     * @returns {string|null} Object name
     */
    getObjectName(section) {
      if (!section?.querySelector) return null;

      const annotatedFileName = ValueUtilities.normalizeText(
        section.getAttribute(ENTITY_FILENAME_ATTRIBUTE),
      );
      if (annotatedFileName) return annotatedFileName;

      const objectName = ValueUtilities.normalizeText(
        section
          .querySelector("[data-object-name]")
          ?.getAttribute("data-object-name"),
      );
      if (objectName) return objectName;

      return this.constructor.getControlValue(section, "Object Name");
    }

    /**
     * Get a value from a legacy label/control-well pair.
     * @param {Element} section Entity section
     * @param {string} labelText Label text to match
     * @returns {string|null} Control value
     */
    static getControlValue(section, labelText) {
      if (!section?.querySelectorAll) return null;

      const label = Array.from(
        section.querySelectorAll(`.${CLASS_NAMES.controlLabel}`),
      ).find((candidate) => ViewServiceDoc.textIncludes(candidate, labelText));
      const well = label?.nextElementSibling;
      if (!well?.classList?.contains(CLASS_NAMES.controlsWell)) return null;

      return ValueUtilities.normalizeText(well.textContent);
    }

    /**
     * Get the object URL for an entity section.
     * @param {Element} section Entity section
     * @param {string} pid Entity PID
     * @returns {string|null} Object URL
     */
    static getEntityObjectUrl(section, pid) {
      if (!section?.querySelectorAll) return null;

      const links = Array.from(section.querySelectorAll("a"));
      const matched = links.find((link) => {
        const dataPid = ViewServiceDoc.normalizeIdentifier(
          link.getAttribute("data-pid"),
        );
        if (pid && dataPid === pid) return true;
        return pid
          ? ViewServiceDoc.hrefMatchesPid(link.getAttribute("href"), pid)
          : false;
      });

      return ValueUtilities.normalizeText(matched?.getAttribute("href"));
    }

    /**
     * Record a deterministic markup mutation.
     * @param {string} type Mutation type
     * @param {object} [details] Mutation details
     */
    recordMutation(type, details = {}) {
      this.mutations.push({ type, ...details });
    }

    /**
     * Record a parse warning.
     * @param {string} type Warning type
     * @param {object} [details] Warning details
     */
    recordWarning(type, details = {}) {
      this.warnings.push({ type, ...details });
    }

    /**
     * Check whether the rendered document has no content.
     * @returns {boolean} True when the document is empty
     */
    isEmpty() {
      return this.status === STATUS.EMPTY;
    }

    /**
     * Check whether the view service returned a transform error response.
     * @returns {boolean} True when parsing detected a transform error
     */
    hasTransformError() {
      return this.status === STATUS.TRANSFORM_ERROR;
    }

    /**
     * Check whether the rendered HTML is missing the expected metadata root.
     * @returns {boolean} True when the document is rendered but unstyled
     */
    isUnstyled() {
      return this.status === STATUS.UNSTYLED;
    }

    /**
     * Return a JSON-safe snapshot.
     * @returns {object} Plain document state
     */
    toJSON() {
      return {
        pid: this.pid,
        url: this.url,
        contentType: this.contentType,
        status: this.status,
        hasMetadataRoot: this.hasMetadataRoot,
        rawHtml: this.rawHtml,
        html: this.html,
        entities: this.entities.map((entity) => ({ ...entity })),
        entityPids: [...this.entityPids],
        warnings: this.warnings.map((warning) => ({ ...warning })),
        mutations: this.mutations.map((mutation) => ({ ...mutation })),
      };
    }

    /**
     * Create and parse a rendered metadata document from raw HTML.
     * @param {string} rawHtml Raw service response
     * @param {object} [options] Constructor and parse options
     * @returns {ViewServiceDoc} Parsed document
     */
    static fromHtml(rawHtml, options = {}) {
      return new ViewServiceDoc({
        ...options,
        rawHtml,
      }).parse();
    }

    /**
     * Normalize raw HTML input while preserving whitespace.
     * @param {*} value Candidate HTML
     * @returns {string} String HTML
     */
    static normalizeHtml(value) {
      if (value === undefined || value === null) return "";
      return String(value);
    }

    /**
     * Normalize view-service entity identifiers.
     * @param {*} value Candidate identifier
     * @returns {string|null} Normalized identifier, or null for empty input
     */
    static normalizeIdentifier(value) {
      let normalized = ValueUtilities.normalizeText(value);
      if (!normalized) return null;

      if (normalized.startsWith("urn-uuid-")) {
        normalized = normalized.replace("urn-uuid-", "urn:uuid:");
      }
      if (normalized.startsWith("doi-10.")) {
        normalized = normalized.replace("doi-10.", "doi:10.");
      }

      return normalized;
    }

    /**
     * Determine whether a response is a view-service transform error message.
     * @param {string} html Trimmed response text
     * @returns {boolean} True when the text matches the known transform error
     */
    static isTransformError(html) {
      return (
        typeof html === "string" &&
        html.length < 250 &&
        html.indexOf(TRANSFORM_ERROR_TEXT) > -1
      );
    }

    /**
     * Test whether element text includes a phrase.
     * @param {Element} element Element to inspect
     * @param {string} phrase Phrase to find
     * @returns {boolean} True when phrase is present
     */
    static textIncludes(element, phrase) {
      const text = element?.textContent || "";
      return text.indexOf(phrase) > -1;
    }

    /**
     * Build a standardized selector for annotated entity sections.
     * @param {object} [criteria] Selector criteria
     * @param {string} [criteria.pid] Entity PID
     * @param {string} [criteria.fileName] Entity file name
     * @param {string} [criteria.objectName] Object name alias
     * @param {string} [criteria.entityName] Entity name
     * @returns {string} CSS selector, or an empty string when no criteria
     * exist.
     */
    static getSelector({
      pid = null,
      fileName = null,
      objectName = null,
      entityName = null,
    } = {}) {
      const selectors = [];
      const normalizedPid = ViewServiceDoc.normalizeIdentifier(pid);
      const normalizedFileName = ValueUtilities.normalizeText(
        fileName || objectName,
      );
      const normalizedEntityName = ValueUtilities.normalizeText(entityName);

      if (normalizedPid) {
        selectors.push(
          `${ENTITY_SECTION_SELECTOR}[${ENTITY_PID_ATTRIBUTE}="${ViewServiceDoc.escapeAttributeValue(
            normalizedPid,
          )}"]`,
        );
      }

      if (normalizedFileName) {
        const escapedFileName =
          ViewServiceDoc.escapeAttributeValue(normalizedFileName);
        selectors.push(
          `${ENTITY_SECTION_SELECTOR}[${ENTITY_FILENAME_ATTRIBUTE}="${escapedFileName}"]`,
        );
        selectors.push(
          `${ENTITY_SECTION_SELECTOR}[${ENTITY_OBJECT_NAME_ATTRIBUTE}="${escapedFileName}"]`,
        );
      }

      if (normalizedEntityName) {
        selectors.push(
          `${ENTITY_SECTION_SELECTOR}[${ENTITY_NAME_ATTRIBUTE}="${ViewServiceDoc.escapeAttributeValue(
            normalizedEntityName,
          )}"]`,
        );
      }

      return ValueUtilities.dedupeStrings(selectors).join(", ");
    }

    /**
     * Escape a value for use inside a quoted CSS attribute selector.
     * @param {*} value Attribute value
     * @returns {string} Escaped attribute value
     */
    static escapeAttributeValue(value) {
      return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\A ")
        .replace(/\r/g, "\\D ")
        .replace(/\f/g, "\\C ");
    }

    /**
     * Compare a data-id value to a PID or its legacy XML-safe form.
     * @param {string} value Candidate data-id
     * @param {string} pid Normalized PID
     * @param {string} xmlSafePid XML-safe PID
     * @returns {boolean} True when the values match
     */
    static dataIdMatchesPid(value, pid, xmlSafePid) {
      const normalizedValue = ViewServiceDoc.normalizeIdentifier(value);
      return normalizedValue === pid || value === xmlSafePid;
    }

    /**
     * Check whether an href contains a PID in one common encoded form.
     * @param {string} href Candidate href
     * @param {string} pid Normalized PID
     * @returns {boolean} True when href appears to reference the PID
     */
    static hrefMatchesPid(href, pid) {
      const normalizedHref = ValueUtilities.normalizeText(href);
      const normalizedPid = ViewServiceDoc.normalizeIdentifier(pid);
      if (!normalizedHref || !normalizedPid) return false;

      const hrefPid = ViewServiceDoc.extractPidFromHref(normalizedHref);
      if (hrefPid) return hrefPid === normalizedPid;

      const candidates = ValueUtilities.dedupeStrings([
        normalizedPid,
        encodeURIComponent(normalizedPid),
        UrlUtilities.encodeDataONEPidForPath(normalizedPid),
        XMLUtilities.getXMLSafeID(normalizedPid),
      ]);

      return candidates.some((candidate) => normalizedHref.includes(candidate));
    }

    /**
     * Extract a PID from a legacy ecogrid link label.
     * @param {string} text Link text
     * @returns {string|null} PID, or null when not an ecogrid label
     */
    static extractEcoGridPid(text) {
      const linkText = ValueUtilities.normalizeText(text);
      if (!linkText || linkText.indexOf(ECOGRID_PREFIX) === -1) return null;

      const withoutPrefix = linkText.substring(
        linkText.indexOf(ECOGRID_PREFIX) + ECOGRID_PREFIX.length,
      );
      const slashIndex = withoutPrefix.indexOf("/");
      const pid =
        slashIndex > -1
          ? withoutPrefix.substring(slashIndex + 1)
          : withoutPrefix;
      return ViewServiceDoc.normalizeIdentifier(pid);
    }

    /**
     * Extract a likely DataONE PID from an object or resolve href.
     * @param {string} href Candidate href
     * @returns {string|null} Normalized PID, or null when not found
     */
    static extractPidFromHref(href) {
      const normalizedHref = ValueUtilities.normalizeText(href);
      if (!normalizedHref) return null;

      const withoutSuffix =
        UrlUtilities.stripFragment(normalizedHref).split("?")[0];
      const match = withoutSuffix.match(/\/(?:object|resolve)\/([^/]+)$/i);
      if (!match?.[1]) return null;

      return ViewServiceDoc.normalizeIdentifier(
        UrlUtilities.decodeDataONEPidFromPath(match[1]),
      );
    }
  }

  ViewServiceDoc.CLASS_NAMES = CLASS_NAMES;
  ViewServiceDoc.IDS = IDS;
  ViewServiceDoc.STATUS = STATUS;

  return ViewServiceDoc;
});
