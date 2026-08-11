define([
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/shared/concurrency-tracker.js",
  "models/dataPackage/DataPackage",
  "models/dataPackage/DataPackageMember",
  "models/dataPackage/DataPackageUploader",
  "models/dataPackage/UploadResult",
  "models/resourceMap/ResourceMapResolver",
  "models/sysmeta/SystemMetadata",
], (
  cleanState,
  trackConcurrency,
  DataPackage,
  DataPackageMember,
  DataPackageUploader,
  UploadResult,
  ResourceMapResolver,
  SystemMetadata,
) => {
  const should = chai.should();
  const { expect } = chai;
  const RESOURCE_MAP_FORMAT_ID = "http://www.openarchives.org/ore/terms";
  const PHASES = {
    DATA: "data",
    METADATA: "metadata",
    SYSTEM_METADATA: "systemMetadata",
    RESOURCE_MAP: "resourceMap",
  };
  const OPERATIONS = {
    CREATE: "create",
    UPDATE: "update",
    UPDATE_SYSTEM_METADATA: "updateSystemMetadata",
  };

  const state = cleanState(() => {
    const sandbox = sinon.createSandbox();
    return { sandbox };
  }, beforeEach);

  afterEach(() => state.sandbox.restore());

  function fakeResourceMap({ hasUnsaved = false, memberPids = [] } = {}) {
    const resourceMap = {
      resourceMapPid: "rm.1",
      unsaved: hasUnsaved,
      memberPids: [...memberPids],
      graphState: {
        getMember: () => null,
        getMemberDescriptors() {
          return resourceMap.memberPids.map((pid) => ({
            pid,
            uri: `https://cn.example/cn/v2/resolve/${pid}`,
          }));
        },
      },
      hasUnsavedChanges() {
        return this.unsaved;
      },
      setDocumentationLinks() {},
      setPackageStructure(pids) {
        this.memberPids = [...pids];
      },
      getMemberPids() {
        return [...this.memberPids];
      },
      setResourceMapPid(pid) {
        this.resourceMapPid = pid;
      },
      replaceMember() {},
      setModified() {},
      normalize() {},
      markSaved() {
        this.saved = true;
        this.unsaved = false;
      },
      serialize() {
        return `<rdf:RDF rdf:about="${this.resourceMapPid}"/>`;
      },
    };
    return resourceMap;
  }

  function systemMetadata(values = {}) {
    return new SystemMetadata({
      identifier: values.identifier || "data.1",
      formatId: values.formatId || "text/csv",
      size: values.size ?? 4,
      checksum: values.checksum || "checksum",
      checksumAlgorithm: values.checksumAlgorithm || "MD5",
      submitter: values.submitter || "uid=test",
      rightsHolder: values.rightsHolder || "uid=test",
      accessPolicy: values.accessPolicy || [],
      replicationPolicy: values.replicationPolicy || null,
      archived: values.archived ?? null,
      fileName: values.fileName || null,
      obsoletes: values.obsoletes || null,
      obsoletedBy: values.obsoletedBy || null,
      dateSysMetadataModified: values.dateSysMetadataModified || null,
    });
  }

  function uploadDefaults() {
    return {
      submitter: "uid=default",
      rightsHolder: "uid=default",
      accessPolicy: [],
    };
  }

  function withActionIds(actions) {
    return actions.map((action) => ({
      ...action,
      id: action.id || `${action.operation}:${action.targetPid}`,
    }));
  }

  async function executeActions(
    pkg,
    rawActions,
    {
      draftRevision = pkg.draftRevision,
      markPackageSaved = true,
      maxConcurrent = 4,
      signal,
      stopOnError = true,
    } = {},
  ) {
    const actions = withActionIds(rawActions);
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    pkg.activeUpload = {
      cancelled: false,
      controller,
    };
    try {
      const result = await pkg._uploader._executeUploadActions(actions, {
        draftRevision,
        markPackageSaved,
        maxConcurrent,
        signal: controller.signal,
        stopOnError,
      });
      return result;
    } finally {
      signal?.removeEventListener("abort", abort);
      pkg.activeUpload = null;
    }
  }

  function makeExecutorPackage({ objectService, sysMetaService } = {}) {
    const dataMember = new DataPackageMember({
      pid: "data.1",
      formatType: "DATA",
      contentDirty: true,
    });
    const rmModel = fakeResourceMap({ memberPids: ["data.1"] });
    const rmMember = new DataPackageMember({
      pid: "rm.2",
      remotePid: "rm.1",
      aggregatedPid: "rm.1",
      formatType: "RESOURCE",
      formatId: RESOURCE_MAP_FORMAT_ID,
      objectModel: rmModel,
    });
    const pkg = new DataPackage({
      members: [dataMember, rmMember],
      objectService: objectService || {
        create: state.sandbox
          .stub()
          .resolves({ data: { identifier: "data.1" } }),
        update: state.sandbox.stub().resolves({ data: { identifier: "rm.2" } }),
      },
      sysMetaService: sysMetaService || {
        invalidate: state.sandbox.stub().resolves(),
      },
      versionTracker: {
        getLatestVersion: state.sandbox.stub().callsFake(async (pid) => pid),
      },
    });
    pkg.rootResourceMapPid = "rm.2";
    return { pkg, dataMember, rmMember, rmModel };
  }

  function dataAndResourceMapActions() {
    return withActionIds([
      {
        phase: PHASES.DATA,
        operation: OPERATIONS.CREATE,
        memberPid: "data.1",
        targetPid: "data.1",
        payload: new Blob(["data"]),
        sysMetaXml: "<sysmeta/>",
      },
      {
        phase: PHASES.RESOURCE_MAP,
        operation: OPERATIONS.UPDATE,
        memberPid: "rm.2",
        sourcePid: "rm.1",
        targetPid: "rm.2",
        payload: new Blob(['<rdf:RDF rdf:about="rm.2"/>']),
        sysMetaXml: "<sysmeta/>",
      },
    ]);
  }

  function makeAccessPolicyPackage({ update, download } = {}) {
    const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
    const dataMember = new DataPackageMember({
      pid: "data.1",
      aggregatedPid: "data.1",
      formatType: "DATA",
      formatId: "text/csv",
      sysMeta: systemMetadata({ accessPolicy: publicPolicy }),
    });
    const rmModel = fakeResourceMap({ memberPids: ["data.1"] });
    const rmMember = new DataPackageMember({
      pid: "rm.1",
      remotePid: "rm.1",
      aggregatedPid: "rm.1",
      formatType: "RESOURCE",
      formatId: RESOURCE_MAP_FORMAT_ID,
      objectModel: rmModel,
    });
    const sysMetaService = {
      download:
        download ||
        state.sandbox
          .stub()
          .resolves(systemMetadata({ accessPolicy: publicPolicy })),
      update: update || state.sandbox.stub().resolves({ data: "" }),
      invalidate: state.sandbox.stub().resolves(),
    };
    const objectService = {
      create: state.sandbox.stub(),
      update: state.sandbox.stub(),
    };
    const pkg = new DataPackage({
      members: [dataMember, rmMember],
      objectService,
      sysMetaService,
      versionTracker: {
        getSysMeta: state.sandbox.stub().callsFake(async (pid) =>
          systemMetadata({
            identifier: pid,
            formatId: pid === "rm.1" ? RESOURCE_MAP_FORMAT_ID : "text/csv",
            accessPolicy: publicPolicy,
          }),
        ),
        getLatestVersion: state.sandbox.stub().callsFake(async (pid) => pid),
      },
      authorizationService: {
        checkAll: state.sandbox
          .stub()
          .callsFake(async (pids) =>
            Object.fromEntries(pids.map((pid) => [pid, true])),
          ),
      },
    });
    pkg.rootResourceMapPid = "rm.1";
    return { pkg, dataMember, rmModel, objectService, sysMetaService };
  }

  function makeSysMetaOnlyPackage(count, { download } = {}) {
    const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
    const dataMembers = Array.from({ length: count }, (_value, index) => {
      const pid = `data.${index + 1}`;
      return new DataPackageMember({
        pid,
        remotePid: pid,
        aggregatedPid: pid,
        formatType: "DATA",
        formatId: "text/csv",
        sysMeta: systemMetadata({ identifier: pid, accessPolicy: [] }),
        sysMetaDirty: true,
        accessPolicyDirty: true,
      });
    });
    const rmMember = new DataPackageMember({
      pid: "rm.1",
      remotePid: "rm.1",
      aggregatedPid: "rm.1",
      formatType: "RESOURCE",
      formatId: RESOURCE_MAP_FORMAT_ID,
      objectModel: fakeResourceMap({
        memberPids: dataMembers.map((member) => member.pid),
      }),
    });
    const downloadStub =
      download ||
      state.sandbox
        .stub()
        .callsFake(async (pid) =>
          systemMetadata({ identifier: pid, accessPolicy: publicPolicy }),
        );
    const pkg = new DataPackage({
      members: [...dataMembers, rmMember],
      sysMetaService: {
        download: downloadStub,
        update: state.sandbox.stub().resolves({ data: "" }),
        invalidate: state.sandbox.stub().resolves(),
      },
      versionTracker: {
        getSysMeta: state.sandbox.stub().callsFake(async (pid) =>
          systemMetadata({
            identifier: pid,
            formatId: pid === "rm.1" ? RESOURCE_MAP_FORMAT_ID : "text/csv",
            accessPolicy: publicPolicy,
          }),
        ),
      },
      authorizationService: {
        checkAll: state.sandbox
          .stub()
          .callsFake(async (pids, action, options = {}) => {
            options.onProgress?.({ completed: 0, total: pids.length });
            pids.forEach((pid, index) => {
              options.onProgress?.({
                action,
                completed: index + 1,
                pid,
                total: pids.length,
              });
            });
            return Object.fromEntries(pids.map((pid) => [pid, true]));
          }),
      },
    });
    pkg.rootResourceMapPid = "rm.1";
    return { pkg, dataMembers, rmMember, download: downloadStub };
  }

  function makePermissionPackage({
    remoteSysMeta = systemMetadata(),
    remoteSysMetaDownloaded = true,
    currentSubject = "uid=test",
    authorized = true,
  } = {}) {
    const member = new DataPackageMember({
      pid: "data.1",
      remotePid: "data.1",
      aggregatedPid: "data.1",
      formatType: "DATA",
      remoteSysMeta,
    });
    member._remoteSysMetaDownloaded = remoteSysMetaDownloaded;
    member._remoteSysMetaParseWarnings = [
      ...(remoteSysMeta.parseWarnings || []),
    ];
    const checkAll = state.sandbox
      .stub()
      .callsFake(async (pids) =>
        Object.fromEntries(pids.map((pid) => [pid, authorized])),
      );
    const pkg = new DataPackage({
      members: [member],
      authorizationService: {
        checkAll,
        getUserKey: state.sandbox.stub().resolves(currentSubject),
      },
    });
    return { pkg, checkAll };
  }

  function permissionAction(permission) {
    return [
      {
        sourcePid: "data.1",
        memberPid: "data.1",
        requiredPermissions: [permission],
      },
    ];
  }

  async function withAppUser(values, callback) {
    const originalMetacatUI = globalThis.MetacatUI;
    globalThis.MetacatUI = {
      ...(originalMetacatUI || {}),
      appUserModel: {
        get: (key) => values[key],
      },
    };

    try {
      return await callback();
    } finally {
      globalThis.MetacatUI = originalMetacatUI;
    }
  }

  /**
   * Run a single write permission check case: build a permission package from
   * the case options, optionally evaluate it as a given app user, and capture
   * whether the local fast path threw or fell back to the server.
   * @param {object} params Case parameters
   * @param {Function} params.makeOpts Returns fresh makePermissionPackage opts
   * @param {string} params.permission The required permission to check
   * @param {object} [params.appUser] App user identity to evaluate under
   * @returns {Promise<{pkg: object, checkAll: object, error: Error|null}>} The
   *   package, its authorization stub, and any error thrown by the check
   */
  async function runPermissionCheck({ makeOpts, permission, appUser }) {
    const { pkg, checkAll } = makePermissionPackage(makeOpts());
    const run = () =>
      pkg._uploader.assertWritePermissions(permissionAction(permission));
    let error = null;
    try {
      await (appUser ? withAppUser(appUser, run) : run());
    } catch (caught) {
      error = caught;
    }
    return { pkg, checkAll, error };
  }

  describe("DataPackage upload preparation", () => {
    it("uses supplied full-save concurrency", async () => {
      const pkg = new DataPackage();
      const prepare = state.sandbox
        .stub(pkg._uploader, "_prepareUploadActions")
        .resolves([]);
      const execute = state.sandbox
        .stub(pkg._uploader, "_executeUploadActions")
        .resolves({ outcome: "done" });

      await pkg.upload({ maxConcurrent: "2" });

      prepare.firstCall.args[0].maxConcurrent.should.equal(2);
      execute.firstCall.args[1].maxConcurrent.should.equal(2);
    });

    it("uses supplied eager-upload concurrency", async () => {
      const member = new DataPackageMember({
        pid: "data.eager",
        formatType: "DATA",
      });
      const pkg = new DataPackage({ members: [member] });
      const prepare = state.sandbox
        .stub(pkg._uploader, "_prepareEagerUploadActions")
        .resolves([]);
      const execute = state.sandbox
        .stub(pkg._uploader, "_executeUploadActions")
        .resolves({ outcome: "done" });

      const [result] = await pkg._uploader.uploadAddedMembers([member], {
        maxConcurrent: "3",
      });

      result.outcome.should.equal("done");
      prepare.firstCall.args[1].maxConcurrent.should.equal(3);
      execute.firstCall.args[1].maxConcurrent.should.equal(3);
    });

    it("saves one private-file System Metadata change without object or ResourceMap writes", async () => {
      const { pkg, dataMember, rmModel, objectService, sysMetaService } =
        makeAccessPolicyPackage();

      await pkg.setMemberAccessPolicy("data.1", []);
      const result = await pkg.upload();

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      result.actions.should.have.lengthOf(1);
      result.actions[0].phase.should.equal(PHASES.SYSTEM_METADATA);
      result.actions[0].operation.should.equal(
        OPERATIONS.UPDATE_SYSTEM_METADATA,
      );
      result.actions[0].requiredPermissions.should.deep.equal([
        "changePermission",
      ]);
      sysMetaService.download.calledOnce.should.equal(true);
      sysMetaService.update.calledOnce.should.equal(true);
      sinon.assert.notCalled(objectService.create);
      sinon.assert.notCalled(objectService.update);
      should.equal(rmModel.saved, undefined);
      dataMember.sysMetaDirty.should.equal(false);
      pkg.hasUnsavedChanges().should.equal(false);
    });

    it("rebases a planned policy onto fresh preflight System Metadata", async () => {
      const staleDate = new Date("2026-07-29T21:09:51.000Z");
      const freshDate = new Date("2026-07-29T21:22:30.457Z");
      const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
      const { pkg, dataMember } = makeAccessPolicyPackage();
      dataMember.remotePid = "data.1";
      dataMember.setSystemMetadata(
        systemMetadata({
          identifier: "data.1",
          rightsHolder: "uid=stale-owner",
          accessPolicy: publicPolicy,
          fileName: "stale-name.txt",
          dateSysMetadataModified: staleDate,
        }),
        { markDirty: false },
      );
      pkg.versionTracker.getSysMeta.callsFake(async (pid) =>
        systemMetadata({
          identifier: pid,
          formatId: pid === "rm.1" ? RESOURCE_MAP_FORMAT_ID : "text/csv",
          rightsHolder: "uid=remote-owner",
          accessPolicy: publicPolicy,
          fileName: pid === "data.1" ? "fresh-name.txt" : null,
          dateSysMetadataModified: freshDate,
        }),
      );

      await pkg.setMemberAccessPolicy("data.1", [], {
        rightsHolder: "uid=planned-owner",
      });
      const actions = await pkg._uploader._prepareUploadActions();
      const outgoing = SystemMetadata.fromXml(actions[0].sysMetaXml);

      outgoing.dateSysMetadataModified
        .getTime()
        .should.equal(freshDate.getTime());
      outgoing.fileName.should.equal("fresh-name.txt");
      outgoing.rightsHolder.should.equal("uid=planned-owner");
      outgoing.accessPolicy.should.have.lengthOf(0);
    });

    it("keeps an explicitly reapplied policy while adopting an unstaged remote owner", async () => {
      const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
      const { pkg, dataMember } = makeAccessPolicyPackage();
      dataMember.remotePid = "data.1";
      dataMember.setSystemMetadata(
        systemMetadata({
          identifier: "data.1",
          rightsHolder: "uid=stale-owner",
          accessPolicy: [],
        }),
        { markDirty: false },
      );
      pkg.versionTracker.getSysMeta.callsFake(async (pid) =>
        systemMetadata({
          identifier: pid,
          formatId: pid === "rm.1" ? RESOURCE_MAP_FORMAT_ID : "text/csv",
          rightsHolder: "uid=remote-owner",
          accessPolicy: publicPolicy,
        }),
      );

      await pkg.setMemberAccessPolicy("data.1", []);
      const actions = await pkg._uploader._prepareUploadActions();
      const outgoing = SystemMetadata.fromXml(actions[0].sysMetaXml);

      outgoing.accessPolicy.should.have.lengthOf(0);
      outgoing.rightsHolder.should.equal("uid=remote-owner");
    });

    it("rebases the root ResourceMap policy onto fresh preflight System Metadata", async () => {
      const staleDate = new Date("2026-07-29T21:09:51.000Z");
      const freshDate = new Date("2026-07-29T21:22:30.457Z");
      const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
      const download = state.sandbox.stub().resolves(
        systemMetadata({
          identifier: "rm.1",
          formatId: RESOURCE_MAP_FORMAT_ID,
          accessPolicy: publicPolicy,
          dateSysMetadataModified: staleDate,
        }),
      );
      const { pkg } = makeAccessPolicyPackage({ download });
      pkg.versionTracker.getSysMeta.callsFake(async (pid) =>
        systemMetadata({
          identifier: pid,
          formatId: pid === "rm.1" ? RESOURCE_MAP_FORMAT_ID : "text/csv",
          accessPolicy: publicPolicy,
          dateSysMetadataModified: freshDate,
        }),
      );

      await pkg.setPackageAccessPolicy([]);
      const actions = await pkg._uploader._prepareUploadActions();
      actions.should.have.lengthOf(1);
      const action = actions.find(({ targetPid }) => targetPid === "rm.1");
      const outgoing = SystemMetadata.fromXml(action.sysMetaXml);

      action.targetPid.should.equal("rm.1");
      action.operation.should.equal(OPERATIONS.UPDATE_SYSTEM_METADATA);
      outgoing.dateSysMetadataModified
        .getTime()
        .should.equal(freshDate.getTime());
      outgoing.accessPolicy.should.have.lengthOf(0);
    });

    it("does not validate unchanged content for a System Metadata-only save", async () => {
      const { pkg, dataMember } = makeAccessPolicyPackage();
      dataMember.validateContent = state.sandbox.stub().throws(new Error("no"));

      await pkg.setMemberAccessPolicy("data.1", []);
      await pkg.upload();

      sinon.assert.notCalled(dataMember.validateContent);
    });

    // A concurrent sysmeta change (e.g. a serialVersion bump) rejects the PUT
    // with a non-ambiguous 4xx: the action must surface as a retryable
    // failure, not as success or an unresolved ambiguous write.
    it("marks a rejected System Metadata-only update failed and retryable", async () => {
      const conflict = Object.assign(new Error("serialVersion mismatch"), {
        status: 409,
      });
      const { pkg, dataMember, sysMetaService } = makeAccessPolicyPackage({
        update: state.sandbox.stub().rejects(conflict),
      });

      await pkg.setMemberAccessPolicy("data.1", []);
      const result = await pkg.upload();

      result.outcome.should.equal(UploadResult.Outcomes.PARTIAL_FAILURE);
      result.retryable.should.equal(true);
      result
        .getStatus(result.actions[0].id)
        .should.equal(UploadResult.Statuses.FAILED);
      result.getError(result.actions[0].id).should.equal(conflict);
      dataMember.remoteState.should.equal(DataPackageMember.RemoteState.FAILED);
      sysMetaService.update.calledOnce.should.equal(true);
    });

    it("reprepares a rejected System Metadata update before retrying", async () => {
      const initialDate = new Date("2026-07-29T21:09:51.000Z");
      const currentDate = new Date("2026-07-29T21:22:30.457Z");
      const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
      let remoteDate = initialDate;
      const submissions = [];
      const conflict = Object.assign(new Error("modification date mismatch"), {
        status: 409,
      });
      const update = state.sandbox.stub().callsFake(async (_pid, xml) => {
        const submitted = SystemMetadata.fromXml(xml);
        submissions.push(submitted);
        if (update.callCount === 1) {
          remoteDate = currentDate;
        }
        if (
          submitted.dateSysMetadataModified.getTime() !== remoteDate.getTime()
        ) {
          throw conflict;
        }
        return { data: "" };
      });
      const { pkg, dataMember } = makeAccessPolicyPackage({ update });
      dataMember.remotePid = "data.1";
      dataMember.setSystemMetadata(
        systemMetadata({
          identifier: "data.1",
          accessPolicy: publicPolicy,
          dateSysMetadataModified: initialDate,
        }),
        { markDirty: false },
      );
      pkg.versionTracker.getSysMeta.callsFake(async (pid) =>
        systemMetadata({
          identifier: pid,
          formatId: pid === "rm.1" ? RESOURCE_MAP_FORMAT_ID : "text/csv",
          accessPolicy: publicPolicy,
          dateSysMetadataModified: remoteDate,
        }),
      );

      await pkg.setMemberAccessPolicy("data.1", []);
      const first = await pkg.upload();
      const second = await pkg.retryUpload(first);

      first.outcome.should.equal(UploadResult.Outcomes.PARTIAL_FAILURE);
      second.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      update.calledTwice.should.equal(true);
      submissions[1].accessPolicy.should.have.lengthOf(0);
    });

    it("rejects a System Metadata-only save when the package shell is obsolete", async () => {
      const { pkg, sysMetaService } = makeAccessPolicyPackage();
      pkg.members.add(
        new DataPackageMember({
          pid: "metadata.1",
          remotePid: "metadata.1",
          aggregatedPid: "metadata.1",
          formatType: "METADATA",
        }),
      );
      pkg.versionTracker.getSysMeta.callsFake(async (pid) => ({
        identifier: pid,
        obsoletedBy: pid === "metadata.1" ? "metadata.2" : null,
      }));

      await pkg.setMemberAccessPolicy("data.1", []);
      let caught;
      try {
        await pkg.upload();
      } catch (error) {
        caught = error;
      }

      caught.code.should.equal("stale_remote");
      caught.pid.should.equal("metadata.1");
      caught.latestPid.should.equal("metadata.2");
      sinon.assert.notCalled(sysMetaService.update);
    });

    it("builds only a ResourceMap action for graph-only work", async () => {
      const dataMember = new DataPackageMember({
        pid: "data.1",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
      });
      const rmModel = fakeResourceMap({
        hasUnsaved: true,
        memberPids: ["data.1"],
      });
      const rmMember = new DataPackageMember({
        pid: "rm.2",
        remotePid: "rm.1",
        aggregatedPid: "rm.1",
        formatType: "RESOURCE",
        formatId: RESOURCE_MAP_FORMAT_ID,
        objectModel: rmModel,
      });
      const pkg = new DataPackage({
        members: [dataMember, rmMember],
        sysMetaService: {
          download: state.sandbox.stub().resolves(
            systemMetadata({
              identifier: "rm.1",
              formatId: RESOURCE_MAP_FORMAT_ID,
            }),
          ),
        },
        versionTracker: {
          getSysMeta: state.sandbox.stub().callsFake(async (pid) =>
            systemMetadata({
              identifier: pid,
              formatId: RESOURCE_MAP_FORMAT_ID,
            }),
          ),
        },
        authorizationService: {
          checkAll: state.sandbox.stub().resolves({ "rm.1": true }),
        },
      });
      pkg.rootResourceMapPid = "rm.2";

      const actions = await pkg._uploader._prepareUploadActions({
        resourceMapOnly: true,
      });

      actions.should.have.lengthOf(1);
      actions[0].phase.should.equal(PHASES.RESOURCE_MAP);
      actions[0].operation.should.equal(OPERATIONS.UPDATE);
    });

    it("builds retargeted replacement actions from the replacement source PID", async () => {
      const member = new DataPackageMember({
        pid: "data.3",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        formatId: "text/csv",
        fileName: "stale.csv",
        uploadFile: new Blob(["replacement"], { type: "text/csv" }),
        contentDirty: true,
      });
      member._replacementSourcePid = "data.2";
      member._replacementSourceSysMeta = systemMetadata({
        identifier: "data.2",
        submitter: "uid=submitter",
        rightsHolder: "uid=new-owner",
      });

      const action = await DataPackageUploader.buildMemberAction(member, {
        submitter: "uid=default",
        rightsHolder: "uid=default",
      });

      action.operation.should.equal(OPERATIONS.UPDATE);
      action.sourcePid.should.equal("data.2");
      action.targetPid.should.equal("data.3");
      member.sysMeta.obsoletes.should.equal("data.2");
      member.sysMeta.rightsHolder.should.equal("uid=new-owner");
    });

    it("preserves fresh remote mutable fields in content-version actions", async () => {
      const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
      const stale = systemMetadata({
        identifier: "data.1",
        rightsHolder: "uid=stale-owner",
        accessPolicy: [],
        replicationPolicy: { numberReplicas: 1 },
        archived: false,
        fileName: "stale.csv",
      });
      const member = new DataPackageMember({
        pid: "data.2",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        formatId: "text/csv",
        fileName: "stale.csv",
        uploadFile: new Blob(["replacement"], { type: "text/csv" }),
        contentDirty: true,
        sysMeta: stale,
        remoteSysMeta: stale,
      });
      const fresh = systemMetadata({
        identifier: "data.1",
        rightsHolder: "uid=fresh-owner",
        accessPolicy: publicPolicy,
        replicationPolicy: { numberReplicas: 3 },
        archived: true,
        fileName: "fresh.csv",
      });

      const pkg = new DataPackage({ members: [member] });
      const [action] = await pkg._uploader.buildUploadActions(
        [member],
        uploadDefaults(),
        { freshSysMetaByPid: new Map([["data.1", fresh]]) },
      );
      const outgoing = SystemMetadata.fromXml(action.sysMetaXml);

      outgoing.rightsHolder.should.equal("uid=fresh-owner");
      outgoing.accessPolicy
        .toJSON()
        .should.deep.equal([{ subjects: ["public"], permissions: ["read"] }]);
      outgoing.replicationPolicy.numberReplicas.should.equal(3);
      outgoing.archived.should.equal(true);
      outgoing.fileName.should.equal("fresh.csv");
      member.fileName.should.equal("fresh.csv");
    });

    it("keeps explicit local mutable edits over fresh content-version fields", async () => {
      const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
      const baseline = systemMetadata({
        identifier: "data.1",
        rightsHolder: "uid=old-owner",
        accessPolicy: publicPolicy,
      });
      const desired = baseline.clone();
      desired.rightsHolder = "uid=planned-owner";
      desired.accessPolicy.clear();
      const member = new DataPackageMember({
        pid: "data.2",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["replacement"], { type: "text/csv" }),
        contentDirty: true,
        sysMeta: desired,
        remoteSysMeta: baseline,
        sysMetaDirty: true,
        accessPolicyDirty: true,
      });
      const fresh = systemMetadata({
        identifier: "data.1",
        rightsHolder: "uid=remote-owner",
        accessPolicy: publicPolicy,
        fileName: "fresh.csv",
      });

      const pkg = new DataPackage({ members: [member] });
      const [action] = await pkg._uploader.buildUploadActions(
        [member],
        uploadDefaults(),
        { freshSysMetaByPid: new Map([["data.1", fresh]]) },
      );
      const outgoing = SystemMetadata.fromXml(action.sysMetaXml);

      outgoing.rightsHolder.should.equal("uid=planned-owner");
      outgoing.accessPolicy.should.have.lengthOf(0);
      outgoing.fileName.should.equal("fresh.csv");
    });

    it("uses fresh replacement-source metadata instead of the member remote PID", async () => {
      const member = new DataPackageMember({
        pid: "data.3",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["replacement"], { type: "text/csv" }),
        contentDirty: true,
        sysMeta: systemMetadata({
          identifier: "data.1",
          rightsHolder: "uid=original-owner",
        }),
        remoteSysMeta: systemMetadata({
          identifier: "data.1",
          rightsHolder: "uid=original-owner",
        }),
      });
      member._replacementSourcePid = "data.2";
      member._replacementSourceSysMeta = systemMetadata({
        identifier: "data.2",
        rightsHolder: "uid=stale-replacement-owner",
      });
      const pkg = new DataPackage({ members: [member] });
      state.sandbox.stub(pkg, "_ensureSystemMetadata").resolves();
      const freshSysMetaByPid = new Map([
        [
          "data.1",
          systemMetadata({
            identifier: "data.1",
            rightsHolder: "uid=wrong-source-owner",
          }),
        ],
        [
          "data.2",
          systemMetadata({
            identifier: "data.2",
            rightsHolder: "uid=fresh-replacement-owner",
            accessPolicy: [{ subjects: ["public"], permissions: ["read"] }],
            fileName: "fresh-v1.csv",
          }),
        ],
      ]);

      const [action] = await pkg._uploader.buildUploadActions(
        [member],
        uploadDefaults(),
        { freshSysMetaByPid },
      );
      const outgoing = SystemMetadata.fromXml(action.sysMetaXml);

      action.sourcePid.should.equal("data.2");
      outgoing.rightsHolder.should.equal("uid=fresh-replacement-owner");
      outgoing.obsoletes.should.equal("data.2");
      member.remoteSysMeta.identifier.should.equal("data.1");
      member._replacementSourceSysMeta.identifier.should.equal("data.2");
      member._replacementSourceSysMeta.rightsHolder.should.equal(
        "uid=fresh-replacement-owner",
      );

      const desired = member.sysMeta.clone();
      desired.rightsHolder = "uid=planned-owner";
      member.setSystemMetadata(desired);
      const newerFresh = systemMetadata({
        identifier: "data.2",
        rightsHolder: "uid=newer-remote-owner",
        accessPolicy: [],
        fileName: "fresh-v2.csv",
      });
      const [nextAction] = await pkg._uploader.buildUploadActions(
        [member],
        uploadDefaults(),
        { freshSysMetaByPid: new Map([["data.2", newerFresh]]) },
      );
      const nextOutgoing = SystemMetadata.fromXml(nextAction.sysMetaXml);

      nextOutgoing.rightsHolder.should.equal("uid=planned-owner");
      nextOutgoing.accessPolicy.should.have.lengthOf(0);
      nextOutgoing.fileName.should.equal("fresh-v2.csv");
      member.remoteSysMeta.identifier.should.equal("data.1");
      member.remoteSysMeta.rightsHolder.should.equal("uid=original-owner");
    });

    it("prepares eager replacements from fresh replacement-source metadata", async () => {
      const member = new DataPackageMember({
        pid: "data.3",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["replacement"], { type: "text/csv" }),
        contentDirty: true,
        sysMeta: systemMetadata({
          identifier: "data.1",
          rightsHolder: "uid=original-owner",
        }),
        remoteSysMeta: systemMetadata({
          identifier: "data.1",
          rightsHolder: "uid=original-owner",
        }),
      });
      member._replacementSourcePid = "data.2";
      member._replacementSourceSysMeta = systemMetadata({
        identifier: "data.2",
        rightsHolder: "uid=stale-replacement-owner",
      });
      const getSysMeta = state.sandbox.stub().resolves(
        systemMetadata({
          identifier: "data.2",
          rightsHolder: "uid=fresh-replacement-owner",
          fileName: "fresh.csv",
        }),
      );
      const pkg = new DataPackage({
        members: [member],
        versionTracker: { getSysMeta },
        uploadDefaults: uploadDefaults(),
      });

      const [action] = await pkg._uploader._prepareEagerUploadActions([member]);
      const outgoing = SystemMetadata.fromXml(action.sysMetaXml);

      sinon.assert.calledOnceWithExactly(getSysMeta, "data.2", {
        useCache: false,
        signal: undefined,
      });
      outgoing.rightsHolder.should.equal("uid=fresh-replacement-owner");
      outgoing.fileName.should.equal("fresh.csv");
      member.remoteSysMeta.identifier.should.equal("data.1");
      member.remoteSysMeta.rightsHolder.should.equal("uid=original-owner");
    });

    it("preserves fresh remote mutable fields in ResourceMap content updates", async () => {
      const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
      const rmModel = fakeResourceMap({
        hasUnsaved: true,
        memberPids: ["data.1"],
      });
      const stale = systemMetadata({
        identifier: "rm.1",
        formatId: RESOURCE_MAP_FORMAT_ID,
        rightsHolder: "uid=stale-owner",
        accessPolicy: [],
      });
      const rmMember = new DataPackageMember({
        pid: "rm.1",
        remotePid: "rm.1",
        aggregatedPid: "rm.1",
        formatType: "RESOURCE",
        formatId: RESOURCE_MAP_FORMAT_ID,
        fileName: "stale-map.rdf.xml",
        objectModel: rmModel,
        sysMeta: stale,
        remoteSysMeta: stale,
      });
      const pkg = new DataPackage({ members: [rmMember] });
      pkg.rootResourceMapPid = "rm.1";
      const fresh = systemMetadata({
        identifier: "rm.1",
        formatId: RESOURCE_MAP_FORMAT_ID,
        rightsHolder: "uid=fresh-owner",
        accessPolicy: publicPolicy,
        fileName: "fresh-map.rdf.xml",
      });

      const action = await pkg._uploader.prepareResourceMapAction(
        [],
        uploadDefaults(),
        { freshSysMetaByPid: new Map([["rm.1", fresh]]) },
      );
      const outgoing = SystemMetadata.fromXml(action.sysMetaXml);

      outgoing.rightsHolder.should.equal("uid=fresh-owner");
      outgoing.accessPolicy
        .toJSON()
        .should.deep.equal([{ subjects: ["public"], permissions: ["read"] }]);
      outgoing.fileName.should.equal("fresh-map.rdf.xml");
      action.fileName.should.equal("fresh-map.rdf.xml");
    });

    it("rejects ResourceMap-only preparation with member changes", async () => {
      const { pkg } = makeExecutorPackage();
      let caught;
      try {
        await pkg._uploader._prepareUploadActions({ resourceMapOnly: true });
      } catch (error) {
        caught = error;
      }
      caught.message.should.match(/pending member changes/);
    });

    it("bounds source-version preflight checks", async () => {
      const concurrency = trackConcurrency();
      const dataMembers = ["data.1", "data.2", "data.3"].map(
        (pid) =>
          new DataPackageMember({
            pid,
            remotePid: pid,
            aggregatedPid: pid,
            formatType: "DATA",
            contentDirty: true,
          }),
      );
      const rmMember = new DataPackageMember({
        pid: "rm.1",
        remotePid: "rm.1",
        aggregatedPid: "rm.1",
        formatType: "RESOURCE",
        formatId: RESOURCE_MAP_FORMAT_ID,
        objectModel: fakeResourceMap({ memberPids: ["data.1"] }),
      });
      const pkg = new DataPackage({
        members: [...dataMembers, rmMember],
        versionTracker: {
          getSysMeta: state.sandbox
            .stub()
            .callsFake(concurrency.track((pid) => ({ identifier: pid }))),
        },
      });
      pkg.rootResourceMapPid = "rm.1";

      await pkg._uploader.assertSourcesAreLatest(dataMembers, {
        maxConcurrent: 2,
      });

      concurrency.max.should.equal(2);
    });

    it("checks retargeted replacement sources before eager object uploads", async () => {
      const member = new DataPackageMember({
        pid: "data.3",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["replacement"], { type: "text/csv" }),
        contentDirty: true,
      });
      member._replacementSourcePid = "data.2";
      const objectService = {
        create: state.sandbox.stub(),
        update: state.sandbox.stub(),
      };
      const getSysMeta = state.sandbox.stub().callsFake(async (pid) =>
        systemMetadata({
          identifier: pid,
          obsoletedBy: pid === "data.2" ? "data.latest" : null,
        }),
      );
      const pkg = new DataPackage({
        members: [member],
        objectService,
        sysMetaService: {
          download: state.sandbox
            .stub()
            .resolves(systemMetadata({ identifier: "data.1" })),
          invalidate: state.sandbox.stub().resolves(),
        },
        versionTracker: { getSysMeta },
        authorizationService: {
          checkAll: state.sandbox.stub().resolves({ "data.2": true }),
        },
      });

      const [result] = await pkg._uploader.uploadAddedMembers([member]);

      result.outcome.should.equal(UploadResult.Outcomes.STALE_REMOTE);
      result.getError("update:data.3").pid.should.equal("data.2");
      result.getError("update:data.3").latestPid.should.equal("data.latest");
      sinon.assert.calledWith(getSysMeta, "data.2");
      sinon.assert.neverCalledWith(getSysMeta, "data.1");
      sinon.assert.notCalled(objectService.update);
      sinon.assert.notCalled(objectService.create);
    });

    it("loads many sysmeta-only baselines in one grouped preparation pass", async () => {
      const { pkg, dataMembers, download } = makeSysMetaOnlyPackage(119);
      const ensure = state.sandbox.spy(pkg, "_ensureSystemMetadata");

      const actions = await pkg._uploader.buildUploadActions(
        dataMembers,
        pkg._uploader.buildSysMetaDefaults(),
        { maxConcurrent: 4 },
      );

      sinon.assert.calledOnce(ensure);
      ensure.firstCall.args[0].should.have.lengthOf(119);
      download.callCount.should.equal(119);
      actions.should.have.lengthOf(119);
      actions
        .every(
          (action) => action.operation === OPERATIONS.UPDATE_SYSTEM_METADATA,
        )
        .should.equal(true);
    });

    it("bounds missing sysmeta downloads and reports prep progress", async () => {
      const concurrency = trackConcurrency();
      const download = state.sandbox
        .stub()
        .callsFake(
          concurrency.track((pid) => systemMetadata({ identifier: pid })),
        );
      const { pkg, dataMembers } = makeSysMetaOnlyPackage(5, { download });
      const progress = [];

      await pkg._ensureSystemMetadata(dataMembers, {
        maxConcurrent: 2,
        onProgress: (event) => progress.push(event),
      });

      concurrency.max.should.equal(2);
      progress[0].should.deep.equal({ completed: 0, total: 5 });
      progress[progress.length - 1].should.deep.equal({
        completed: 5,
        total: 5,
      });
      progress
        .map((event) => event.completed)
        .should.deep.equal([0, 1, 2, 3, 4, 5]);
    });

    it("emits preparation progress phases before upload action execution", async () => {
      const { pkg } = makeSysMetaOnlyPackage(3);
      const progress = [];
      pkg.events.on("upload:prepare:progress", (event) => progress.push(event));

      const actions = await pkg._uploader._prepareUploadActions({
        maxConcurrent: 2,
      });

      actions.should.have.lengthOf(3);
      progress
        .map((event) => event.phase)
        .should.include.members([
          "checkingLatest",
          "buildingActions",
          "checkingPermissions",
          "prepared",
        ]);
      const latestProgress = progress.filter(
        (event) => event.phase === "checkingLatest",
      );
      latestProgress[0].should.include({ completed: 0, total: 4 });
      latestProgress[0].message.should.match(/\b0\s*\/\s*4\b/);
      const lastLatest = latestProgress[latestProgress.length - 1];
      lastLatest.should.include({ completed: 4, total: 4 });
      lastLatest.message.should.match(/\b4\s*\/\s*4\b/);
      progress[progress.length - 1].should.include({
        phase: "prepared",
        completed: 3,
        total: 3,
      });
    });

    it("persists recovery records before starting upload execution", async () => {
      const { pkg } = makeExecutorPackage();
      const actions = dataAndResourceMapActions();
      const progress = [];
      const recoveryStore = {
        save: state.sandbox.stub().resolves({}),
        remove: state.sandbox.stub().resolves(),
      };
      state.sandbox
        .stub(pkg._uploader, "_prepareUploadActions")
        .resolves(actions);
      const execute = state.sandbox
        .stub(pkg._uploader, "_executeUploadActions")
        .resolves({ outcome: "done" });
      state.sandbox
        .stub(pkg, "getPrimaryMetadataMember")
        .returns({ pid: "meta.1" });
      pkg.uploadRecoveryStore = recoveryStore;
      pkg.events.on("upload:prepare:progress", (event) => progress.push(event));

      const result = await pkg.upload();

      result.outcome.should.equal("done");
      recoveryStore.save.calledBefore(execute).should.equal(true);
      const resourceMapAction = actions.find(
        ({ phase }) => phase === PHASES.RESOURCE_MAP,
      );
      recoveryStore.save.firstCall.args[1].rmSysMetaXml.should.equal(
        resourceMapAction.sysMetaXml,
      );
      progress.map((event) => event.phase).should.deep.equal(["ready"]);
      progress[0].message.should.equal("Starting upload...");
    });

    // Cases where the local policy fast path can authorize the write itself and
    // must never reach the server (`checkAll`).
    const LOCAL_GRANT_CASES = [
      {
        name: "the current subject is the rightsHolder",
        permission: "changePermission",
        makeOpts: () => ({
          remoteSysMeta: systemMetadata({
            rightsHolder: "uid=test",
            accessPolicy: [],
          }),
        }),
      },
      {
        name: "an exact subject policy grant",
        permission: "write",
        makeOpts: () => ({
          remoteSysMeta: systemMetadata({
            rightsHolder: "uid=other",
            accessPolicy: [{ subjects: ["uid=test"], permissions: ["write"] }],
          }),
        }),
      },
      {
        name: "an equivalent identity policy grant",
        permission: "write",
        appUser: {
          username: "uid=test",
          identitiesUsernames: ["uid=alternate"],
          isMemberOf: [],
        },
        makeOpts: () => ({
          remoteSysMeta: systemMetadata({
            rightsHolder: "uid=other",
            accessPolicy: [
              { subjects: ["uid=alternate"], permissions: ["write"] },
            ],
          }),
        }),
      },
      {
        name: "a group policy grant",
        permission: "write",
        appUser: {
          username: "uid=test",
          identitiesUsernames: [],
          isMemberOf: [{ groupId: "CN=editors,DC=dataone,DC=org" }],
        },
        makeOpts: () => ({
          remoteSysMeta: systemMetadata({
            rightsHolder: "uid=other",
            accessPolicy: [
              {
                subjects: ["CN=editors,DC=dataone,DC=org"],
                permissions: ["write"],
              },
            ],
          }),
        }),
      },
      {
        name: "an equivalent identity is the rightsHolder",
        permission: "write",
        appUser: {
          username: "uid=test",
          identitiesUsernames: ["uid=alternate"],
          isMemberOf: [],
        },
        makeOpts: () => ({
          remoteSysMeta: systemMetadata({
            rightsHolder: "uid=alternate",
            accessPolicy: [],
          }),
        }),
      },
      {
        name: "an explicit public policy grant",
        permission: "write",
        makeOpts: () => ({
          currentSubject: "public",
          remoteSysMeta: systemMetadata({
            rightsHolder: "uid=other",
            accessPolicy: [{ subjects: ["public"], permissions: ["write"] }],
          }),
        }),
      },
    ];

    LOCAL_GRANT_CASES.forEach(({ name, permission, appUser, makeOpts }) => {
      it(`skips server authorization for ${name}`, async () => {
        const { checkAll, error } = await runPermissionCheck({
          makeOpts,
          permission,
          appUser,
        });

        expect(error).to.equal(null);
        sinon.assert.notCalled(checkAll);
      });
    });

    it("uses identities loaded while resolving the current subject", async () => {
      const { pkg, checkAll } = makePermissionPackage({
        authorized: false,
        remoteSysMeta: systemMetadata({
          rightsHolder: "uid=other",
          accessPolicy: [
            { subjects: ["uid=alternate"], permissions: ["write"] },
          ],
        }),
      });
      const originalMetacatUI = globalThis.MetacatUI;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appUserModel: null,
      };
      pkg.getAuthorizationService().getUserKey.callsFake(async () => {
        globalThis.MetacatUI.appUserModel = {
          get: (key) =>
            ({
              username: "uid=test",
              identities: [],
              identitiesUsernames: ["uid=alternate"],
              allIdentitiesAndGroups: [],
              isMemberOf: [],
            })[key],
        };
        return "uid=test";
      });

      try {
        await pkg._uploader.assertWritePermissions(permissionAction("write"));
      } finally {
        globalThis.MetacatUI = originalMetacatUI;
      }

      sinon.assert.notCalled(checkAll);
    });

    it("falls back to server authorization when local policy is uncertain", async () => {
      const { pkg, checkAll } = makePermissionPackage({
        authorized: false,
        remoteSysMeta: systemMetadata({
          rightsHolder: "uid=other",
          accessPolicy: [{ subjects: ["public"], permissions: ["read"] }],
        }),
      });

      let caught;
      try {
        await pkg._uploader.assertWritePermissions(
          permissionAction("changePermission"),
        );
      } catch (error) {
        caught = error;
      }

      caught.code.should.equal("unauthorized");
      sinon.assert.calledOnce(checkAll);
      checkAll.firstCall.args[0].should.deep.equal(["data.1"]);
      checkAll.firstCall.args[1].should.equal("changePermission");
    });

    it("deduplicates each source PID within a permission group", async () => {
      const { pkg, checkAll } = makePermissionPackage({
        remoteSysMetaDownloaded: false,
      });
      const [writeAction] = permissionAction("write");

      await pkg._uploader.assertWritePermissions([
        writeAction,
        { ...writeAction },
        { ...writeAction, requiredPermissions: ["changePermission"] },
        { memberPid: "new.1", requiredPermissions: ["write"] },
      ]);

      sinon.assert.callCount(checkAll, 2);
      checkAll.firstCall.args[0].should.deep.equal(["data.1"]);
      checkAll.firstCall.args[1].should.equal("write");
      checkAll.secondCall.args[0].should.deep.equal(["data.1"]);
      checkAll.secondCall.args[1].should.equal("changePermission");
    });

    // Cases where local policy cannot decide and the check must defer to the
    // server (`checkAll`).
    const SERVER_FALLBACK_CASES = [
      {
        name: "without fresh remote sysmeta",
        permission: "write",
        makeOpts: () => ({
          remoteSysMetaDownloaded: false,
          remoteSysMeta: systemMetadata({
            rightsHolder: "uid=test",
            accessPolicy: [],
          }),
        }),
      },
      {
        name: "when remote sysmeta had parse warnings",
        permission: "write",
        makeOpts: () => {
          const remoteSysMeta = systemMetadata({
            rightsHolder: "uid=test",
            accessPolicy: [],
          });
          remoteSysMeta.parseWarnings = [{ field: "accessPolicy" }];
          return { remoteSysMeta };
        },
      },
    ];

    SERVER_FALLBACK_CASES.forEach(({ name, permission, makeOpts }) => {
      it(`falls back to server authorization ${name}`, async () => {
        const { checkAll, error } = await runPermissionCheck({
          makeOpts,
          permission,
        });

        expect(error).to.equal(null);
        sinon.assert.calledOnce(checkAll);
      });
    });
  });

  describe("DataPackage upload execution", () => {
    function addStablePackageShell(pkg) {
      const metadataMember = new DataPackageMember({
        pid: "metadata.2",
        remotePid: "metadata.2",
        aggregatedPid: "metadata.2",
        formatType: "METADATA",
      });
      pkg.members.add(metadataMember);
      pkg.primaryMetadataPid = metadataMember.pid;
      return metadataMember;
    }

    it("runs fixed phases in order and promotes aggregation after ResourceMap success", async () => {
      const calls = [];
      const objectService = {
        create: state.sandbox.stub().callsFake(async ({ pid }) => {
          calls.push(`create:${pid}`);
          return { data: { identifier: pid } };
        }),
        update: state.sandbox.stub().callsFake(async ({ newPid }) => {
          calls.push(`update:${newPid}`);
          return { data: { identifier: newPid } };
        }),
      };
      const { pkg, dataMember, rmMember, rmModel } = makeExecutorPackage({
        objectService,
      });

      const result = await executeActions(pkg, dataAndResourceMapActions());

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      calls.should.deep.equal(["create:data.1", "update:rm.2"]);
      dataMember.aggregatedPid.should.equal("data.1");
      rmMember.aggregatedPid.should.equal("rm.2");
      rmModel.saved.should.equal(true);
    });

    it("records the metadata to ResourceMap cache after ResourceMap success", async () => {
      const addToStorage = state.sandbox
        .stub(ResourceMapResolver.prototype, "addToStorage")
        .resolves("rm.2");
      const metadataMember = new DataPackageMember({
        pid: "metadata.2",
        remotePid: "metadata.2",
        aggregatedPid: "metadata.2",
        formatType: "METADATA",
      });
      const rmMember = new DataPackageMember({
        pid: "rm.2",
        remotePid: "rm.1",
        aggregatedPid: "rm.1",
        formatType: "RESOURCE",
        formatId: RESOURCE_MAP_FORMAT_ID,
        objectModel: fakeResourceMap({ memberPids: ["metadata.2"] }),
      });
      const resolverStorage = {};
      const pkg = new DataPackage({
        members: [metadataMember, rmMember],
        objectService: {
          update: state.sandbox
            .stub()
            .resolves({ data: { identifier: "rm.2" } }),
        },
        sysMetaService: {
          invalidate: state.sandbox.stub().resolves(),
        },
        versionTracker: {
          getLatestVersion: state.sandbox.stub().callsFake(async (pid) => pid),
        },
        resolverOptions: { storage: resolverStorage },
      });
      pkg.rootResourceMapPid = "rm.2";
      const removeRecovery = state.sandbox.stub().resolves();
      pkg.uploadRecoveryStore = { remove: removeRecovery };

      const result = await executeActions(pkg, [
        {
          phase: PHASES.RESOURCE_MAP,
          operation: OPERATIONS.UPDATE,
          memberPid: "rm.2",
          sourcePid: "rm.1",
          targetPid: "rm.2",
          payload: new Blob(['<rdf:RDF rdf:about="rm.2"/>']),
          sysMetaXml: "<sysmeta/>",
        },
      ]);

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      sinon.assert.calledOnceWithExactly(addToStorage, "metadata.2", "rm.2");
      addToStorage.firstCall.thisValue.storage.should.equal(resolverStorage);
      sinon.assert.calledOnceWithExactly(removeRecovery, "metadata.2");
    });

    it("uses the primary metadata action for ResourceMap commit effects", async () => {
      const addToStorage = state.sandbox
        .stub(ResourceMapResolver.prototype, "addToStorage")
        .resolves("rm.2");
      const primary = new DataPackageMember({
        pid: "metadata.2",
        remotePid: "metadata.1",
        aggregatedPid: "metadata.1",
        formatType: "METADATA",
        contentDirty: true,
      });
      const nested = new DataPackageMember({
        pid: "nested.2",
        remotePid: "nested.1",
        aggregatedPid: "nested.1",
        formatType: "METADATA",
        contentDirty: true,
      });
      const rmMember = new DataPackageMember({
        pid: "rm.2",
        remotePid: "rm.1",
        aggregatedPid: "rm.1",
        formatType: "RESOURCE",
        formatId: RESOURCE_MAP_FORMAT_ID,
        objectModel: fakeResourceMap({
          memberPids: ["metadata.2", "nested.2"],
        }),
      });
      const objectService = {
        create: state.sandbox.stub(),
        update: state.sandbox.stub().callsFake(async ({ newPid }) => ({
          data: { identifier: newPid },
        })),
      };
      const pkg = new DataPackage({
        members: [primary, nested, rmMember],
        primaryMetadataPid: "metadata.2",
        objectService,
        sysMetaService: { invalidate: state.sandbox.stub().resolves() },
        versionTracker: {
          getLatestVersion: state.sandbox.stub().callsFake(async (pid) => pid),
        },
      });
      pkg.rootResourceMapPid = "rm.2";
      const removeRecovery = state.sandbox.stub().resolves();
      pkg.uploadRecoveryStore = { remove: removeRecovery };

      const result = await executeActions(pkg, [
        {
          phase: PHASES.METADATA,
          operation: OPERATIONS.UPDATE,
          memberPid: "nested.2",
          sourcePid: "nested.1",
          targetPid: "nested.2",
          payload: new Blob(["nested"]),
          sysMetaXml: "<nested-sysmeta/>",
        },
        {
          phase: PHASES.METADATA,
          operation: OPERATIONS.UPDATE,
          memberPid: "metadata.2",
          sourcePid: "metadata.1",
          targetPid: "metadata.2",
          payload: new Blob(["primary"]),
          sysMetaXml: "<primary-sysmeta/>",
        },
        {
          phase: PHASES.RESOURCE_MAP,
          operation: OPERATIONS.UPDATE,
          memberPid: "rm.2",
          sourcePid: "rm.1",
          targetPid: "rm.2",
          payload: new Blob(['<rdf:RDF rdf:about="rm.2"/>']),
          sysMetaXml: "<rm-sysmeta/>",
        },
      ]);

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      sinon.assert.calledOnceWithExactly(addToStorage, "metadata.2", "rm.2");
      sinon.assert.calledOnceWithExactly(removeRecovery, "metadata.2");
    });

    it("does not commit ResourceMap effects after eager data-only success", async () => {
      const addToStorage = state.sandbox
        .stub(ResourceMapResolver.prototype, "addToStorage")
        .resolves();
      const { pkg } = makeExecutorPackage();
      addStablePackageShell(pkg);
      const removeRecovery = state.sandbox.stub().resolves();
      pkg.uploadRecoveryStore = { remove: removeRecovery };

      const result = await executeActions(
        pkg,
        [
          {
            phase: PHASES.DATA,
            operation: OPERATIONS.CREATE,
            memberPid: "data.1",
            targetPid: "data.1",
            payload: new Blob(["data"]),
            sysMetaXml: "<sysmeta/>",
          },
        ],
        { markPackageSaved: false, stopOnError: false },
      );

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      sinon.assert.notCalled(addToStorage);
      sinon.assert.notCalled(removeRecovery);
    });

    it("does not commit ResourceMap effects after System Metadata-only success", async () => {
      const addToStorage = state.sandbox
        .stub(ResourceMapResolver.prototype, "addToStorage")
        .resolves();
      const { pkg, dataMember } = makeExecutorPackage({
        sysMetaService: {
          update: state.sandbox.stub().resolves({ data: "" }),
          invalidate: state.sandbox.stub().resolves(),
        },
      });
      addStablePackageShell(pkg);
      dataMember.remotePid = "data.1";
      dataMember.aggregatedPid = "data.1";
      const removeRecovery = state.sandbox.stub().resolves();
      pkg.uploadRecoveryStore = { remove: removeRecovery };

      const result = await executeActions(pkg, [
        {
          phase: PHASES.SYSTEM_METADATA,
          operation: OPERATIONS.UPDATE_SYSTEM_METADATA,
          memberPid: "data.1",
          sourcePid: "data.1",
          targetPid: "data.1",
          payload: null,
          sysMetaXml: "<sysmeta/>",
        },
      ]);

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      sinon.assert.notCalled(addToStorage);
      sinon.assert.notCalled(removeRecovery);
    });

    it("stops later phases after a data failure", async () => {
      const objectService = {
        create: state.sandbox
          .stub()
          .rejects(Object.assign(new Error("bad request"), { status: 400 })),
        update: state.sandbox.stub(),
      };
      const { pkg } = makeExecutorPackage({ objectService });

      const result = await executeActions(pkg, dataAndResourceMapActions());

      result.outcome.should.equal(UploadResult.Outcomes.PARTIAL_FAILURE);
      result
        .getStatus("update:rm.2")
        .should.equal(UploadResult.Statuses.SKIPPED);
      sinon.assert.notCalled(objectService.update);
      sinon.assert.notCalled(pkg.getSysMetaService().invalidate);
    });

    it("bounds concurrent actions within a phase", async () => {
      const concurrency = trackConcurrency();
      const objectService = {
        create: state.sandbox
          .stub()
          .callsFake(
            concurrency.track(({ pid }) => ({ data: { identifier: pid } })),
          ),
        update: state.sandbox.stub(),
      };
      const members = ["data.1", "data.2", "data.3"].map(
        (pid) =>
          new DataPackageMember({
            pid,
            formatType: "DATA",
            contentDirty: true,
          }),
      );
      const pkg = new DataPackage({
        members,
        objectService,
        sysMetaService: { invalidate: state.sandbox.stub().resolves() },
      });
      const actions = members.map((member) => ({
        phase: PHASES.DATA,
        operation: OPERATIONS.CREATE,
        memberPid: member.pid,
        targetPid: member.pid,
        payload: new Blob(["data"]),
        sysMetaXml: "<sysmeta/>",
      }));

      await executeActions(pkg, actions, {
        markPackageSaved: false,
        maxConcurrent: 2,
        stopOnError: false,
      });

      concurrency.max.should.equal(2);
    });

    it("emits progress with the active action", async () => {
      const { pkg } = makeExecutorPackage({
        objectService: {
          create: state.sandbox.stub().callsFake(async ({ pid }, options) => {
            options.onUploadProgress({ loaded: 2, total: 4 });
            return { data: { identifier: pid } };
          }),
          update: state.sandbox
            .stub()
            .resolves({ data: { identifier: "rm.2" } }),
        },
      });
      const progress = [];
      pkg.events.on("upload:progress", (event) => progress.push(event));

      await executeActions(pkg, dataAndResourceMapActions());

      const byteProgress = progress.find((event) => event.loaded === 2);
      byteProgress.actionId.should.equal("create:data.1");
      byteProgress.total.should.equal(4);
      byteProgress.status.should.equal(UploadResult.Statuses.RUNNING);
      progress
        .some(
          (event) =>
            event.actionId === "create:data.1" &&
            event.status === UploadResult.Statuses.SUCCEEDED,
        )
        .should.equal(true);
    });
  });

  describe("ambiguous writes and retry", () => {
    it("confirms an object create that committed before a timeout", async () => {
      const timeout = Object.assign(new Error("timeout"), {
        name: "TimeoutError",
      });
      const member = new DataPackageMember({
        pid: "data.timeout",
        formatType: "DATA",
        contentDirty: true,
      });
      const pkg = new DataPackage({
        members: [member],
        objectService: {
          create: state.sandbox.stub().rejects(timeout),
          update: state.sandbox.stub(),
        },
        sysMetaService: {
          download: state.sandbox.stub().resolves(
            systemMetadata({
              identifier: "data.timeout",
              checksum: "intended",
            }),
          ),
          invalidate: state.sandbox.stub().resolves(),
        },
      });
      const actions = [
        {
          phase: PHASES.DATA,
          operation: OPERATIONS.CREATE,
          memberPid: "data.timeout",
          targetPid: "data.timeout",
          payload: new Blob(["data"]),
          sysMetaXml: "<sysmeta/>",
          verification: {
            identifier: "data.timeout",
            checksum: { value: "intended", algorithm: "MD5" },
          },
        },
      ];

      const result = await executeActions(pkg, actions);

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      member.remotePid.should.equal("data.timeout");
    });

    it("confirms a committed private policy using mutable System Metadata", async () => {
      const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
      const timeout = Object.assign(new Error("timeout"), {
        name: "TimeoutError",
      });
      const download = state.sandbox.stub();
      download
        .onFirstCall()
        .resolves(
          systemMetadata({ identifier: "data.1", accessPolicy: publicPolicy }),
        );
      download
        .onSecondCall()
        .resolves(systemMetadata({ identifier: "data.1", accessPolicy: [] }));
      const { pkg, sysMetaService } = makeAccessPolicyPackage({
        download,
        update: state.sandbox.stub().rejects(timeout),
      });

      await pkg.setMemberAccessPolicy("data.1", []);
      const result = await pkg.upload();

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      sysMetaService.update.calledOnce.should.equal(true);
      download.callCount.should.equal(2);
    });

    it("does not repeat a System Metadata write when mutable fields do not match", async () => {
      const publicPolicy = [{ subjects: ["public"], permissions: ["read"] }];
      const timeout = Object.assign(new Error("timeout"), {
        name: "TimeoutError",
      });
      const download = state.sandbox
        .stub()
        .resolves(
          systemMetadata({ identifier: "data.1", accessPolicy: publicPolicy }),
        );
      const update = state.sandbox.stub().rejects(timeout);
      const { pkg } = makeAccessPolicyPackage({ download, update });
      await pkg.setMemberAccessPolicy("data.1", []);
      const first = await pkg.upload();

      first.outcome.should.equal(UploadResult.Outcomes.PARTIAL_FAILURE);
      first
        .getStatus("updateSystemMetadata:data.1")
        .should.equal(UploadResult.Statuses.AMBIGUOUS);

      let caught;
      try {
        await pkg.retryUpload(first);
      } catch (error) {
        caught = error;
      }
      caught.code.should.equal("ambiguous_write_unresolved");
      update.calledOnce.should.equal(true);
    });

    it("invalidates System Metadata after retry verifies an ambiguous write", async () => {
      const timeout = Object.assign(new Error("timeout"), {
        name: "TimeoutError",
      });
      const verificationUnavailable = Object.assign(
        new Error("verification unavailable"),
        { status: 503 },
      );
      const member = new DataPackageMember({
        pid: "data.1",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        sysMeta: systemMetadata({ identifier: "data.1", accessPolicy: [] }),
        sysMetaDirty: true,
      });
      const download = state.sandbox.stub();
      download.onFirstCall().rejects(verificationUnavailable);
      download
        .onSecondCall()
        .resolves(systemMetadata({ identifier: "data.1", accessPolicy: [] }));
      const update = state.sandbox.stub().rejects(timeout);
      const invalidate = state.sandbox.stub().resolves();
      const pkg = new DataPackage({
        members: [member],
        sysMetaService: { download, update, invalidate },
      });
      const actions = [
        {
          phase: PHASES.SYSTEM_METADATA,
          operation: OPERATIONS.UPDATE_SYSTEM_METADATA,
          memberPid: "data.1",
          targetPid: "data.1",
          sysMetaXml: "<sysmeta/>",
          verification: {
            identifier: "data.1",
            mutableFields: { accessPolicy: [] },
          },
        },
      ];

      const first = await executeActions(pkg, actions);
      const second = await pkg.retryUpload(first);

      first
        .getStatus("updateSystemMetadata:data.1")
        .should.equal(UploadResult.Statuses.AMBIGUOUS);
      second
        .getStatus("updateSystemMetadata:data.1")
        .should.equal(UploadResult.Statuses.SUCCEEDED);
      sinon.assert.calledOnceWithExactly(invalidate, "data.1");
      sinon.assert.calledOnce(update);
    });

    it("skips successful object actions when retrying a failed ResourceMap", async () => {
      const rmFailure = Object.assign(new Error("resource map rejected"), {
        status: 400,
      });
      const notFound = Object.assign(new Error("missing"), { status: 404 });
      const objectService = {
        create: state.sandbox
          .stub()
          .resolves({ data: { identifier: "data.1" } }),
        update: state.sandbox
          .stub()
          .onFirstCall()
          .rejects(rmFailure)
          .onSecondCall()
          .resolves({ data: { identifier: "rm.2" } }),
      };
      const { pkg } = makeExecutorPackage({
        objectService,
        sysMetaService: {
          download: state.sandbox.stub().rejects(notFound),
          invalidate: state.sandbox.stub().resolves(),
        },
      });
      const first = await executeActions(pkg, dataAndResourceMapActions());

      const second = await pkg.retryUpload(first);

      first.outcome.should.equal(UploadResult.Outcomes.PARTIAL_FAILURE);
      second.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      objectService.create.calledOnce.should.equal(true);
      objectService.update.calledTwice.should.equal(true);
      second
        .getStatus("create:data.1")
        .should.equal(UploadResult.Statuses.SKIPPED);
    });

    it("prepares a fresh upload after the package revision changes", async () => {
      const pkg = new DataPackage();
      const actions = withActionIds([
        {
          phase: PHASES.DATA,
          operation: OPERATIONS.CREATE,
          targetPid: "data.1",
        },
      ]);
      const previous = new UploadResult(actions, {
        dataPackage: pkg,
        draftRevision: 0,
      });
      previous.markFailed("create:data.1", new Error("failed")).finalize();
      pkg.draftRevision += 1;
      const fresh = { outcome: "fresh" };
      const upload = state.sandbox.stub(pkg, "upload").resolves(fresh);

      const result = await pkg.retryUpload(previous);

      result.should.equal(fresh);
      upload.calledOnce.should.equal(true);
    });

    it("confirms an object update when the latest version is the target PID", async () => {
      const timeout = Object.assign(new Error("timeout"), {
        name: "TimeoutError",
      });
      const member = new DataPackageMember({
        pid: "data.2",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        contentDirty: true,
      });
      const download = state.sandbox.stub().resolves(
        systemMetadata({
          identifier: "data.2",
          checksum: "intended",
        }),
      );
      const getLatestVersion = state.sandbox.stub().resolves("data.2");
      const pkg = new DataPackage({
        members: [member],
        objectService: {
          create: state.sandbox.stub(),
          update: state.sandbox.stub().rejects(timeout),
        },
        sysMetaService: {
          download,
          invalidate: state.sandbox.stub().resolves(),
        },
        versionTracker: { getLatestVersion },
      });

      const upload = executeActions(pkg, [
        {
          phase: PHASES.DATA,
          operation: OPERATIONS.UPDATE,
          memberPid: "data.2",
          sourcePid: "data.1",
          targetPid: "data.2",
          payload: new Blob(["data"]),
          sysMetaXml: "<sysmeta/>",
          verification: {
            identifier: "data.2",
            checksum: { value: "intended", algorithm: "MD5" },
          },
        },
      ]);
      const verificationSignal = pkg.activeUpload.controller.signal;
      const result = await upload;

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      result
        .getStatus("update:data.2")
        .should.equal(UploadResult.Statuses.SUCCEEDED);
      result.reloadRequired.should.equal(false);
      member.remotePid.should.equal("data.2");
      verificationSignal.should.be.instanceOf(AbortSignal);
      sinon.assert.calledOnceWithExactly(getLatestVersion, "data.1", {
        useCache: false,
        signal: verificationSignal,
      });
      sinon.assert.calledOnceWithExactly(download, "data.2", {
        useCache: false,
        signal: verificationSignal,
      });
    });

    it("classifies a concurrent source update as stale and reload-required", async () => {
      const member = new DataPackageMember({
        pid: "data.2",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        contentDirty: true,
      });
      const pkg = new DataPackage({
        members: [member],
        objectService: {
          create: state.sandbox.stub(),
          update: state.sandbox
            .stub()
            .rejects(Object.assign(new Error("conflict"), { status: 409 })),
        },
        versionTracker: {
          getLatestVersion: state.sandbox.stub().resolves("data.concurrent"),
        },
      });
      const result = await executeActions(pkg, [
        {
          phase: PHASES.DATA,
          operation: OPERATIONS.UPDATE,
          memberPid: "data.2",
          sourcePid: "data.1",
          targetPid: "data.2",
          payload: new Blob(["data"]),
          sysMetaXml: "<sysmeta/>",
        },
      ]);

      result.outcome.should.equal(UploadResult.Outcomes.STALE_REMOTE);
      result.reloadRequired.should.equal(true);
    });

    it("classifies an already-obsolete server error as stale before rechecking versions", async () => {
      const member = new DataPackageMember({
        pid: "data.2",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        contentDirty: true,
      });
      const obsoleteError = Object.assign(
        new Error(
          "The previous identifier has already been made obsolete by: data.latest",
        ),
        { dataONEErrorName: "IdentifierNotUnique" },
      );
      const getLatestVersion = state.sandbox.stub().resolves("data.1");
      const pkg = new DataPackage({
        members: [member],
        objectService: {
          create: state.sandbox.stub(),
          update: state.sandbox.stub().rejects(obsoleteError),
        },
        versionTracker: { getLatestVersion },
      });

      const result = await executeActions(pkg, [
        {
          phase: PHASES.DATA,
          operation: OPERATIONS.UPDATE,
          memberPid: "data.2",
          sourcePid: "data.1",
          targetPid: "data.2",
          payload: new Blob(["data"]),
          sysMetaXml: "<sysmeta/>",
        },
      ]);

      result.outcome.should.equal(UploadResult.Outcomes.STALE_REMOTE);
      result.getError("update:data.2").latestPid.should.equal("data.latest");
      sinon.assert.notCalled(getLatestVersion);
    });
  });

  describe("cancellation and eager uploads", () => {
    it("throws on cancellation during preparation without requiring reload", async () => {
      const { pkg, objectService } = makeAccessPolicyPackage();
      const controller = new AbortController();
      controller.abort();

      let caught;
      try {
        await pkg.upload({ signal: controller.signal });
      } catch (error) {
        caught = error;
      }

      caught.name.should.equal("AbortError");
      sinon.assert.notCalled(objectService.create);
      sinon.assert.notCalled(objectService.update);
      should.equal(pkg.activeUpload, null);
    });

    it("aborts an in-flight write without verifying and requires reload", async () => {
      const abortError = Object.assign(new Error("aborted"), {
        name: "AbortError",
      });
      let started;
      const didStart = new Promise((resolve) => {
        started = resolve;
      });
      const member = new DataPackageMember({
        pid: "data.cancel",
        formatType: "DATA",
        contentDirty: true,
      });
      const download = state.sandbox.stub();
      const pkg = new DataPackage({
        members: [member],
        objectService: {
          create: state.sandbox.stub().callsFake(
            (_params, options) =>
              new Promise((_resolve, reject) => {
                started();
                options.signal.addEventListener("abort", () =>
                  reject(abortError),
                );
              }),
          ),
          update: state.sandbox.stub(),
        },
        sysMetaService: {
          download,
          invalidate: state.sandbox.stub().resolves(),
        },
      });
      const upload = executeActions(pkg, [
        {
          phase: PHASES.DATA,
          operation: OPERATIONS.CREATE,
          memberPid: "data.cancel",
          targetPid: "data.cancel",
          payload: new Blob(["data"]),
          sysMetaXml: "<sysmeta/>",
        },
      ]);
      await didStart;
      pkg.cancelUpload().should.equal(true);

      const result = await upload;

      result.outcome.should.equal(UploadResult.Outcomes.CANCELLED);
      result.reloadRequired.should.equal(true);
      member.remoteState.should.equal(DataPackageMember.RemoteState.AMBIGUOUS);
      sinon.assert.notCalled(download);

      let caught;
      try {
        await pkg.upload();
      } catch (error) {
        caught = error;
      }
      caught.code.should.equal("reload_required");
    });

    it("keeps cancellation authoritative during stale-source verification", async () => {
      const timeout = Object.assign(new Error("timeout"), {
        name: "TimeoutError",
      });
      let verificationStarted;
      let finishVerification;
      const didStartVerification = new Promise((resolve) => {
        verificationStarted = resolve;
      });
      const getLatestVersion = state.sandbox
        .stub()
        .callsFake((_pid, options) => {
          verificationStarted(options);
          return new Promise((resolve) => {
            finishVerification = resolve;
          });
        });
      const download = state.sandbox.stub().resolves(
        systemMetadata({
          identifier: "data.2",
          checksum: "intended",
        }),
      );
      const member = new DataPackageMember({
        pid: "data.2",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        contentDirty: true,
      });
      const pkg = new DataPackage({
        members: [member],
        objectService: {
          create: state.sandbox.stub(),
          update: state.sandbox.stub().rejects(timeout),
        },
        sysMetaService: {
          download,
          invalidate: state.sandbox.stub().resolves(),
        },
        versionTracker: { getLatestVersion },
      });
      const upload = executeActions(pkg, [
        {
          phase: PHASES.DATA,
          operation: OPERATIONS.UPDATE,
          memberPid: "data.2",
          sourcePid: "data.1",
          targetPid: "data.2",
          payload: new Blob(["data"]),
          sysMetaXml: "<sysmeta/>",
          verification: {
            identifier: "data.2",
            checksum: { value: "intended", algorithm: "MD5" },
          },
        },
      ]);
      const verificationOptions = await didStartVerification;
      pkg.cancelUpload().should.equal(true);
      finishVerification("data.2");

      const result = await upload;

      result.outcome.should.equal(UploadResult.Outcomes.CANCELLED);
      result
        .getStatus("update:data.2")
        .should.equal(UploadResult.Statuses.CANCELLED);
      result.reloadRequired.should.equal(true);
      member.remoteState.should.equal(DataPackageMember.RemoteState.AMBIGUOUS);
      verificationOptions.signal.aborted.should.equal(true);
      sinon.assert.notCalled(download);
    });

    it("keeps cancellation authoritative during ambiguous-write verification", async () => {
      const timeout = Object.assign(new Error("timeout"), {
        name: "TimeoutError",
      });
      let verificationStarted;
      let finishVerification;
      const didStartVerification = new Promise((resolve) => {
        verificationStarted = resolve;
      });
      const download = state.sandbox.stub().callsFake((_pid, options) => {
        verificationStarted(options);
        return new Promise((resolve) => {
          finishVerification = resolve;
        });
      });
      const member = new DataPackageMember({
        pid: "data.cancel",
        formatType: "DATA",
        contentDirty: true,
      });
      const pkg = new DataPackage({
        members: [member],
        objectService: {
          create: state.sandbox.stub().rejects(timeout),
          update: state.sandbox.stub(),
        },
        sysMetaService: {
          download,
          invalidate: state.sandbox.stub().resolves(),
        },
      });
      const upload = executeActions(pkg, [
        {
          phase: PHASES.DATA,
          operation: OPERATIONS.CREATE,
          memberPid: "data.cancel",
          targetPid: "data.cancel",
          payload: new Blob(["data"]),
          sysMetaXml: "<sysmeta/>",
          verification: {
            identifier: "data.cancel",
            checksum: { value: "intended", algorithm: "MD5" },
          },
        },
      ]);
      const verificationOptions = await didStartVerification;
      pkg.cancelUpload().should.equal(true);
      finishVerification(
        systemMetadata({
          identifier: "data.cancel",
          checksum: "intended",
        }),
      );

      const result = await upload;

      result.outcome.should.equal(UploadResult.Outcomes.CANCELLED);
      result
        .getStatus("create:data.cancel")
        .should.equal(UploadResult.Statuses.CANCELLED);
      result.reloadRequired.should.equal(true);
      member.remoteState.should.equal(DataPackageMember.RemoteState.AMBIGUOUS);
      verificationOptions.signal.aborted.should.equal(true);
    });

    it("blocks a full save after an eager upload is cancelled in flight", async () => {
      const abortError = Object.assign(new Error("aborted"), {
        name: "AbortError",
      });
      let started;
      const didStart = new Promise((resolve) => {
        started = resolve;
      });
      const member = new DataPackageMember({
        pid: "data.eager.cancel",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["data"]),
        contentDirty: true,
      });
      const pkg = new DataPackage({
        members: [member],
        objectService: {
          create: state.sandbox.stub().callsFake(
            (_params, options) =>
              new Promise((_resolve, reject) => {
                started();
                options.signal.addEventListener("abort", () =>
                  reject(abortError),
                );
              }),
          ),
          update: state.sandbox.stub(),
        },
        sysMetaService: { invalidate: state.sandbox.stub().resolves() },
        uploadDefaults: {
          submitter: "uid=test",
          rightsHolder: "uid=test",
        },
      });

      const eagerUpload = pkg._uploader.uploadAddedMembers([member]);
      await didStart;
      pkg.cancelEagerUpload("data.eager.cancel").should.equal(true);
      const [result] = await eagerUpload;

      result.outcome.should.equal(UploadResult.Outcomes.CANCELLED);
      member.remoteState.should.equal(DataPackageMember.RemoteState.AMBIGUOUS);

      let caught;
      try {
        await pkg.upload();
      } catch (error) {
        caught = error;
      }
      caught.code.should.equal("reload_required");
    });

    it("queues a full save until current eager work settles", async () => {
      let releaseEager;
      const eager = new Promise((resolve) => {
        releaseEager = resolve;
      });
      const pkg = new DataPackage();
      pkg.eagerUploads.set("data.pending", { promise: eager });
      state.sandbox.stub(pkg._uploader, "_prepareUploadActions").resolves([]);
      const queued = [];
      pkg.events.on("upload:queued", (event) => queued.push(event));

      const upload = pkg.upload();
      pkg.isEditLocked().should.equal(true);
      queued.should.have.lengthOf(1);
      releaseEager();
      pkg.eagerUploads.clear();

      const result = await upload;
      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
    });

    it("cancels a full save queued behind eager work", async () => {
      let releaseEager;
      const eager = new Promise((resolve) => {
        releaseEager = resolve;
      });
      const pkg = new DataPackage();
      pkg.eagerUploads.set("data.pending", { promise: eager });
      const prepare = state.sandbox
        .stub(pkg._uploader, "_prepareUploadActions")
        .resolves([]);
      const cancelled = [];
      pkg.events.on("upload:cancelled", (event) => cancelled.push(event));

      const upload = pkg.upload();
      should.exist(pkg.activeUpload);
      pkg.cancelUpload().should.equal(true);

      let caught;
      let timeoutId;
      try {
        await Promise.race([
          upload,
          new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("queued save did not cancel")),
              50,
            );
          }),
        ]);
      } catch (error) {
        caught = error;
      } finally {
        clearTimeout(timeoutId);
        releaseEager();
        pkg.eagerUploads.clear();
      }

      caught.name.should.equal("AbortError");
      cancelled.should.have.lengthOf(1);
      cancelled[0].cancelled.should.equal(true);
      sinon.assert.notCalled(prepare);
      should.equal(pkg.activeUpload, null);
      pkg.isEditLocked().should.equal(false);
    });

    it("uploads added members eagerly without marking the package saved", async () => {
      const member = new DataPackageMember({
        pid: "data.eager",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["data"]),
        contentDirty: true,
      });
      const pkg = new DataPackage({
        members: [member],
        objectService: {
          create: state.sandbox
            .stub()
            .resolves({ data: { identifier: "data.eager" } }),
          update: state.sandbox.stub(),
        },
        sysMetaService: { invalidate: state.sandbox.stub().resolves() },
        uploadDefaults: {
          submitter: "uid=test",
          rightsHolder: "uid=test",
        },
      });
      pkg.draftRevision += 1;
      const completed = [];
      pkg.events.on("eagerUpload:complete", (event) => {
        pkg.getPendingEagerUploads().should.have.lengthOf(0);
        completed.push(event);
      });

      const [result] = await pkg._uploader.uploadAddedMembers([member]);

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      member.remotePid.should.equal("data.eager");
      pkg.savedRevision.should.equal(0);
      pkg.hasUnsavedChanges().should.equal(true);
      completed.should.have.lengthOf(1);
      completed[0].members.should.deep.equal([member]);
      completed[0].result.should.equal(result);
    });

    it("isolates eager prep failures to the member that failed", async () => {
      const failedError = new Error("checksum failed");
      const goodMember = new DataPackageMember({
        pid: "data.good",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["data"]),
        contentDirty: true,
      });
      const failedMember = new DataPackageMember({
        pid: "data.failed",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["data"]),
        contentDirty: true,
      });
      state.sandbox
        .stub(failedMember, "buildObjectSystemMetadata")
        .rejects(failedError);
      const objectService = {
        create: state.sandbox
          .stub()
          .resolves({ data: { identifier: "data.good" } }),
        update: state.sandbox.stub(),
      };
      const pkg = new DataPackage({
        members: [goodMember, failedMember],
        objectService,
        sysMetaService: { invalidate: state.sandbox.stub().resolves() },
        uploadDefaults: {
          submitter: "uid=test",
          rightsHolder: "uid=test",
        },
      });

      const [result] = await pkg._uploader.uploadAddedMembers([
        goodMember,
        failedMember,
      ]);

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      result.actions
        .map((action) => action.targetPid)
        .should.deep.equal(["data.good"]);
      goodMember.remotePid.should.equal("data.good");
      failedMember.remoteState.should.equal(
        DataPackageMember.RemoteState.FAILED,
      );
      failedMember.lastUploadError.should.equal(failedError);
      sinon.assert.calledOnce(objectService.create);
    });

    it("checks replacement sources before eager object uploads", async () => {
      const member = new DataPackageMember({
        pid: "data.2",
        remotePid: "data.1",
        aggregatedPid: "data.1",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["replacement"], { type: "text/csv" }),
        contentDirty: true,
      });
      const objectService = {
        create: state.sandbox.stub(),
        update: state.sandbox.stub(),
      };
      const getSysMeta = state.sandbox.stub().callsFake(async (pid) =>
        systemMetadata({
          identifier: pid,
          obsoletedBy: pid === "data.1" ? "data.latest" : null,
        }),
      );
      const pkg = new DataPackage({
        members: [member],
        objectService,
        sysMetaService: {
          download: state.sandbox
            .stub()
            .resolves(systemMetadata({ identifier: "data.1" })),
          invalidate: state.sandbox.stub().resolves(),
        },
        versionTracker: { getSysMeta },
        authorizationService: {
          checkAll: state.sandbox.stub().resolves({ "data.1": true }),
        },
        uploadDefaults: {
          submitter: "uid=test",
          rightsHolder: "uid=test",
        },
      });

      const [result] = await pkg._uploader.uploadAddedMembers([member]);

      result.outcome.should.equal(UploadResult.Outcomes.STALE_REMOTE);
      result.getError("update:data.2").latestPid.should.equal("data.latest");
      member.remoteState.should.equal(DataPackageMember.RemoteState.FAILED);
      member.lastUploadError.latestPid.should.equal("data.latest");
      sinon.assert.calledWith(getSysMeta, "data.1");
      sinon.assert.notCalled(objectService.update);
      sinon.assert.notCalled(objectService.create);
    });

    it("cleans eager upload records by the original member PID", async () => {
      const member = new DataPackageMember({
        pid: "data.eager",
        formatType: "DATA",
        formatId: "text/csv",
        uploadFile: new Blob(["data"]),
        contentDirty: true,
      });
      const pkg = new DataPackage({ members: [member] });
      const result = new UploadResult([], { dataPackage: pkg });
      result.finalize();
      state.sandbox
        .stub(pkg._uploader, "_prepareEagerUploadActions")
        .resolves([]);
      state.sandbox
        .stub(pkg._uploader, "_executeUploadActions")
        .resolves(result);

      const upload = pkg._uploader.uploadAddedMembers([member]);
      pkg.eagerUploads.has("data.eager").should.equal(true);
      member.pid = "data.changed";

      const [settled] = await upload;

      settled.should.equal(result);
      pkg.getPendingEagerUploads().should.have.lengthOf(0);
    });
  });
});
