define([
  "/test/js/specs/shared/clean-state.js",
  "models/sysmeta/VersionTracker",
  "models/sysmeta/SysMeta",
  "localforage",
], (cleanState, VersionTracker, SysMeta, localforage) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("VersionTracker Test Suite", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const vt = new VersionTracker({
          metaServiceUrl: "https://example.org/sysmeta/",
        });
        // Only stub if not already stubbed
        if (!SysMeta.prototype.fetch.restore) {
          sandbox.stub(SysMeta.prototype, "fetch").resolves();
        }
        return { vt, sandbox };
      },
      beforeEach,
      afterEach,
    );

    after(() => {
      // Clean up the localforage store after all tests
      return localforage.clear();
    });
    afterEach(() => {
      // Restore the sandbox after each test
      state.sandbox.restore();
      // Clear the VersionTracker instance
      state.vt.clear();
      // Clear the localforage store
      return localforage.clear();
    });

    describe("VersionTracker instantiation", () => {
      it("throws on invalid TTL", () => {
        expect(() => {
          new VersionTracker({ ttlMs: -1 });
        }).to.throw("Invalid TTL provided to VersionTracker");
      });

      it("throws on invalid maxChainHops", () => {
        expect(() => {
          new VersionTracker({ maxChainHops: -1 });
        }).to.throw("Invalid maxChainHops provided to VersionTracker");
      });

      it("throws on invalid maxCacheRecords", () => {
        expect(() => {
          new VersionTracker({ maxCacheRecords: -1 });
        }).to.throw("Invalid maxCacheRecords provided to VersionTracker");
      });

      it("throws on invalid store", () => {
        expect(() => {
          new VersionTracker({ store: {} });
        }).to.throw(
          "Invalid store provided to VersionTracker. Must be a localforage instance.",
        );
      });

      it("sets up inFlight, locks, and cache", () => {
        state.vt.inFlight.should.be.instanceof(Map);
        state.vt.locks.should.be.instanceof(Map);
        state.vt.cache.should.be.instanceof(Map);
      });

      it("sets up a persistent store with a unique name", () => {
        state.vt.store._config.name.should.match(/^vt_[a-f0-9]{32}$/);
        state.vt.store._config.storeName.should.match(/^vt_[a-f0-9]{32}$/);
      });

      it("instantiates correctly with valid config", () => {
        state.vt.should.be.instanceof(VersionTracker);
        state.vt.metaServiceUrl.should.equal("https://example.org/sysmeta/");
      });

      it("returns the same instance from VersionTracker.get", () => {
        const vt1 = VersionTracker.get("https://example.org/sysmeta/");
        const vt2 = VersionTracker.get("https://example.org/sysmeta/");
        vt1.should.equal(vt2);
      });
    });

    describe("VersionTracker private methods", () => {
      // fillVersionChain
      it("fills the version chain with next versions", async () => {
        const chain = ["chain-pid.1", "chain-pid.2", "chain-pid.3"];
        const pid0 = chain[0];
        // mock sysmeta responses
        state.vt.getSysMeta = sinon.stub().callsFake((pid) => {
          const i = chain.indexOf(pid);
          const nextPid = chain[i + 1];
          const prevPid = chain[i - 1];
          const data = {
            data: {
              obsoletedBy: nextPid || null,
              obsoletes: prevPid || null,
            },
            identifier: pid,
          };
          return Promise.resolve(data);
        });

        // fill the chain
        await state.vt.fillVersionChain(pid0, 3, true, true);
        const rec = await state.vt.record(pid0);

        rec.next.should.deep.equal(chain.slice(1));
        rec.endNext.should.be.true;
        rec.prev.should.be.empty;
        rec.endPrev.should.be.false;
      });

      it("fills the version chain with previous versions", async () => {
        const chain = ["rev-chain-pid.1", "rev-chain-pid.2", "rev-chain-pid.3"];
        const pid3 = chain[2];
        // mock sysmeta responses
        state.vt.getSysMeta = sinon.stub().callsFake((pid) => {
          const i = chain.indexOf(pid);
          const nextPid = chain[i + 1];
          const prevPid = chain[i - 1];
          const data = {
            data: {
              obsoletedBy: nextPid || null,
              obsoletes: prevPid || null,
            },
            identifier: pid,
          };
          return Promise.resolve(data);
        });

        // fill the chain
        await state.vt.fillVersionChain(pid3, 3, false, true);
        const rec = await state.vt.record(pid3);

        rec.prev.should.deep.equal(chain.slice(0, 2).reverse());
        rec.endPrev.should.be.true;
        rec.next.should.be.empty;
        rec.endNext.should.be.false;
      });

      it("fills the version chain, ignoring end flags", async () => {
        const chain = ["ignore-end-pid.1", "ignore-end-pid.2"];
        const pid0 = chain[0];
        // mock sysmeta responses
        state.vt.getSysMeta = sinon.stub().callsFake((pid) => {
          const i = chain.indexOf(pid);
          const nextPid = chain[i + 1];
          const prevPid = chain[i - 1];
          const data = {
            data: {
              obsoletedBy: nextPid || null,
              obsoletes: prevPid || null,
            },
            identifier: pid,
          };
          return Promise.resolve(data);
        });

        // Add a record with an endNext flag set to true
        await state.vt.persist(pid0, {
          next: [],
          prev: [],
          endNext: true,
          endPrev: false,
        });

        // fill the chain
        await state.vt.fillVersionChain(pid0, 3, true, true);
        const rec = await state.vt.record(pid0);
        rec.next.should.deep.equal(chain.slice(1));
        rec.endNext.should.be.true; // should not be set
        rec.prev.should.be.empty;
        rec.endPrev.should.be.false;
      });

      it("sets and releases a lock during fillVersionChain", async () => {
        const pid = "lock.1";
        state.sandbox.stub(state.vt, "getSysMeta").callsFake(async (pid) => {
          // A method with a delay to simulate network fetch
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            identifier: pid,
            data: {
              obsoletedBy: null,
              obsoletes: null,
            },
          };
        });
        // Ensure the lock is acquired before the promise resolves
        const promise = state.vt.fillVersionChain(pid, 2, true);
        await new Promise((resolve) => setTimeout(resolve, 5));
        state.vt.locks.has(pid).should.be.true;
        await promise;
        state.vt.locks.has(pid).should.be.false;
      });

      it("fetches SysMeta for a PID", async () => {
        const pid = "test-pid.1";
        const sysMetaData = {
          identifier: pid,
          data: {
            obsoletedBy: "test-pid.2",
            obsoletes: null,
          },
        };

        // Mock the SysMeta fetch
        state.sandbox.restore();
        state.sandbox
          .stub(SysMeta.prototype, "fetch")
          .callsFake(async function () {
            this.data = sysMetaData.data;
            return sysMetaData;
          });
        const sysMeta = await state.vt.getSysMeta(pid);
        sysMeta.data.should.have.property("obsoletedBy", "test-pid.2");
        sysMeta.data.should.have.property("obsoletes", null);
      });

      it("caches in-flight SysMeta requests", async () => {
        const pid = "test-pid.2";
        const sysMetaData = {
          identifier: pid,
          data: {
            obsoletedBy: "test-pid.3",
            obsoletes: null,
          },
        };

        // Mock the SysMeta fetch
        state.sandbox.restore();
        state.sandbox
          .stub(SysMeta.prototype, "fetch")
          .callsFake(async function () {
            this.data = sysMetaData.data;
            return sysMetaData;
          });

        // First call should fetch and cache
        const firstCall = await state.vt.getSysMeta(pid);
        firstCall.data.should.have.property("obsoletedBy", "test-pid.3");

        // Second call should return cached result
        const secondCall = await state.vt.getSysMeta(pid);
        secondCall.should.equal(firstCall);
      });

      it("deduplicates concurrent getSysMeta requests", async () => {
        const pid = "concurrent.1";
        state.sandbox.restore();
        const fetchSpy = state.sandbox
          .stub(SysMeta.prototype, "fetch")
          .resolves({ identifier: pid, data: {} });

        await Promise.all([state.vt.getSysMeta(pid), state.vt.getSysMeta(pid)]);
        fetchSpy.calledOnce.should.be.true;
      });

      it("handles errors when fetching SysMeta", async () => {
        const pid = "error-pid.1";
        const errorMessage = "Network error";

        // Mock the SysMeta fetch to throw an error
        state.sandbox.restore();
        state.sandbox
          .stub(SysMeta.prototype, "fetch")
          .rejects(new Error(errorMessage));

        try {
          await state.vt.getSysMeta(pid);
          throw new Error("Expected error was not thrown");
        } catch (err) {
          err.message.should.equal(errorMessage);
        }
      });

      it("gets or creates a record for a PID", async () => {
        const pid = "test-record-pid.1";
        const rec = await state.vt.record(pid);

        rec.should.have.property("next").that.is.an("array").that.is.empty;
        rec.should.have.property("prev").that.is.an("array").that.is.empty;
        rec.should.have.property("endNext", false);
        rec.should.have.property("endPrev", false);
        rec.should.have.property("sysMeta", null);

        // Check if the record is cached
        state.vt.cache.has(pid).should.be.true;

        // Fetch the same record again
        const cachedRec = await state.vt.record(pid);
        cachedRec.should.equal(rec); // should return the same instance
      });

      it("persists and loads a record from localForage", async () => {
        const pid = "load-record-pid.1";
        const recData = {
          next: ["next-pid.1"],
          prev: ["prev-pid.1"],
          endNext: false,
          endPrev: true,
          sysMeta: { data: { size: 100, formatId: "text/csv" } },
        };

        // Save the record to localForage
        await state.vt.persist(pid, recData);

        // Load the record
        const loadedRec = await state.vt.load(pid);
        loadedRec.ts.should.be.a("number");
        loadedRec.next.should.deep.equal(recData.next);
        loadedRec.prev.should.deep.equal(recData.prev);
        loadedRec.endNext.should.equal(recData.endNext);
        loadedRec.endPrev.should.equal(recData.endPrev);
        loadedRec.sysMeta.should.deep.equal(recData.sysMeta.data);
      });

      it("treats a stale record (older than TTL) as stale and refetches", async () => {
        const pid = "ttl-expire.1";
        await state.vt.persist(pid, {
          next: [],
          prev: [],
          endNext: false,
          endPrev: false,
        });
        // Set a short TTL for testing
        state.vt.setTTL(10);
        // pause to ensure the record is stale
        await new Promise((resolve) => setTimeout(resolve, 11));
        // state.vt.load should be null
        const loaded = await state.vt.load(pid);
        should.not.exist(loaded);
      });

      it("evicts least‑recently‑used entries when maxCacheRecords is exceeded", async () => {
        const smallVT = new VersionTracker({
          metaServiceUrl: "https://x",
          maxCacheRecords: 3,
        });
        state.sandbox
          .stub(smallVT, "getSysMeta")
          .callsFake((pid) => Promise.resolve({ identifier: pid, data: {} }));

        for (const p of ["a", "b", "c", "d"]) {
          await smallVT.record(p);
        }
        smallVT.cache.size.should.equal(3);
        smallVT.cache.has("a").should.be.false;
        await smallVT.clear();
      });

      it("honours maxChainHops and stops traversal", async () => {
        const MAX_HOPS = 2;
        const vt = new VersionTracker({
          metaServiceUrl: "https://x",
          maxChainHops: MAX_HOPS,
        });
        state.sandbox.stub(vt, "getSysMeta").callsFake((pid) => {
          const n = Number(pid.split(".")[1]);
          return Promise.resolve({
            identifier: pid,
            data: {
              obsoletedBy: n < 4 ? `h.${n + 1}` : null,
              obsoletes: n > 1 ? `h.${n - 1}` : null,
            },
          });
        });

        await vt.fillVersionChain("h.1", 10, true, true);
        const rec = await vt.record("h.1");
        // +1 because the final record comes from previous sys meta fetch, so
        // only 2 fetches total.
        rec.next.length.should.equal(MAX_HOPS + 1);
      });
    });

    describe("VersionTracker API", () => {
      it("returns the 0th version (self)", async () => {
        const pid = "abc.1";
        const result = await state.vt.getNth(pid, 0);
        result.should.equal(pid);
      });

      it("clears the cache", async () => {
        const cleared = await state.vt.clear();
        cleared.should.be.true;
      });

      it("sets TTL dynamically", () => {
        state.vt.setTTL(10000);
        state.vt.TTL_MS.should.equal(10000);
      });

      it("triggers an update event when a record is updated", async () => {
        const pid = "update-test.1";
        const updateSpy = sinon.spy();
        state.vt.off(`update:${pid}`);
        state.vt.on(`update:${pid}`, updateSpy);

        // Add a new version to trigger an update
        await state.vt.addVersion(pid, "update-test.2");

        updateSpy.called.should.be.true;
      });

      it("adds a new version link between two isolated records", async () => {
        const prevPid = "abc.1";
        const newPid = "abc.2";

        await state.vt.addVersion(prevPid, newPid);

        const prev = await state.vt.getFullChain(prevPid);
        const next = await state.vt.getFullChain(newPid);

        prev.next[0].should.equal(newPid);
        next.prev[0].should.equal(prevPid);
      });

      it("throws if trying to add an existing link", async () => {
        const prevPid = "abc.3";
        const newPid = "abc.4";

        await state.vt.addVersion(prevPid, newPid);

        try {
          await state.vt.addVersion(prevPid, newPid);
          throw new Error("Expected error was not thrown");
        } catch (err) {
          err.message.should.equal(
            `Cannot add version: ${newPid} is already in the chain of ${prevPid}`,
          );
        }
      });

      it("navigates forward and backward correctly with getNth", async () => {
        const chain = ["g.1", "g.2", "g.3"];
        state.sandbox.stub(state.vt, "getSysMeta").callsFake((pid) => {
          const i = chain.indexOf(pid);
          return Promise.resolve({
            identifier: pid,
            data: {
              obsoletedBy: chain[i + 1] || null,
              obsoletes: chain[i - 1] || null,
            },
          });
        });

        await state.vt.fillVersionChain("g.2", 3, true, true);
        (await state.vt.getNth("g.2", +1)).should.equal("g.3");
        (await state.vt.getNth("g.2", -1)).should.equal("g.1");
      });

      it("keeps singleton instances separated by metaServiceUrl", () => {
        VersionTracker.get("url1").should.not.equal(VersionTracker.get("url2"));
      });

      it("loads data persisted by a previous VersionTracker instance", async () => {
        const pid = "persisted.1";
        await state.vt.persist(pid, {
          next: ["x"],
          prev: [],
          endNext: false,
          endPrev: false,
        });

        const fresh = new VersionTracker({
          metaServiceUrl: state.vt.metaServiceUrl,
          store: state.vt.store,
        });
        const loaded = await fresh.load(pid);
        loaded.next[0].should.equal("x");
        await fresh.clear();
      });
    });
  });
});
