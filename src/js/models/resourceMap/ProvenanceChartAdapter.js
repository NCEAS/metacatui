"use strict";

define([
  "common/ValueUtilities",
  "models/resourceMap/ProvenanceValidation",
  "models/resourceMap/RDFGraph",
], (ValueUtilities, ProvenanceValidation, RDFGraph) => {
  const { addMapArrayValue, dedupeBy } = ValueUtilities;

  /**
   * Add chart records for every package member, preserving the presentation
   * types expected by the provenance chart.
   * @param {DataPackage} dataPackage Package whose members are projected
   * @param {Function} ensureRecord Add or update one chart record
   * @returns {void}
   */
  function projectPackageMembers(dataPackage, ensureRecord) {
    dataPackage.toArray().forEach((member) => {
      let type = "resource";
      if (member.isMetadata()) type = "metadata";
      else if (member.isData()) {
        const formatId = String(member.getFormatId() || "").toLowerCase();
        if (formatId.startsWith("image/")) type = "image";
        else if (formatId === "application/pdf") type = "PDF";
        else type = "data";
      }
      ensureRecord(member.pid, type);
    });
  }

  /**
   * Create the record and relationship indexes shared by each projection step.
   * @param {DataPackage} dataPackage Package whose members are projected
   * @param {ResourceMap} resourceMap Parsed package Resource Map
   * @param {object} provenance Plain provenance relationships
   * @returns {object} Mutable chart projection state
   */
  function createChartState(dataPackage, resourceMap, provenance) {
    const programPids = new Set(
      provenance.typeAssertions
        .filter(({ className }) => className === "Program")
        .map(({ pid }) => pid),
    );
    const recordsByPid = new Map();
    const isProgramEditable = (programPid) =>
      // The chart can show external programs, but only one exact
      // package member can be edited safely.
      resourceMap.graphState.getMemberUris(programPid).length === 1 &&
      ProvenanceValidation.isProgramExecutionEditable(
        resourceMap.provenance,
        programPid,
      );
    const ensureRecord = (pid, type = "data") => {
      const existingRecord = recordsByPid.get(pid);
      if (existingRecord) {
        if (type === "program" && existingRecord.type !== type) {
          existingRecord.type = type;
          existingRecord.editable = isProgramEditable(pid);
        }
        return existingRecord;
      }
      const member = dataPackage.getMember(pid);
      const recordType = programPids.has(pid) ? "program" : type;
      const record = {
        pid,
        fileName: member?.getFileName() || pid,
        type: recordType,
        isDocumentedBy: member?.isDocumentedBy || [],
        member: member || null,
        editable: recordType === "program" ? isProgramEditable(pid) : true,
      };
      recordsByPid.set(pid, record);
      return record;
    };

    projectPackageMembers(dataPackage, ensureRecord);

    const sourcesByPid = new Map();
    const derivationsByPid = new Map();
    const statementsByPid = new Map();
    const statementKeys = new Set();
    const memberPids = new Set(resourceMap.getMemberPids());
    const addRelatedRecord = (
      map,
      pid,
      record,
      editable = record.editable !== false,
    ) => {
      addMapArrayValue(map, pid, {
        ...record,
        editable,
      });
    };
    const addStatement = (predicate, subject, object) => {
      const key = RDFGraph.buildKey([predicate, subject.pid, object.pid]);
      if (statementKeys.has(key)) return;
      statementKeys.add(key);
      const statement = { predicate, subject, object };
      [subject.pid, object.pid].forEach((pid) => {
        addMapArrayValue(statementsByPid, pid, statement);
      });
    };
    const isChartRelationship = (subjectPid, objectPid) =>
      memberPids.has(subjectPid) || memberPids.has(objectPid);

    return {
      addRelatedRecord,
      addStatement,
      derivationsByPid,
      ensureRecord,
      isChartRelationship,
      memberPids,
      recordsByPid,
      sourcesByPid,
      statementsByPid,
    };
  }

  /**
   * Project data-to-data derivation relationships.
   * @param {WasDerivedFromRelationship[]} relationships Relationships to add
   * @param {object} projection Shared chart projection operations and indexes
   * @returns {void}
   */
  function projectDerivations(relationships, projection) {
    const {
      addRelatedRecord,
      addStatement,
      derivationsByPid,
      ensureRecord,
      isChartRelationship,
      sourcesByPid,
    } = projection;

    relationships.forEach(({ derivedPid, sourcePid }) => {
      if (!isChartRelationship(derivedPid, sourcePid)) return;
      const derived = ensureRecord(derivedPid);
      const source = ensureRecord(sourcePid);
      addRelatedRecord(sourcesByPid, derivedPid, source);
      addRelatedRecord(derivationsByPid, sourcePid, derived);
      addStatement("wasDerivedFrom", derived, source);
    });
  }

  /**
   * Project relationships between data and the programs that generated or
   * consumed it.
   * @param {ExecutionProgramRelationship[]} relationships Relationships to add
   * @param {string} kind Chart relationship name
   * @param {object} projection Shared chart projection operations and indexes
   * @returns {void}
   */
  function projectExecutionRelationships(relationships, kind, projection) {
    const {
      addRelatedRecord,
      addStatement,
      derivationsByPid,
      ensureRecord,
      isChartRelationship,
      sourcesByPid,
    } = projection;

    relationships.forEach(({ dataPid, programPid }) => {
      if (!isChartRelationship(dataPid, programPid)) return;
      const data = ensureRecord(dataPid);
      const program = ensureRecord(programPid, "program");
      const { editable } = program;
      if (kind === "generatedByProgram") {
        addRelatedRecord(sourcesByPid, dataPid, program, editable);
        addRelatedRecord(derivationsByPid, programPid, data, editable);
      } else {
        addRelatedRecord(derivationsByPid, dataPid, program, editable);
        addRelatedRecord(sourcesByPid, programPid, data, editable);
      }
      addStatement(kind, data, program);
    });
  }

  /**
   * Project display-only lineage between current and previous programs.
   * @param {ProgramLineageRelationship[]} relationships Relationships to add
   * @param {object} projection Shared chart projection operations and indexes
   * @returns {void}
   */
  function projectProgramLineage(relationships, projection) {
    const {
      addRelatedRecord,
      addStatement,
      derivationsByPid,
      ensureRecord,
      isChartRelationship,
      sourcesByPid,
    } = projection;

    relationships.forEach(({ programPid, previousProgramPid }) => {
      if (!isChartRelationship(programPid, previousProgramPid)) return;
      const program = ensureRecord(programPid, "program");
      const previousProgram = ensureRecord(previousProgramPid, "program");
      addRelatedRecord(sourcesByPid, programPid, previousProgram, false);
      // Member charts need the reverse link when the current program is
      // external and therefore has no chart of its own.
      addRelatedRecord(derivationsByPid, previousProgramPid, program, false);
      addStatement("wasInformedByProgram", program, previousProgram);
    });
  }

  /**
   * Remove repeated related records while preserving read-only relationships.
   * @param {object[]} records Related chart records
   * @returns {object[]} Distinct related chart records
   */
  function dedupeRelated(records) {
    const recordKey = (record) => record.pid;
    const readOnlyKeys = new Set(
      (records || [])
        .filter(({ editable }) => editable === false)
        .map(recordKey),
    );
    return dedupeBy(records, recordKey).map((record) =>
      readOnlyKeys.has(recordKey(record))
        ? { ...record, editable: false }
        : record,
    );
  }

  /**
   * Convert package history into plain chart records that cannot change the
   * RDF graph.
   * @class ProvenanceChartAdapter
   * @classcategory Models/ResourceMap
   * @since 0.0.0
   */
  class ProvenanceChartAdapter {
    /**
     * Build chart records showing which data came from other data and which
     * programs produced or consumed it.
     * @param {DataPackage} dataPackage Package with a parsed ResourceMap model
     * @returns {object} Chart records and relationship lookup helpers
     * @example
     * const chart = ProvenanceChartAdapter.build(dataPackage);
     * chart.getSources("data.1");
     */
    static build(dataPackage) {
      const resourceMap = dataPackage.getResourceMapModel();
      const provenance = resourceMap.provenance.toJSON();
      const projection = createChartState(dataPackage, resourceMap, provenance);

      projectDerivations(provenance.wasDerivedFrom, projection);
      projectExecutionRelationships(
        provenance.generatedByPrograms,
        "generatedByProgram",
        projection,
      );
      projectExecutionRelationships(
        provenance.usedByPrograms,
        "usedByProgram",
        projection,
      );
      projectProgramLineage(provenance.wasInformedByPrograms, projection);

      const {
        derivationsByPid,
        memberPids,
        recordsByPid,
        sourcesByPid,
        statementsByPid,
      } = projection;
      return {
        records: Array.from(recordsByPid.values()).filter(({ pid }) =>
          memberPids.has(pid),
        ),
        getRecord(pid) {
          return recordsByPid.get(pid) || null;
        },
        getSources(pid) {
          return dedupeRelated(sourcesByPid.get(pid));
        },
        getDerivations(pid) {
          return dedupeRelated(derivationsByPid.get(pid));
        },
        getStatements(pid) {
          return statementsByPid.get(pid) || [];
        },
      };
    }
  }

  return ProvenanceChartAdapter;
});
