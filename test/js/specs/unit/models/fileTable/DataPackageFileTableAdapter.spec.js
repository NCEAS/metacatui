define([
  "models/fileTable/DataPackageFileTableAdapter",
  "models/dataPackage/DataPackage",
  "models/dataPackage/DataPackageMember",
], (Adapter, DataPackage, DataPackageMember) => {
  const { expect } = chai;
  chai.should();

  /**
   * Build a DataPackageMember with the given info.
   * @param {object} info Member info
   * @returns {DataPackageMember} Member
   */
  function member(info) {
    return new DataPackageMember(info);
  }

  /**
   * Find a row by id.
   * @param {object[]} rows Rows
   * @param {string} id Row id
   * @returns {object|undefined} Matching row
   */
  function row(rows, id) {
    return rows.find((r) => r.id === id);
  }

  /**
   * Assert that every row has a distinct id.
   * @param {object[]} rows Rows
   */
  function expectUniqueRowIds(rows) {
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).to.equal(ids.length);
  }

  describe("DataPackageFileTableAdapter", () => {
    describe("enrichMembers()", () => {
      let sandbox;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
      });

      afterEach(() => {
        sandbox.restore();
      });

      it("fetches active members missing file-table details", async () => {
        const dataPackage = new DataPackage({
          members: [
            {
              pid: "resource_map_1",
              formatType: "RESOURCE",
              formatId: "http://www.openarchives.org/ore/terms",
            },
            {
              pid: "placeholder.1",
              formatType: "DATA",
              formatId: "text/csv",
              size: 12,
              fileName: "placeholder.csv",
              isPlaceHolder_b: true,
            },
            {
              pid: "missing-size.1",
              formatType: "DATA",
              formatId: "text/csv",
              fileName: "missing-size.csv",
            },
            {
              pid: "missing-format.1",
              formatType: "DATA",
              size: 12,
              fileName: "missing-format.csv",
            },
            {
              pid: "missing-display.1",
              formatType: "DATA",
              formatId: "text/csv",
              size: 12,
            },
            {
              pid: "complete.1",
              formatType: "DATA",
              formatId: "text/csv",
              size: 12,
              fileName: "complete.csv",
            },
            { pid: "has-sysmeta.1", formatType: "DATA" },
            {
              pid: "known-missing.1",
              formatType: "DATA",
              sysMetaMissing: true,
            },
            { pid: "removed.1", formatType: "DATA" },
          ],
        });
        dataPackage.rootResourceMapPid = "resource_map_1";
        dataPackage.getMember("has-sysmeta.1").sysMeta = {
          identifier: "has-sysmeta.1",
        };
        dataPackage.getMember("removed.1").markRemoved();
        const fetchSysMeta = sandbox
          .stub(dataPackage, "fetchSysMeta")
          .resolves([]);
        const controller = new AbortController();

        const result = await Adapter.enrichMembers(dataPackage, {
          signal: controller.signal,
          maxConcurrent: 2,
        });

        result.attemptedPids.should.deep.equal([
          "placeholder.1",
          "missing-size.1",
          "missing-format.1",
          "missing-display.1",
        ]);
        result.unresolvedPlaceholderPids.should.deep.equal(["placeholder.1"]);
        result.changed.should.equal(false);
        sinon.assert.calledOnceWithExactly(fetchSysMeta, result.attemptedPids, {
          signal: controller.signal,
          maxConcurrent: 2,
        });
      });

      it("marks only 404 failures missing and reports unresolved placeholders", async () => {
        const dataPackage = new DataPackage({
          members: [
            { pid: "found.1", formatType: "DATA" },
            {
              pid: "missing.1",
              formatType: "DATA",
              isPlaceHolder_b: true,
            },
            {
              pid: "unresolved.1",
              formatType: "DATA",
              isPlaceHolder_b: true,
            },
          ],
        });
        sandbox
          .stub(dataPackage, "fetchSysMeta")
          .callsFake(async (attemptedPids) => {
            attemptedPids.should.deep.equal([
              "found.1",
              "missing.1",
              "unresolved.1",
            ]);
            dataPackage.getMember("found.1").sysMeta = {
              identifier: "found.1",
            };
            return [
              {
                pid: "missing.1",
                error: Object.assign(new Error("not found"), { status: 404 }),
              },
              {
                pid: "unresolved.1",
                error: Object.assign(new Error("unauthorized"), {
                  status: 401,
                }),
              },
            ];
          });

        const result = await Adapter.enrichMembers(dataPackage);

        result.should.deep.equal({
          attemptedPids: ["found.1", "missing.1", "unresolved.1"],
          fetchedPids: ["found.1"],
          missingPids: ["missing.1"],
          unresolvedPlaceholderPids: ["unresolved.1"],
          changed: true,
        });
        dataPackage.getMember("missing.1").sysMetaMissing.should.equal(true);
        expect(dataPackage.getMember("unresolved.1").sysMetaMissing).to.equal(
          undefined,
        );
      });
    });

    describe("viewer rows", () => {
      it("maps members to flat rows with preview and download actions", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          resolveBaseUrl: "https://cn.test/resolve/",
          members: [
            member({ pid: "data.1", formatType: "DATA", fileName: "a.csv" }),
            member({ pid: "meta.1", formatType: "METADATA" }),
            member({ pid: "rm.1", formatType: "RESOURCE" }),
          ],
        });

        rows.length.should.equal(3);
        const data = row(rows, "data.1");
        data.label.should.equal("a.csv");
        data.kind.should.equal("data");
        data.actions
          .map((a) => a.id)
          .should.deep.equal(["preview", "download"]);
        data.parentId.should.equal("");

        // Resource maps get neither a preview action nor a remove action.
        const rm = row(rows, "rm.1");
        rm.kind.should.equal("resource-map");
        rm.actions.map((a) => a.id).should.deep.equal(["download"]);
      });

      it("gives metadata download-only and data a details action with an icon", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          resolveBaseUrl: "https://cn.test/resolve/",
          members: [
            member({ pid: "data.1", formatType: "DATA", fileName: "a.csv" }),
            member({ pid: "meta.1", formatType: "METADATA" }),
          ],
        });

        // Metadata: download only (no "More info").
        row(rows, "meta.1")
          .actions.map((a) => a.id)
          .should.deep.equal(["download"]);

        // Data: the details action carries an icon (rendered icon-only).
        const preview = row(rows, "data.1").actions.find(
          (a) => a.id === "preview",
        );
        preview.iconClass.should.match(/icon/);
      });

      it("builds a download URL from the resolve base when the member has none", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "viewer",
          resolveBaseUrl: "https://cn.test/resolve/",
          members: [member({ pid: "urn:uuid:x", formatType: "DATA" })],
        });
        r.actions
          .find((a) => a.id === "download")
          .title.should.match(/Download/);
        r.downloadUrl.should.equal("https://cn.test/resolve/urn%3Auuid%3Ax");
      });

      it("keeps missing placeholder rows visible without preview or download actions", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "viewer",
          resolveBaseUrl: "https://cn.test/resolve/",
          members: [
            member({
              pid: "placeholder.1",
              formatType: "DATA",
              isPlaceHolder_b: true,
              sysMetaMissing: true,
            }),
          ],
        });

        r.id.should.equal("placeholder.1");
        r.actions.should.deep.equal([]);
        r.downloadUrl.should.equal("");
      });

      it("reads members from the package by default", () => {
        const pkg = new DataPackage({
          members: [member({ pid: "data.1", formatType: "DATA" })],
        });
        const rows = Adapter.buildRows(pkg, { mode: "viewer" });
        rows.map((r) => r.id).should.deep.equal(["data.1"]);
      });

      it("exposes the PID and a type description for row tooltips", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "viewer",
          formatName: (id) => (id === "text/csv" ? "CSV" : ""),
          members: [
            member({
              pid: "urn:uuid:abc",
              formatType: "DATA",
              fileName: "a.csv",
              formatId: "text/csv",
            }),
          ],
        });

        // The PID is available for the name tooltip.
        r.pid.should.equal("urn:uuid:abc");
        r.typeLabel.should.equal("CSV");
        // The type tooltip describes the format, including the underlying id.
        r.typeTooltip.should.match(/data file/i);
        r.typeTooltip.should.match(/text\/csv/);
      });
    });

    describe("editor rows", () => {
      it("emits a describe menu and share action with an upload status, and never a download", () => {
        const data = member({
          pid: "data.2",
          remotePid: "data.1",
          formatType: "DATA",
          fileName: "b.csv",
          remoteState: "uploading",
        });
        const [r] = Adapter.buildRows(null, {
          mode: "editor",
          resolveBaseUrl: "https://cn.test/resolve/",
          members: [data],
        });

        // Even a remote member gets no download action in editor mode.
        r.actions.map((a) => a.id).should.deep.equal(["describe"]);
        r.actions
          .find((a) => a.id === "describe")
          .menuItems.map((a) => a.id)
          .should.deep.equal(["replace", "remove"]);
        r.shareAction.id.should.equal("share");
        r.isRenamable.should.equal(true);
        r.showStatus.should.equal(true);
        r.status.className.should.equal("status-uploading");
        // The status tooltip summarizes what the icon means.
        r.status.title.should.match(/Uploading/);
      });

      it("makes eager-upload rows read-only until the upload settles", () => {
        const data = member({
          pid: "data.eager",
          formatType: "DATA",
          fileName: "eager.csv",
          remoteState: "uploading",
        });
        const pkg = new DataPackage({ members: [data] });
        pkg.eagerUploads.set(data.pid, { promise: Promise.resolve() });

        const [uploading] = Adapter.buildRows(pkg, { mode: "editor" });

        uploading.actions.should.deep.equal([]);
        expect(uploading.shareAction).to.equal(null);
        uploading.isRenamable.should.equal(false);

        pkg.eagerUploads.clear();
        data.remoteState = "uploaded";
        const [settled] = Adapter.buildRows(pkg, { mode: "editor" });
        settled.actions.should.have.lengthOf(1);
        settled.shareAction.id.should.equal("share");
        settled.isRenamable.should.equal(true);
      });

      it("never offers a download action in editor mode", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "editor",
          members: [member({ pid: "data.new", formatType: "DATA" })],
        });
        r.actions.map((a) => a.id).should.deep.equal(["describe"]);
        r.actions.some((a) => a.id === "download").should.equal(false);
        r.shareAction.id.should.equal("share");
        expect(r.status).to.equal(null);
      });

      it("hides editor share actions when sharing is disabled", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "editor",
          showShare: false,
          members: [member({ pid: "data.1", formatType: "DATA" })],
        });

        r.showShare.should.equal(false);
        expect(r.shareAction).to.equal(null);
      });

      it("uses a caller-supplied editor status when provided", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "editor",
          members: [
            member({
              pid: "data.uploading",
              formatType: "DATA",
              remoteState: "uploading",
            }),
          ],
          getMemberStatus: () => ({
            title: "Uploading 40%",
            iconClass: "icon icon-circle-blank warning icon-large",
            className: "status-uploading",
            progress: 40,
          }),
        });

        r.status.title.should.equal("Uploading 40%");
        r.status.progress.should.equal(40);
      });

      it("includes the upload failure reason in failed editor status", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "editor",
          members: [
            member({
              pid: "data.failed",
              formatType: "DATA",
              remoteState: "failed",
              lastUploadError: new Error("already obsolete"),
            }),
          ],
        });

        r.status.title.should.equal("Upload failed: already obsolete");
      });

      it("shows original file details for a failed replacement", () => {
        const replacement = member({
          pid: "data.2",
          remotePid: "data.1",
          formatType: "DATA",
          formatId: "text/csv",
          fileName: "replacement.csv",
          title: "Replacement title",
          size: 2048,
          remoteState: "failed",
          lastUploadError: new Error("already obsolete"),
          atLocations: ["uploads/replacement.csv"],
        });
        Reflect.set(replacement, "_replacementDisplay", {
          pid: "data.1",
          fileName: "original.csv",
          title: "Original title",
          size: 100,
          formatType: "DATA",
          formatId: "text/csv",
          mediaType: "text/csv",
          atLocations: ["data/original.csv"],
        });

        const rows = Adapter.buildRows(null, {
          mode: "editor",
          members: [replacement],
        });
        const r = row(rows, "data.2");

        r.id.should.equal("data.2");
        r.pid.should.equal("data.1");
        r.label.should.equal("original.csv");
        r.name.should.equal("original.csv");
        r.title.should.equal("Original title");
        r.titleTooltip.should.equal("original.csv");
        r.sizeLabel.should.equal("100 B");
        r.parentId.should.equal("folder:data");
        r.displayAtLocation.should.equal("data/original.csv");
        r.status.title.should.equal("Upload failed: already obsolete");
        r.actions[0].title.should.contain("original.csv");
        r.actions[0].menuItems
          .find((action) => action.id === "replace")
          .title.should.contain("original.csv");
        r.actions[0].title.should.not.contain("replacement.csv");
      });

      it("gives clear tooltips to the editor actions", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "editor",
          members: [
            member({ pid: "data.1", formatType: "DATA", fileName: "a.csv" }),
          ],
        });

        const describe = r.actions.find((a) => a.id === "describe");
        describe.title.should.match(/attributes/i);
        describe.menuItems
          .find((a) => a.id === "replace")
          .title.should.match(/Replace/);
        describe.menuItems
          .find((a) => a.id === "remove")
          .title.should.match(/Remove/);
        r.shareAction.title.should.match(/who can access/i);
      });

      it("does not allow removing or renaming the resource map", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "editor",
          members: [member({ pid: "rm.1", formatType: "RESOURCE" })],
        });
        r.actions.map((a) => a.id).should.deep.equal([]);
        expect(r.shareAction).to.equal(null);
        r.isRenamable.should.equal(false);
      });

      it("emits add-files for metadata rows and does not allow removing the EML", () => {
        const [r] = Adapter.buildRows(null, {
          mode: "editor",
          members: [member({ pid: "meta.1", formatType: "METADATA" })],
        });
        r.actions.map((a) => a.id).should.deep.equal(["add-files"]);
        r.shareAction.id.should.equal("share");
      });
    });

    describe("folder hierarchy from atLocation", () => {
      it("normalizes raw atLocation values for display", () => {
        [
          ["./q/../w.csv", "w.csv"],
          [".", "/"],
          ["~/q/w.csv", "q/w.csv"],
          ["folder1///folder2/file.txt", "folder1/folder2/file.txt"],
          ["../x.csv", "x.csv"],
          ["a/../../x.csv", "x.csv"],
        ].forEach(([atLocation, expected], index) => {
          const pid = `data.${index}`;
          const rows = Adapter.buildRows(null, {
            members: [member({ pid, atLocations: [atLocation] })],
          });
          row(rows, pid).displayAtLocation.should.equal(expected);
        });
      });

      it("does not synthesize a folder from the final member location segment", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({
              pid: "data.1",
              formatType: "DATA",
              fileName: "testfile (65).txt",
              atLocations: ["measurements/qc/file-062.json"],
            }),
          ],
        });

        row(rows, "folder:measurements").should.be.an("object");
        row(rows, "folder:measurements/qc").should.be.an("object");
        expect(row(rows, "folder:measurements/qc/file-062.json")).to.equal(
          undefined,
        );
        row(rows, "data.1").parentId.should.equal("folder:measurements/qc");
      });

      it("synthesizes folder rows with ancestors and parents files under them", () => {
        const rows = Adapter.buildRows(null, {
          mode: "editor",
          members: [
            member({
              pid: "data.1",
              formatType: "DATA",
              fileName: "a.csv",
              atLocations: ["/data/raw/a.csv"],
            }),
            member({ pid: "meta.1", formatType: "METADATA" }),
          ],
        });

        // Two folder rows (data, data/raw) plus the two members.
        const dataFolder = row(rows, "folder:data");
        const rawFolder = row(rows, "folder:data/raw");
        dataFolder.isContainer.should.equal(true);
        dataFolder.parentId.should.equal("");
        dataFolder.isExpanded.should.equal(false);
        dataFolder.acceptsFiles.should.equal(true);
        dataFolder.atLocation.should.equal("data");
        dataFolder.actions
          .map((action) => action.id)
          .should.deep.equal(["add-files"]);
        rawFolder.parentId.should.equal("folder:data");
        // All folders load collapsed, including nested subfolders.
        rawFolder.isExpanded.should.equal(false);

        // The data file is parented under its folder; the metadata stays top-level.
        row(rows, "data.1").parentId.should.equal("folder:data/raw");
        row(rows, "data.1").level.should.equal(2);
        row(rows, "data.1").displayAtLocation.should.equal("/data/raw/a.csv");
        row(rows, "meta.1").parentId.should.equal("");
      });

      it("keeps a member distinct from a colliding synthetic folder", () => {
        const memberPid = "folder:data";
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({
              pid: memberPid,
              formatType: "DATA",
              fileName: "file.csv",
              atLocations: ["data/file.csv"],
            }),
          ],
        });

        const memberRow = row(rows, memberPid);
        const folderRow = rows.find(
          (candidate) =>
            candidate.kind === "folder" && candidate.atLocation === "data",
        );

        expectUniqueRowIds(rows);
        memberRow.id.should.equal(memberPid);
        folderRow.id.should.not.equal(memberPid);
        memberRow.parentId.should.equal(folderRow.id);
        rows.indexOf(folderRow).should.equal(rows.indexOf(memberRow) - 1);
      });

      it("skips occupied fallback ids for synthetic folders", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({
              pid: "folder:data",
              formatType: "DATA",
              fileName: "file.csv",
              atLocations: ["data/file.csv"],
            }),
            member({
              pid: "folder:data:1",
              formatType: "DATA",
              fileName: "other.csv",
            }),
          ],
        });
        const folderRow = rows.find(
          (candidate) =>
            candidate.kind === "folder" && candidate.atLocation === "data",
        );

        expectUniqueRowIds(rows);
        folderRow.id.should.equal("folder:data:2");
        row(rows, "folder:data").parentId.should.equal(folderRow.id);
        row(rows, "folder:data:1").id.should.equal("folder:data:1");
      });

      it("orders rows depth-first so children follow their folder", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({ pid: "meta.1", formatType: "METADATA" }),
            member({
              pid: "data.1",
              formatType: "DATA",
              fileName: "a.csv",
              atLocations: ["/data/a.csv"],
            }),
          ],
        });
        const ids = rows.map((r) => r.id);
        // The folder appears immediately before its child.
        ids.indexOf("folder:data").should.equal(ids.indexOf("data.1") - 1);
      });

      it("orders top-level folders before top-level files", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({ pid: "top.1", formatType: "DATA", fileName: "top.csv" }),
            member({
              pid: "nested.1",
              formatType: "DATA",
              fileName: "nested.csv",
              atLocations: ["/folder/nested.csv"],
            }),
          ],
        });

        rows
          .map((r) => r.id)
          .should.deep.equal(["folder:folder", "nested.1", "top.1"]);
      });

      it("stays flat when no member has a location", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({ pid: "data.1", formatType: "DATA" }),
            member({ pid: "data.2", formatType: "DATA" }),
          ],
        });
        rows.length.should.equal(2);
        rows.every((r) => r.kind !== "folder").should.equal(true);
      });
    });

    describe("dataset framing (packageTitle/packageId)", () => {
      const datasetMembers = () => [
        member({ pid: "rm.1", formatType: "RESOURCE" }),
        member({ pid: "data.1", formatType: "DATA", fileName: "a.csv" }),
        member({ pid: "meta.1", formatType: "METADATA", title: "EML doc" }),
      ];

      it("adds a dataset root row and nests members beneath it", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: datasetMembers(),
          packageId: "resource_map_1",
          packageTitle: "My Dataset",
          packageDownloadUrl: "https://cn.test/packages/resource_map_1",
        });

        const root = rows[0];
        root.id.should.equal("dataset:resource_map_1");
        root.label.should.equal("My Dataset");
        root.kind.should.equal("dataset");
        root.className.should.equal("root-dataset");
        root.isContainer.should.equal(true);
        root.isExpanded.should.equal(true);
        root.actions.map((a) => a.id).should.deep.equal(["download"]);
        root.actions[0].label.should.equal("Download All");

        // Every other row nests under the root.
        rows
          .slice(1)
          .every((r) => r.parentId === root.id)
          .should.equal(true);
      });

      it("keeps a member distinct from a colliding dataset root", () => {
        const memberPid = "dataset:root.rm";
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({ pid: "root.rm", formatType: "RESOURCE" }),
            member({
              pid: memberPid,
              formatType: "DATA",
              fileName: "data.csv",
            }),
          ],
          packageId: "root.rm",
          packageTitle: "Root Dataset",
        });
        const root = rows.find((candidate) =>
          candidate.className.includes("root-dataset"),
        );
        const memberRow = row(rows, memberPid);

        expectUniqueRowIds(rows);
        root.id.should.equal("dataset:root.rm:1");
        memberRow.id.should.equal(memberPid);
        memberRow.parentId.should.equal(root.id);
      });

      it("hides Download All when any package member is confirmed missing", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({ pid: "resource_map_1", formatType: "RESOURCE" }),
            member({
              pid: "data.1",
              formatType: "DATA",
              sysMetaMissing: true,
            }),
          ],
          packageId: "resource_map_1",
          packageTitle: "My Dataset",
          packageDownloadUrl: "https://cn.test/packages/resource_map_1",
        });

        row(rows, "dataset:resource_map_1").actions.should.deep.equal([]);
      });

      it("keeps Download All for unresolved placeholders", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({ pid: "resource_map_1", formatType: "RESOURCE" }),
            member({
              pid: "data.1",
              formatType: "DATA",
              isPlaceHolder_b: true,
            }),
          ],
          packageId: "resource_map_1",
          packageTitle: "My Dataset",
          packageDownloadUrl: "https://cn.test/packages/resource_map_1",
        });

        row(rows, "dataset:resource_map_1")
          .actions.map((action) => action.id)
          .should.deep.equal(["download"]);
      });

      it("hides the resource map and groups metadata first", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: datasetMembers(),
          packageId: "resource_map_1",
          packageTitle: "My Dataset",
        });

        rows.some((r) => r.kind === "resource-map").should.equal(false);
        // Order: root, then metadata, then data.
        rows
          .map((r) => r.id)
          .should.deep.equal(["dataset:resource_map_1", "meta.1", "data.1"]);
        // Nested rows are indented one level below the root.
        row(rows, "meta.1").level.should.equal(1);
      });

      it("orders root children as metadata, nested packages, folders, then files", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({ pid: "root.rm", formatType: "RESOURCE" }),
            member({ pid: "top.1", formatType: "DATA", fileName: "top.csv" }),
            member({
              pid: "foldered.1",
              formatType: "DATA",
              fileName: "foldered.csv",
              atLocations: ["/data/foldered.csv"],
            }),
            member({
              pid: "nested.rm",
              formatType: "DATA",
              formatId: "http://www.openarchives.org/ore/terms",
              title: "Nested Dataset",
            }),
            member({ pid: "meta.1", formatType: "METADATA", title: "EML" }),
          ],
          packageId: "root.rm",
          packageTitle: "Root Dataset",
        });

        rows
          .map((r) => r.id)
          .should.deep.equal([
            "dataset:root.rm",
            "meta.1",
            "nested.rm",
            "folder:data",
            "foldered.1",
            "top.1",
          ]);
        row(rows, "folder:data").isExpanded.should.equal(false);
      });

      it("renders nested resource maps as linked dataset rows", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({ pid: "root.rm", formatType: "RESOURCE" }),
            member({
              pid: "nested.rm",
              formatType: "DATA",
              formatId: "http://www.openarchives.org/ore/terms",
              fileName: "nested.rdf",
              title: "Nested Dataset",
            }),
          ],
          packageId: "root.rm",
          packageTitle: "Root Dataset",
          resolveBaseUrl: "https://cn.test/resolve/",
          packageServiceUrl: "https://cn.test/package/",
        });

        rows.filter((r) => r.id === "dataset:root.rm").should.have.length(1);
        row(rows, "dataset:root.rm").kind.should.equal("dataset");
        const nested = row(rows, "nested.rm");
        nested.label.should.equal("Nested Dataset");
        nested.kind.should.equal("dataset");
        nested.className.should.equal("nested-dataset");
        nested.typeLabel.should.equal("Nested package");
        nested.isContainer.should.equal(false);
        nested.actions
          .map((action) => action.id)
          .should.deep.equal(["open-dataset", "download"]);
        nested.downloadUrl.should.equal("https://cn.test/package/nested.rm");
      });

      it("tooltips the full title on package rows and the full file name on file rows (never the PID)", () => {
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({ pid: "root.rm", formatType: "RESOURCE" }),
            member({
              pid: "nested.rm",
              formatType: "DATA",
              formatId: "http://www.openarchives.org/ore/terms",
              fileName: "nested.rdf",
              title: "Nested Dataset",
            }),
            member({ pid: "data.1", formatType: "DATA", fileName: "a.csv" }),
          ],
          packageId: "root.rm",
          packageTitle: "Root Dataset",
        });

        // Package rows tooltip their full title so it survives truncation.
        row(rows, "dataset:root.rm").titleTooltip.should.equal("Root Dataset");
        row(rows, "nested.rm").titleTooltip.should.equal("Nested Dataset");

        // File rows tooltip the full file name, not the PID.
        row(rows, "data.1").titleTooltip.should.equal("a.csv");
      });

      it("uses Add Files and Share on the editor dataset root row", () => {
        const rows = Adapter.buildRows(null, {
          mode: "editor",
          members: datasetMembers(),
          packageId: "resource_map_1",
          packageTitle: "My Dataset",
        });

        const root = rows[0];
        root.actions.map((a) => a.id).should.deep.equal(["add-files"]);
        root.shareAction.id.should.equal("share");
        root.showShare.should.equal(true);
        root.isRenamable.should.equal(true);
      });

      it("uses Remove only on editor nested package rows", () => {
        const rows = Adapter.buildRows(null, {
          mode: "editor",
          members: [
            member({ pid: "root.rm", formatType: "RESOURCE" }),
            member({
              pid: "nested.rm",
              formatType: "DATA",
              formatId: "http://www.openarchives.org/ore/terms",
              fileName: "nested.rdf",
              title: "Nested Dataset",
            }),
          ],
          packageId: "root.rm",
          packageTitle: "Root Dataset",
        });

        const nested = row(rows, "nested.rm");
        nested.kind.should.equal("dataset");
        nested.className.should.equal("nested-dataset");
        nested.typeLabel.should.equal("Nested package");
        nested.actions.map((a) => a.id).should.deep.equal(["remove"]);
        nested.actions[0].label.should.equal("");
        nested.actions[0].iconClass.should.equal("icon icon-remove");
        expect(nested.shareAction).to.equal(null);
        nested.isRenamable.should.equal(false);
      });

      it("hides Share on the editor dataset root row when sharing is disabled", () => {
        const rows = Adapter.buildRows(null, {
          mode: "editor",
          showShare: false,
          members: datasetMembers(),
          packageId: "resource_map_1",
          packageTitle: "My Dataset",
        });

        const root = rows[0];
        root.showShare.should.equal(false);
        expect(root.shareAction).to.equal(null);
      });

      it("uses an injected friendly format-name resolver for the type label", () => {
        const formatName = (formatId) =>
          formatId === "application/pdf" ? "PDF" : "";
        const [r] = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({
              pid: "data.1",
              formatType: "DATA",
              formatId: "application/pdf",
            }),
          ],
          formatName,
        });
        r.typeLabel.should.equal("PDF");
      });

      it("uses short built-in format labels before object-format names", () => {
        const formatName = (formatId) =>
          formatId === "eml://ecoinformatics.org/eml-2.1.1"
            ? "Ecological Metadata Language, version 2.1.1"
            : "";
        const rows = Adapter.buildRows(null, {
          mode: "viewer",
          members: [
            member({
              pid: "meta.1",
              formatType: "METADATA",
              formatId: "eml://ecoinformatics.org/eml-2.1.1",
            }),
            member({
              pid: "data.1",
              formatType: "DATA",
              formatId: "text/csv",
            }),
          ],
          formatName,
        });

        row(rows, "meta.1").typeLabel.should.equal("EML v2.1.1");
        row(rows, "data.1").typeLabel.should.equal("CSV");
      });

      it("populates metric fields from an injected resolver when showMetrics", () => {
        const getRowMetric = (m, type) =>
          type === "METADATA"
            ? { label: "566", title: "566 views", iconClass: "icon-eye" }
            : null;
        const [r] = Adapter.buildRows(null, {
          mode: "viewer",
          showMetrics: true,
          members: [member({ pid: "meta.1", formatType: "METADATA" })],
          getRowMetric,
        });
        r.showMetrics.should.equal(true);
        r.metricLabel.should.equal("566");
        r.metricTitle.should.equal("566 views");
      });
    });
  });
});
