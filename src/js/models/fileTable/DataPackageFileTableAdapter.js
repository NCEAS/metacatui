"use strict";

define([
  "common/ValueUtilities",
  "collections/ObjectFormats",
  "common/UrlUtilities",
], (Values, ObjectFormats, UrlUtilities) => {
  /**
   * @namespace DataPackageFileTableAdapter
   * @description Translates a {@link DataPackage} and its
   * {@link DataPackageMember}s into plain rows ready for rendering by a
   * {@link FileTableViewModel}. This is the only module that depends on both
   * contracts, so generic file table views do not read package members
   *
   * Rows are plain objects suitable for `FileTableViewModel#setRows`.
   * `buildRows()` is pure; `enrichMembers()` fetches the system metadata needed
   * to populate those rows.
   * @classcategory Models/FileTable
   * @since 0.0.0
   */

  /**
   * Per member remote upload state mapped to a row status descriptor. The
   * `title` summarizes what the status icon means and is shown as the cell
   * tooltip.
   */
  const REMOTE_STATE_STATUS = Object.freeze({
    pending: {
      title:
        "Waiting to upload. This file will be saved when you save the dataset.",
      iconClass: "icon icon-circle-blank warning icon-large",
    },
    uploading: {
      title: "Uploading now. This file is being saved to the repository.",
      iconClass: "icon icon-circle-blank warning icon-large",
    },
    uploaded: {
      title: "Saved. This file has been uploaded successfully.",
      iconClass: "icon icon-ok-circle success icon-large",
    },
    failed: {
      title: "Upload failed. Edit the file and save again to retry.",
      iconClass: "icon icon-circle-blank warning icon-large",
    },
    ambiguous: {
      title:
        "Needs verification. We could not confirm whether this file finished uploading.",
      iconClass: "icon icon-circle-blank warning icon-large",
    },
  });

  /**
   * Return active members missing details displayed in the file table.
   * @param {DataPackage} dataPackage Package to inspect
   * @returns {DataPackageMember[]} Members needing system metadata
   * @private
   */
  function getMembersNeedingSysMeta(dataPackage) {
    const rootPid =
      dataPackage.rootResourceMapPid ||
      dataPackage.getRootResourceMapMember()?.pid;
    return dataPackage.members.getActiveMembers().filter((member) => {
      if (
        !member.pid ||
        member.pid === rootPid ||
        member.sysMeta ||
        member.sysMetaMissing === true
      ) {
        return false;
      }

      const hasSize =
        typeof member.size === "number" ||
        (typeof member.size === "string" && member.size !== "");
      const formatId = member.getFormatId();
      const title = Array.isArray(member.title)
        ? member.title[0]
        : member.title;
      const hasDisplayName = Boolean(member.getFileName() || title);
      return member.isPlaceholder() || !hasSize || !formatId || !hasDisplayName;
    });
  }

  /**
   * Fetch system metadata needed to populate file table rows.
   * @param {DataPackage} dataPackage Package to enrich
   * @param {object} [options] Options passed to `DataPackage#fetchSysMeta`
   * @returns {Promise<object>} Attempted, fetched, missing, and unresolved PIDs
   */
  async function enrichMembers(dataPackage, options = {}) {
    const members = getMembersNeedingSysMeta(dataPackage);
    const attemptedPids = members.map((member) => member.pid);
    if (!attemptedPids.length || options.signal?.aborted) {
      return {
        attemptedPids,
        fetchedPids: [],
        missingPids: [],
        unresolvedPlaceholderPids: [],
        changed: false,
      };
    }

    const errors = await dataPackage.fetchSysMeta(attemptedPids, options);
    const missingPids = [];
    errors.forEach(({ pid, error }) => {
      if (error?.status !== 404) return;
      const member = dataPackage.members.get(pid);
      if (!member) return;
      member.sysMetaMissing = true;
      missingPids.push(pid);
    });
    const fetchedPids = members
      .filter((member) => member.sysMeta)
      .map((member) => member.pid);
    const unresolvedPlaceholderPids = dataPackage.members
      .getActiveMembers()
      .filter(
        (member) =>
          member.isPlaceholder() &&
          !member.sysMeta &&
          member.sysMetaMissing !== true,
      )
      .map((member) => member.pid);

    return {
      attemptedPids,
      fetchedPids,
      missingPids,
      unresolvedPlaceholderPids,
      changed: Boolean(fetchedPids.length || missingPids.length),
    };
  }

  /**
   * Read a member's PID.
   * @param {DataPackageMember} member Package member
   * @returns {string|null} Member PID
   */
  function getId(member) {
    return member?.pid || null;
  }

  /**
   * Build a download URL for a member.
   * @param {DataPackageMember} member Package member
   * @param {string} resolveBaseUrl Base resolve URL
   * @returns {string} Download URL, or ""
   */
  function getDownloadUrl(member, resolveBaseUrl) {
    if (member?.sysMetaMissing === true) return "";
    const direct = member?.url || member?.viewServiceEntity?.objectUrl || "";
    if (direct) return direct;
    const pid = getId(member);
    return UrlUtilities.getObjectDownloadUrl(pid, { baseUrl: resolveBaseUrl });
  }

  /**
   * Build a human readable size label.
   * @param {DataPackageMember} member Package member
   * @returns {string} Size label
   */
  function getSizeLabel(member) {
    const size = member?.size;
    const sizeNumber = Number(size);
    if (Number.isFinite(sizeNumber) && size !== "" && size != null) {
      return Values.bytesToSize(sizeNumber);
    }
    return size || "";
  }

  /**
   * Use the pre replacement values while a failed replacement is still
   * unresolved, so the table does not present unuploaded file details as saved.
   * @param {DataPackageMember} member Package member
   * @returns {object|null} Display values for the confirmed remote file
   */
  function getFailedReplacementDisplay(member) {
    if (
      member?.remoteState !== "failed" ||
      !member.remotePid ||
      member.pid === member.remotePid
    ) {
      return null;
    }

    const snapshot = member._replacementDisplay || null;
    const remoteSysMeta = member.remoteSysMeta?.toJSON?.() || {};
    if (snapshot) {
      return {
        pid: snapshot.pid || member.remotePid,
        fileName: snapshot.fileName ?? remoteSysMeta.fileName ?? "",
        title: snapshot.title ?? "",
        size: snapshot.size ?? remoteSysMeta.size,
        formatType: snapshot.formatType ?? member.formatType ?? "",
        formatId:
          snapshot.formatId ?? remoteSysMeta.formatId ?? member.formatId,
        mediaType:
          snapshot.mediaType ?? remoteSysMeta.mediaType ?? member.mediaType,
        atLocations: snapshot.atLocations ?? [],
      };
    }

    return {
      pid: member.remotePid,
      fileName: remoteSysMeta.fileName || "",
      title: member.title || "",
      size: remoteSysMeta.size,
      formatType: member.formatType || "",
      formatId: remoteSysMeta.formatId || member.formatId,
      mediaType: remoteSysMeta.mediaType || member.mediaType,
      atLocations: member.atLocations,
    };
  }

  /**
   * Pick an icon class for a member type.
   * @param {string} type Uppercase format type
   * @param {string} mode Table mode
   * @returns {string} Icon class
   */
  function getIconClass(type, mode) {
    if (mode === "viewer") return "icon-table";
    if (type === "RESOURCE") return "icon-large icon-folder-open";
    return "icon-large icon-file";
  }

  /**
   * Normalize a stored `prov:atLocation` value for display without mutating
   * the underlying graph value. e.g. ./data/../file.csv => file.csv.
   * @param {string} path Raw path like value from the RDF graph
   * @returns {string} Display friendly path string
   */
  function normalizeAtLocationForDisplay(path) {
    const normalizedPath = Values.normalizeText(path) || "";
    if (!normalizedPath) {
      return "/";
    }

    if (
      normalizedPath.startsWith("/") ||
      normalizedPath.startsWith("\\") ||
      normalizedPath.includes("\\") ||
      normalizedPath.includes("://") ||
      /^[A-Za-z]:[\\/]/.test(normalizedPath)
    ) {
      return normalizedPath;
    }

    const resolvedPath = [];

    normalizedPath.split("/").forEach((component, index) => {
      if (
        component === "" ||
        component === "." ||
        (component === "~" && index === 0)
      ) {
        return;
      }

      if (component === "..") {
        // Display normalization behaves like a relative-path collapse, but it
        // never mutates the raw prov:atLocation literal stored in the graph.
        if (resolvedPath.length) {
          resolvedPath.pop();
        }
        return;
      }

      resolvedPath.push(component);
    });

    return resolvedPath.join("/") || "/";
  }

  /**
   * Return location values as an array.
   * @param {string|string[]} locations Raw location value or values
   * @returns {string[]} Location values
   */
  function toLocationArray(locations) {
    if (Array.isArray(locations)) {
      return locations;
    }
    return Values.normalizeText(locations) ? [locations] : [];
  }

  /**
   * Build display friendly paths from raw member atLocations.
   * @param {object} source Member or confirmed remote display source
   * @returns {string[]} Display friendly paths
   */
  function getDisplayAtLocations(source) {
    return toLocationArray(source?.atLocations).map((path) =>
      normalizeAtLocationForDisplay(path),
    );
  }

  /**
   * Derive the folder path a member lives in from its display `atLocation`.
   * Member locations describe object paths, so the final segment is treated as
   * the object path segment and dropped. Explicit folder rows provide the
   * folder path context when users add files to a folder.
   * @param {DataPackageMember} member Package member
   * @param {object|null} [display] Optional confirmed remote display values
   * @returns {string} Slash joined folder path, or "" for top level
   */
  function deriveFolderPath(member, display) {
    const [displayPath] = getDisplayAtLocations(display || member);
    const normalizedPath = Values.normalizeText(displayPath);
    if (!normalizedPath || normalizedPath === "/") return "";

    const segments = normalizedPath
      .split("/")
      .map((segment) => Values.normalizeText(segment))
      .filter((segment) => segment && segment !== ".");
    if (!segments.length) return "";

    segments.pop();
    return segments.join("/");
  }

  /**
   * Build one action descriptor. The accessible label defaults to the title.
   * @param {string} id Action id
   * @param {string} label Button label
   * @param {string} title Tooltip/accessible title
   * @param {string} [iconClass] Icon class
   * @param {object} [options] Extra action state
   * @returns {object} Action descriptor
   */
  function action(id, label, title, iconClass = "", options = {}) {
    return { id, label, title, ariaLabel: title, iconClass, ...options };
  }

  /**
   * Build a download action for a labelled target.
   * @param {string} label Target label
   * @returns {object} Download action descriptor
   */
  function downloadAction(label) {
    return action(
      "download",
      "",
      `Download ${label} to your computer`,
      "icon icon-large icon-cloud-download",
      { className: "btn download btn-rounded action downloadAction" },
    );
  }

  /**
   * Build the editor share action for one row.
   * @param {string} label Target label
   * @returns {object} Share action descriptor
   */
  function shareAction(label) {
    return action(
      "share",
      "Share",
      `Click to change who can access ${label}`,
      "icon icon-group icon-on-left",
      {
        className: "btn access-policy-control",
      },
    );
  }

  /**
   * Describe a member's format type for the type column tooltip.
   * @param {DataPackageMember} member Package member
   * @param {string} type Uppercase format type
   * @param {string} typeLabel Friendly type label shown in the cell
   * @returns {string} Human readable description of the type
   */
  function getTypeTooltip(member, type, typeLabel) {
    const detail =
      member?.getFormatProperties?.().mediaType ||
      member?.getFormatId?.() ||
      member?.formatId ||
      "";
    let lead;
    if (type === "METADATA") lead = "Metadata that describes this dataset";
    else if (type === "RESOURCE") lead = "A data package (resource map)";
    else lead = "A data file";
    const parts = [lead];
    if (detail && detail !== typeLabel) parts.push(`format: ${detail}`);
    return parts.join(" - ");
  }

  /**
   * Build the action descriptors for one member row.
   * @param {object} context Row context
   * @param {string} context.mode "viewer" or "editor"
   * @param {string} context.type Member format type
   * @param {string} context.label Display label
   * @param {string} context.downloadUrl Download URL
   * @param {boolean} context.isResourceMapMember Whether this row is a resource
   * map
   * @param {boolean} context.isNestedPackage Whether this row links to a
   * nested dataset
   * @param {boolean} context.isUnavailable Whether object metadata is missing
   * @returns {object[]} Action descriptors
   */
  function buildActions({
    mode,
    type,
    label,
    downloadUrl,
    isResourceMapMember,
    isNestedPackage,
    isUnavailable,
  }) {
    const actions = [];

    if (mode === "editor") {
      // The editor never offers a download; files are edited, not downloaded.
      if (isNestedPackage) {
        actions.push(
          action(
            "remove",
            "",
            `Remove ${label} from this dataset`,
            "icon icon-remove",
          ),
        );
        return actions;
      }
      if (type === "METADATA") {
        actions.push(
          action(
            "add-files",
            "Add Files",
            `Add files documented by ${label}`,
            "icon icon-large icon-plus icon-on-left",
            { className: "addFiles btn btn-primary" },
          ),
        );
      }
      if (type === "DATA") {
        actions.push(
          action(
            "describe",
            "Describe",
            `Add details about ${label}, including descriptions of its attributes (columns)`,
            "",
            {
              className: "btn edit",
              menuItems: [
                action(
                  "replace",
                  "Replace",
                  `Replace ${label} with a different file`,
                ),
                action("remove", "Remove", `Remove ${label} from this dataset`),
              ],
            },
          ),
        );
      } else if (!isResourceMapMember && type !== "METADATA") {
        // Data and other non-metadata files are removable; the primary
        // metadata (EML) and the resource map are not.
        actions.push(
          action(
            "remove",
            "Remove",
            `Remove ${label} from this dataset`,
            "icon icon-remove",
          ),
        );
      }
      return actions;
    }

    // Viewer mode: metadata is download-only; other files also get a details
    // action.
    if (isUnavailable) {
      return actions;
    }
    if (isNestedPackage) {
      actions.push(
        action(
          "open-dataset",
          "",
          `Open ${label}`,
          "icon icon-large icon-external-link",
          { className: "btn btn-rounded action" },
        ),
      );
    } else if (!isResourceMapMember && type !== "METADATA") {
      actions.push(
        action(
          "preview",
          "",
          `View details, attributes, and a preview of ${label}`,
          "icon icon-large icon-info",
          { className: "btn btn-rounded action preview" },
        ),
      );
    }
    if (downloadUrl) {
      actions.push(downloadAction(label));
    }
    return actions;
  }

  /**
   * Resolve a friendly type label for a member, using short built in labels
   * before an injected object format resolver and the member's own media/format
   * fields.
   * @param {DataPackageMember} member Package member
   * @param {string} type Uppercase format type
   * @param {Function|null} formatName Resolver `(formatId, type) => string`
   * @param {string} mode Table mode
   * @returns {string} Friendly type label
   */
  function getTypeLabel(member, type, formatName, mode) {
    const formatId = member?.getFormatId?.() || member?.formatId || "";
    const mediaType =
      member?.getFormatProperties?.().mediaType || member?.mediaType || "";
    if (mode === "editor" && type === "DATA") return "Data";
    const shortFormatId = ObjectFormats.getFriendlyFormat(formatId);
    if (shortFormatId && shortFormatId !== formatId) return shortFormatId;
    const shortMediaType = ObjectFormats.getFriendlyFormat(mediaType);
    if (shortMediaType && shortMediaType !== mediaType) return shortMediaType;
    const friendly = formatName ? formatName(formatId, type) : "";
    return friendly || mediaType || member?.formatType || formatId || "";
  }

  /**
   * Build a render ready row for one member.
   * @param {DataPackageMember} member Package member
   * @param {object} options Build options
   * @param {string} options.mode "viewer" or "editor"
   * @param {string} options.resolveBaseUrl Base resolve URL for downloads
   * @param {Function} [options.formatName] Friendly format resolver
   * @param {boolean} [options.showMetrics] Whether to populate metric fields
   * @param {Function} [options.getRowMetric] Metric resolver
   * `(member, type) => {label, title, iconClass}|null`
   * @param {Function} [options.getMemberStatus] Status resolver
   * `(member, type) => {label, title, iconClass, progress}|null`
   * @param {string} [options.packageId] Root resource map PID
   * @param {boolean} [options.showShare] Whether sharing controls are shown
   * @param {object|null} [options.display] Optional confirmed remote display
   * values for unresolved failed replacements
   * @param {boolean} [options.isEagerUploading] Whether member editing is locked
   * @returns {object|null} Row object, or null when the member has no PID
   */
  function buildRow(
    member,
    {
      mode = "viewer",
      resolveBaseUrl = "",
      formatName = null,
      showMetrics = false,
      getRowMetric = null,
      getMemberStatus = null,
      packageId = "",
      showShare = true,
      display = null,
      isEagerUploading = false,
    },
  ) {
    const id = getId(member);
    if (!id) return null;

    const rowDisplay = display || getFailedReplacementDisplay(member);
    const type = member.getFormatType();
    const fileName = rowDisplay
      ? rowDisplay.fileName || ""
      : member?.getFileName();
    const displayPid = rowDisplay?.pid || id;
    const rawTitle = rowDisplay ? rowDisplay.title : member?.title;
    const displayTitle = Array.isArray(rawTitle)
      ? rawTitle[0] || ""
      : rawTitle || "";
    const typeMember = rowDisplay
      ? {
          formatType: rowDisplay.formatType || member.formatType,
          formatId: rowDisplay.formatId || "",
          mediaType: rowDisplay.mediaType || "",
          getFormatId: () => rowDisplay.formatId || null,
          getFormatProperties: () => ({
            formatType: rowDisplay.formatType || type || "",
            formatId: rowDisplay.formatId || "",
            mediaType: rowDisplay.mediaType || "",
            filename: fileName || "",
          }),
        }
      : member;
    const isResourceMapMember = member.isResourceMap();
    const isUnavailable = member?.sysMetaMissing === true;
    const isNestedPackage =
      Boolean(packageId) && isResourceMapMember && id !== packageId;
    let label = isNestedPackage
      ? displayTitle || fileName || displayPid
      : fileName || displayTitle || displayPid;
    if (mode === "viewer" && type === "METADATA" && fileName) {
      label = `Metadata: ${fileName}`;
    }
    const downloadUrl = getDownloadUrl(member, resolveBaseUrl);
    const customStatus =
      mode === "editor" && getMemberStatus
        ? getMemberStatus(member, type)
        : null;
    const statusConfig = REMOTE_STATE_STATUS[member?.remoteState];
    const status =
      customStatus ||
      (mode === "editor" && statusConfig
        ? { ...statusConfig, className: `status-${member.remoteState}` }
        : null);
    if (
      status &&
      member?.remoteState === "failed" &&
      member?.lastUploadError?.message
    ) {
      status.title = `Upload failed: ${member.lastUploadError.message}`;
    }
    const atLocations = toLocationArray(
      rowDisplay?.atLocations || member?.atLocations || [],
    );
    const displayLocations = getDisplayAtLocations(rowDisplay || member);
    const atLocation = atLocations[0] || "";
    const displayAtLocation = displayLocations[0] || atLocation;
    const metric =
      showMetrics && getRowMetric ? getRowMetric(member, type) : null;
    let kind = (type || "data").toLowerCase();
    if (isResourceMapMember) kind = "resource-map";
    if (isNestedPackage) kind = "dataset";
    const typeLabel = isNestedPackage
      ? "Nested package"
      : getTypeLabel(typeMember, type, formatName, mode);
    let typeTooltip = "";
    if (isNestedPackage) {
      typeTooltip = "A different dataset nested under this one";
    } else if (typeLabel) {
      typeTooltip = getTypeTooltip(typeMember, type, typeLabel);
    }
    const shareEnabled =
      mode === "editor" && showShare !== false && !isEagerUploading;

    return {
      id,
      pid: displayPid,
      parentId: "",
      label,
      title: displayTitle,
      name: fileName || "",
      // The tooltip carries the full display label (file name or package
      // title) so the complete text is recoverable when the cell truncates it.
      // The PID stays available in `id`/`pid`.
      titleTooltip: label,
      kind,
      className: isNestedPackage ? "nested-dataset" : "",
      iconClass: isNestedPackage ? "" : getIconClass(type, mode),
      sizeLabel: isNestedPackage ? "" : getSizeLabel(rowDisplay || member),
      typeLabel,
      typeTooltip,
      atLocation,
      displayAtLocation,
      downloadUrl,
      status,
      showMetrics: Boolean(showMetrics),
      showShare: shareEnabled,
      shareAction:
        shareEnabled && !isResourceMapMember ? shareAction(label) : null,
      metricLabel: metric?.label || "",
      metricTitle: metric?.title || "",
      metricIconClass: metric?.iconClass || "",
      isContainer: false,
      isRenamable:
        mode === "editor" &&
        type === "DATA" &&
        !isResourceMapMember &&
        !isEagerUploading,
      showStatus: mode === "editor",
      actions: isEagerUploading
        ? []
        : buildActions({
            mode,
            type,
            label,
            downloadUrl,
            isResourceMapMember,
            isNestedPackage,
            isUnavailable,
          }),
    };
  }

  /**
   * Reserve a unique id for a synthetic row.
   * @param {string} preferredId Descriptive id to use when available
   * @param {Set<string>} occupiedIds Reserved row ids
   * @returns {string} Reserved synthetic row id
   */
  function allocateSyntheticId(preferredId, occupiedIds) {
    let candidate = preferredId;
    let suffix = 1;

    while (occupiedIds.has(candidate)) {
      candidate = `${preferredId}:${suffix}`;
      suffix += 1;
    }

    occupiedIds.add(candidate);
    return candidate;
  }

  /**
   * Build folder rows for a set of folder paths, including ancestors, and
   * return them keyed by path.
   * @param {Set<string>} folderPaths Distinct non empty folder paths
   * @param {object} options Build options
   * @param {string} options.mode "viewer" or "editor"
   * @param {boolean} [options.showMetrics] Whether metrics are shown
   * @param {Set<string>} options.occupiedIds Reserved row ids
   * @returns {Map<string, object>} Folder rows keyed by folder path
   */
  function buildFolderRows(
    folderPaths,
    { mode, showMetrics = false, occupiedIds },
  ) {
    const folders = new Map();

    const ensureFolder = (path) => {
      if (!path || folders.has(path)) return;
      const segments = path.split("/");
      const name = segments[segments.length - 1];
      const parentPath = segments.slice(0, -1).join("/");
      ensureFolder(parentPath);
      folders.set(path, {
        id: allocateSyntheticId(`folder:${path}`, occupiedIds),
        parentId: parentPath ? folders.get(parentPath).id : "",
        label: name,
        name,
        atLocation: path,
        displayAtLocation: path,
        kind: "folder",
        iconClass: "icon icon-folder-open",
        isContainer: true,
        isExpandable: true,
        // All folders (top-level and nested) load collapsed; only the dataset
        // root row is expanded by default.
        isExpanded: false,
        acceptsFiles: mode === "editor",
        level: segments.length - 1,
        showStatus: mode === "editor",
        showMetrics: Boolean(showMetrics),
        actions:
          mode === "editor"
            ? [
                action(
                  "add-files",
                  "Add files",
                  `Add files to ${path}`,
                  "icon icon-large icon-plus icon-on-left",
                  { className: "addFiles btn btn-primary" },
                ),
              ]
            : [],
      });
    };

    folderPaths.forEach(ensureFolder);
    return folders;
  }

  /**
   * Rank a row within its parent's children: metadata first, nested packages
   * next, folders next, plain files last.
   * @param {object} row Row
   * @returns {number} Sort rank
   */
  function childRank(row) {
    if (row.kind === "dataset") return row.parentId ? 1 : -1;
    if (row.kind === "metadata") return 0;
    if (row.kind === "folder" || row.isContainer) return 2;
    return 3;
  }

  /**
   * Order rows depth first so each folder is immediately followed by its
   * descendants, with each parent's children grouped metadata -> folders ->
   * files.
   * @param {object[]} rows All rows (folders and files)
   * @returns {object[]} Depth first ordered rows
   */
  function orderRowsDepthFirst(rows) {
    const childrenByParent = new Map();
    rows.forEach((row) => {
      const key = row.parentId || "";
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key).push(row);
    });
    childrenByParent.forEach((children) => {
      children.sort((a, b) => childRank(a) - childRank(b));
    });

    const ordered = [];
    const visit = (parentId) => {
      (childrenByParent.get(parentId) || []).forEach((row) => {
        ordered.push(row);
        visit(row.id);
      });
    };
    visit("");
    return ordered;
  }

  /**
   * Build the top level dataset row that stands in for the package itself. All
   * other rows nest beneath it, mirroring the legacy table where the root row
   * was the dataset name and the resource map had no row of its own.
   * @param {object} options Root options
   * @param {string|string[]} options.packageTitle Dataset title
   * @param {string} options.packageId Package/root resource map PID
   * @param {string} options.packageDownloadUrl Whole package download URL
   * @param {string} options.mode "viewer" or "editor"
   * @param {boolean} options.showMetrics Whether metrics are shown
   * @param {boolean} options.showShare Whether sharing controls are shown
   * @param {string} [options.preferredDatasetRootId] Preferred synthetic root
   * id when a caller needs a stable identity across package PID changes
   * @param {Set<string>} options.occupiedIds Reserved row ids
   * @returns {object} Dataset root row
   */
  function buildDatasetRootRow({
    packageTitle,
    packageId,
    packageDownloadUrl,
    mode,
    showMetrics,
    showShare = true,
    preferredDatasetRootId = "",
    occupiedIds,
  }) {
    const title = Array.isArray(packageTitle)
      ? packageTitle[0] || ""
      : packageTitle;
    const label = title || packageId || "Dataset";
    const shareEnabled = mode === "editor" && showShare !== false;
    const actions = [];
    if (mode === "editor") {
      actions.push(
        action(
          "add-files",
          "Add Files",
          `Add files to ${label}`,
          "icon icon-large icon-plus icon-on-left",
          {
            className: "addFiles btn btn-primary",
          },
        ),
      );
    } else if (packageDownloadUrl) {
      actions.push(
        action(
          "download",
          "Download All",
          `Download all files in ${label}`,
          "",
          {
            className: "btn btn-primary downloadAction",
          },
        ),
      );
    }

    return {
      id: allocateSyntheticId(
        preferredDatasetRootId ||
          (packageId ? `dataset:${packageId}` : "dataset:root"),
        occupiedIds,
      ),
      pid: packageId || "",
      parentId: "",
      label,
      name: label,
      title: title || "",
      titleTooltip: title || label,
      kind: "dataset",
      iconClass: "",
      className: "root-dataset",
      sizeLabel: "",
      typeTooltip: "The primary dataset shown on this page",
      downloadUrl: packageDownloadUrl || "",
      level: 0,
      isContainer: true,
      isExpandable: true,
      isExpanded: true,
      acceptsFiles: mode === "editor",
      showMetrics: Boolean(showMetrics),
      showShare: shareEnabled,
      shareAction: shareEnabled ? shareAction(label) : null,
      showStatus: mode === "editor",
      isRenamable: mode === "editor",
      actions,
    };
  }

  /**
   * Build all file table rows for a package, including a folder hierarchy
   * derived from member `atLocation` paths.
   *
   * When `packageTitle` or `packageId` is supplied, the table is rendered as a
   * dataset: a single root row (the dataset) is added, every other row nests
   * beneath it, the resource map is hidden (the root stands in for it), and the
   * primary metadata is grouped first.
   * @param {DataPackage} dataPackage Package to render
   * @param {object} [options] Build options
   * @param {string} [options.mode] "viewer" (default) or "editor"
   * @param {string} [options.resolveBaseUrl] Base resolve URL for downloads
   * @param {DataPackageMember[]} [options.members] Members to render. Defaults
   * to the package's active members
   * @param {boolean} [options.showMetrics] Whether to populate metric fields
   * @param {Function} [options.formatName] Friendly format resolver
   * `(formatId, type) => string`
   * @param {Function} [options.getRowMetric] Metric resolver
   * `(member, type) => {label, title, iconClass}|null`
   * @param {Function} [options.getMemberStatus] Status resolver
   * `(member, type) => {label, title, iconClass, progress}|null`
   * @param {boolean} [options.showShare] Whether sharing controls are shown
   * @param {string|string[]} [options.packageTitle] Dataset title for the root
   * row
   * @param {string} [options.packageId] Package (root resource map) PID
   * @param {string} [options.preferredDatasetRootId] Preferred synthetic root
   * id when a caller needs a stable identity across package PID changes
   * @param {string} [options.packageDownloadUrl] Whole package download URL
   * @returns {object[]} Render ready rows for `FileTableViewModel#setRows`
   */
  function buildRows(dataPackage, options = {}) {
    const {
      mode = "viewer",
      resolveBaseUrl = "",
      showMetrics = false,
      formatName = null,
      getRowMetric = null,
      getMemberStatus = null,
      showShare = true,
      packageTitle = "",
      packageId = "",
      preferredDatasetRootId = "",
      packageDownloadUrl = "",
    } = options;
    const rowOptions = {
      mode,
      resolveBaseUrl,
      showMetrics,
      formatName,
      getRowMetric,
      getMemberStatus,
      packageId,
      showShare,
    };
    const datasetMode = Boolean(packageTitle || packageId);
    const allMembers =
      options.members || dataPackage?.members?.getActiveMembers?.() || [];
    const occupiedIds = new Set(allMembers.map(getId).filter(Boolean));
    const hasMissingMember = allMembers.some(
      (member) => member?.sysMetaMissing === true,
    );
    // In dataset mode the root row represents this package's resource map.
    // Other resource maps are nested datasets and remain visible.
    const rootResourceMap = datasetMode
      ? allMembers.find((member) => getId(member) === packageId) ||
        allMembers.find((member) => member?.isResourceMap())
      : null;
    const members = datasetMode
      ? allMembers.filter((member) => member !== rootResourceMap)
      : allMembers;

    const fileRows = [];
    const folderPaths = new Set();
    const folderPathByRow = new Map();

    members.forEach((member) => {
      const display = getFailedReplacementDisplay(member);
      const row = buildRow(member, {
        ...rowOptions,
        display,
        isEagerUploading:
          dataPackage?.eagerUploads?.has(getId(member)) === true,
      });
      if (!row) return;
      const folderPath = deriveFolderPath(member, display);
      if (folderPath) {
        row.level = folderPath.split("/").length;
        folderPaths.add(folderPath);
        folderPathByRow.set(row, folderPath);
      }
      fileRows.push(row);
    });

    const folders = folderPaths.size
      ? buildFolderRows(folderPaths, { mode, showMetrics, occupiedIds })
      : new Map();
    folderPathByRow.forEach((folderPath, row) => {
      const target = row;
      target.parentId = folders.get(folderPath).id;
    });
    let rows = [...folders.values(), ...fileRows];

    if (datasetMode) {
      const rootRow = buildDatasetRootRow({
        packageTitle,
        packageId,
        packageDownloadUrl: hasMissingMember ? "" : packageDownloadUrl,
        mode,
        showMetrics,
        showShare,
        preferredDatasetRootId,
        occupiedIds,
      });
      rows.forEach((row) => {
        const target = row;
        if (!target.parentId) target.parentId = rootRow.id;
        target.level = (Number(target.level) || 0) + 1;
      });
      rows = [rootRow, ...rows];
    }

    // A flat table with no hierarchy keeps its input order.
    if (!folderPaths.size && !datasetMode) return fileRows;
    return orderRowsDepthFirst(rows);
  }

  return {
    enrichMembers,
    buildRows,
  };
});
