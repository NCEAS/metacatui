"use strict";

define(["common/ValueUtilities", "models/dataPackage/DataPackageMember"], (
  Values,
  DataPackageMember,
) => {
  /**
   * Build the standard duplicate member error.
   * @param {string} pid Duplicate PID
   * @returns {Error} Duplicate member error
   */
  function createDuplicateMemberError(pid) {
    const error = new Error(
      `Member with PID ${pid} already exists. Use the merge option to update.`,
    );
    error.name = "DataPackageMembersError";
    error.code = "duplicate_member";
    error.pid = pid;
    return error;
  }

  /**
   * Store data package members and provide PID and format based lookups.
   * @class DataPackageMembers
   * @classcategory Models/DataPackage
   * @since 0.0.0
   */
  class DataPackageMembers {
    /**
     * Create a member collection.
     * @param {ObjectFormats|null} [objectFormats] Object format collection
     * @param {object|null} [packageEvents] Owning package event emitter
     */
    constructor(objectFormats = null, packageEvents = null) {
      this.members = [];
      this.membersByPid = new Map();
      // Loaded ObjectFormats collection injected into each member so format
      // classification (isMetadata/isData/etc.) is synchronous.
      this.objectFormats = objectFormats;
      // Members construct metadata models lazily. Preserve their owning package
      // emitter so those models never have to guess from rootDataPackage.
      this.packageEvents = packageEvents;
    }

    /**
     * Inject the loaded ObjectFormats collection and backfill it onto every
     * member already in the collection.
     * @param {ObjectFormats} objectFormats Loaded ObjectFormats collection
     * @returns {DataPackageMembers} This collection
     */
    setObjectFormats(objectFormats) {
      this.objectFormats = objectFormats || null;
      this.members.forEach((member) => member.setObjectFormats(objectFormats));
      return this;
    }

    /**
     * Add or merge member info into the collection.
     * @param {object|object[]} memberInfo One or more member info objects
     * @param {object} [options] Add options
     * @param {boolean} [options.merge] Merge into an existing member
     * @param {string[]} [options.sources] Source tags for added/merged data
     * @param {boolean} [options.onlyExisting] When true, only merge into
     * members that already exist; never create new members. Used to enrich an
     * authoritative member set (for example, from the index) without adding
     * members that are not aggregated
     * @returns {DataPackageMembers} This collection
     */
    add(memberInfo, { merge = true, sources = [], onlyExisting = false } = {}) {
      const toAdd = Values.listify(memberInfo || []);
      toAdd.forEach((info) => {
        const member = DataPackageMember.from(info, { sources });
        const existing = this.get(member.pid);
        if (existing) {
          if (merge) {
            existing.merge(member);
          } else {
            throw createDuplicateMemberError(member.pid);
          }
        } else if (!onlyExisting) {
          member.setObjectFormats(this.objectFormats);
          this.members.push(member);
          this.membersByPid.set(member.pid, member);
        }
        const ownedMember = existing || (!onlyExisting ? member : null);
        if (ownedMember) ownedMember._packageEvents = this.packageEvents;
      });
      return this;
    }

    /**
     * Remove a member by PID.
     * @param {string} pid Member PID
     * @returns {DataPackageMembers} This collection
     */
    remove(pid) {
      const normalizedPid = Values.normalizeText(pid);
      const member = this.get(normalizedPid);
      if (member) {
        this.members = this.members.filter((m) => m.pid !== normalizedPid);
        this.membersByPid.delete(normalizedPid);
      }
      return this;
    }

    /**
     * Return a member by PID.
     * @param {string} pid Member PID
     * @returns {DataPackageMember|null} Matching member, or null
     */
    get(pid) {
      const normalizedPid = Values.normalizeText(pid);
      return this.membersByPid.get(normalizedPid) || null;
    }

    /**
     * Return members whose PIDs are in the requested set.
     * @param {string[]} pids Member PIDs
     * @returns {DataPackageMember[]} Matching members
     */
    getMembers(pids) {
      const pidSet = new Set(pids);
      return this.members.filter((member) => pidSet.has(member.pid));
    }

    /**
     * Return resource map members.
     * @returns {DataPackageMember[]} Resource map members
     */
    getResourceMaps() {
      return this.members.filter((member) => member.isResourceMap());
    }

    /**
     * Return metadata members.
     * @returns {DataPackageMember[]} Metadata members
     */
    getMetadata() {
      return this.members.filter((member) => member.isMetadata());
    }

    /**
     * Return data members.
     * @returns {DataPackageMember[]} Data members
     */
    getData() {
      return this.members.filter((member) => member.isData());
    }

    /**
     * Return members loaded from a manifest source.
     * @param {string} source Source name
     * @returns {DataPackageMember[]} Matching members
     */
    getFromSource(source) {
      return this.members.filter((member) => member.sources.includes(source));
    }

    /**
     * Atomically change a member's desired PID and lookup map key.
     * @param {string} oldPid Current PID
     * @param {string} newPid Desired replacement PID
     * @returns {DataPackageMember} Rekeyed member
     * @throws {Error} When a PID is invalid, missing, or already in use
     */
    replacePid(oldPid, newPid) {
      const currentPid = Values.requireNonEmptyString(
        oldPid,
        "DataPackageMembers.replacePid requires an old PID",
      );
      const desiredPid = Values.requireNonEmptyString(
        newPid,
        "DataPackageMembers.replacePid requires a new PID",
      );
      const member = this.get(currentPid);
      if (!member) {
        throw new Error(`Member with PID ${currentPid} does not exist`);
      }
      if (currentPid === desiredPid) return member;
      if (this.get(desiredPid)) throw createDuplicateMemberError(desiredPid);

      member.setDesiredPid(desiredPid);
      this.membersByPid.delete(currentPid);
      this.membersByPid.set(desiredPid, member);
      return member;
    }

    /**
     * Return members not marked for removal.
     * @returns {DataPackageMember[]} Active members
     */
    getActiveMembers() {
      return this.members.filter((member) => !member.removed);
    }

    /**
     * Rebuild the PID lookup map from the current members array.
     * @returns {DataPackageMembers} This collection
     * @private
     */
    _reindex() {
      this.membersByPid = new Map(
        this.members.map((member) => [member.pid, member]),
      );
      return this;
    }

    /**
     * Delete members marked for removal.
     * @returns {DataPackageMembers} This collection
     */
    purgeRemoved() {
      this.members = this.getActiveMembers();
      return this._reindex();
    }

    /**
     * Remove every member not included in the authoritative PID set.
     * @param {string[]} pids PIDs to retain
     * @returns {DataPackageMembers} This collection
     */
    retain(pids) {
      const retainedPids = new Set(
        Values.listify(pids)
          .map((pid) => Values.normalizeText(pid))
          .filter(Boolean),
      );
      this.members = this.members.filter((member) =>
        retainedPids.has(member.pid),
      );
      return this._reindex();
    }

    /**
     * Return a copy of the member array.
     * @returns {DataPackageMember[]} Package members
     */
    toArray() {
      return [...this.members];
    }
  }

  return DataPackageMembers;
});
