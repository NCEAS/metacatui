"use strict";

define([
  "backbone",
  "underscore",
  "common/Utilities",
  "models/ontologies/BioontologyClass",
  "models/ontologies/BioontologyOntology",
], (Backbone, _, Utilities, BioontologyClass, BioontologyOntology) => {
  // The type that defines an ontology in the BioPortal API
  const ONTOLOGY_TYPE = "http://data.bioontology.org/metadata/Ontology";
  // The number of items to remove from the cache if it is full
  const CACHE_REMOVAL_SIZE = 100;
  // The number of milliseconds to wait before caching new items
  const CACHE_DEBOUNCE_TIME = 500;
  /**
   * @class BioontologyResults
   * @classdesc A collection of items returned from the BioPortal API. So far
   * this collection is capable of storing Bioontology Classes and Ontologies.
   * @class BioontologyResults
   * @classcategory Collections/Ontologies
   * @augments Backbone.Collection
   * @since 0.0.0
   * @class
   */
  const BioontologyResults = Backbone.Collection.extend(
    /** @lends BioontologyResults.prototype */ {
      /** @inheritdoc */
      // eslint-disable-next-line object-shorthand
      // Must use a function expression for `model` otherwise Backbone does not
      // handle properly handle model instantiation.
      model: function model(attrs, options) {
        if (
          attrs["@type"] === ONTOLOGY_TYPE ||
          attrs.ontologyType === ONTOLOGY_TYPE
        ) {
          return new BioontologyOntology(attrs, options);
        }
        return new BioontologyClass(attrs, options);
      },

      /**
       * @inheritdoc
       * @param {object} _attributes - The attributes to initialize the collection with
       * @param {object} options - The options to initialize the collection with
       * @param {boolean} [options.autoCache] - Whether to automatically cache new items
       */
      initialize(_attributes, options) {
        this.cache = _.debounce(this.cache, CACHE_DEBOUNCE_TIME);
        if (options?.autoCache !== false) {
          this.listenTo(this, "add", this.cache);
        }
      },

      /** @returns {BioontologyClass[]} All BioontologyClass models in this collection */
      classes() {
        return this.models.filter((model) => model.type === "BioontologyClass");
      },

      /** @returns {BioontologyOntology[]} All BioontologyOntology models in this collection */
      ontologies() {
        return this.models.filter(
          (model) => model.type === "BioontologyOntology",
        );
      },

      /**
       * Fetches information for all ontologies in the collection. params use
       * the defaults in the BioontologyOntology model if not provided.
       * @param {string[]} ontologies - The acronyms of the ontologies to fetch,
       * otherwise all ontologies in the collection will be fetched.
       * @param {string[]} [include] - The fields to include in the response.
       * @param {boolean} [includeViews] - Whether to include views
       * @param {boolean} [displayContext] - Whether to include context.
       * @param {boolean} [displayLinks] - Whether to include links.
       */
      fetchOntologyDetails(
        ontologies,
        include,
        includeViews,
        displayContext,
        displayLinks,
      ) {
        const ontologiesToFetch = ontologies
          ? this.where({ acronym: ontologies })
          : this.ontologies();
        const attrs = {
          include,
          includeViews,
          displayContext,
          displayLinks,
        };
        Object.keys(attrs).forEach((key) => {
          if (attrs[key] === undefined) delete attrs[key];
        });
        ontologiesToFetch.forEach((ontology) => {
          ontology.set(attrs);
          ontology.fetch({
            error: (model, response) => {
              model.set("errorText", response.responseJSON.error);
            },
          });
        });
      },

      /**
       * Fetches the names of all ontologies in the collection that do not have
       * a name.
       * @param {boolean} [checkCache] - Whether to check the browser's
       * storage for the names of the ontologies before fetching them.
       */
      fetchOntologyNames(checkCache = true) {
        const ontologies = this.ontologies();
        const missingOntologies = ontologies.filter(
          (ontology) => !ontology.get("name"),
        );
        if (!missingOntologies.length) return;
        let missingAcronyms = missingOntologies.pluck("acronym");
        if (checkCache) {
          const foundOntologies =
            this.fetchOntologyNamesFromCache(missingAcronyms);
          const foundAcronyms = foundOntologies.map(
            (ontology) => ontology.acronym,
          );
          missingAcronyms = missingAcronyms.filter(
            (acronym) => !foundAcronyms.includes(acronym),
          );
        }
        if (!missingAcronyms.length) return;
        this.fetchOntologyDetails(
          missingAcronyms,
          ["name"],
          false,
          false,
          false,
        );
      },

      /**
       * Fetches the names of the ontologies from the browser's storage cache
       * @param {string[]} acronyms - The acronyms of the ontologies to fetch
       * @returns {BioontologyOntology[]} The ontologies with names
       */
      fetchOntologyNamesFromCache(acronyms) {
        const collection = this;
        const cached = this.getItemsFromCache(acronyms);
        const cachedWithNames = cached.filter((ontology) => ontology.name);
        const updated = [];
        cachedWithNames.forEach((cachedOntology) => {
          const ontologyToUpdate = collection.get(cachedOntology.acronym);
          ontologyToUpdate.set("name", cachedOntology.name);
          updated.push(ontologyToUpdate);
        });
        return updated;
      },

      /** Store the collection in the browser's storage */
      cache() {
        // Only add new items to the cache. Do not overwrite existing items.
        const currentCache = this.getItemsFromCache();
        const currentCacheIds = currentCache.map((item) => item.id);

        const newModels = this.filter(
          (item) => !currentCacheIds.includes(item.id),
        );
        // Keep cache storage small by removing unnecessary properties
        const removeProps = ["@context", "links"];
        const newItems = newModels.map((model) =>
          Utilities.toJSONWithoutDefaults(model, removeProps),
        );
        const cache = currentCache.concat(newItems);
        this.cacheWithRetry(cache);
      },

      /**
       * If the cache is full, remove the oldest 100 items and try to cache again
       * @param {object[]} cache - The cache to store
       */
      cacheWithRetry(cache) {
        try {
          localStorage.setItem("bioontologyResults", JSON.stringify(cache));
        } catch (error) {
          if (error.name === "QuotaExceededError") {
            const newCache = cache.slice(CACHE_REMOVAL_SIZE);
            this.cacheWithRetry(newCache);
          } else {
            throw error;
          }
        }
      },

      /**
       * Retrieve classes & ontologies from the browser's storage, if available
       * @param {string[]} ids - The unique identifiers of the items to get,
       * otherwise all items available in the cache will be restored.
       * @returns {object[]} The items from the cache
       */
      getItemsFromCache(ids) {
        let cache = localStorage.getItem("bioontologyResults");
        cache = cache ? JSON.parse(cache) : [];
        if (!cache || !cache.length) return [];
        if (ids) {
          return cache.filter((item) => ids.includes(item.id));
        }
        return cache;
      },

      /**
       * Restore classes & ontologies from the browser's storage and adds them to
       * the collection.
       * @param {string[]} ids - The unique identifiers of the items to restore,
       * otherwise all items available in the cache will be restored.
       * @param {boolean} silent - Whether to suppress the "add" event
       * @returns {BioontologyClass[]} The restored items
       */
      restoreFromCache(ids, silent = false) {
        const items = this.getItemsFromCache(ids);
        return this.add(items, { silent });
      },

      /** Remove all items from the browser's storage */
      clearCache() {
        localStorage.removeItem("bioontologyResults");
      },

      /**
       * Convert all classes in the collection attributes to use in the
       * Accordion model
       * @param {string} root - The root ontology or subtree
       * @returns {object[]} The classes as Accordion items
       */
      classesToAccordionItems(root) {
        const classes = this.classes();
        return classes.map((cls) => {
          const accordionItem = cls.toAccordionItem();
          const { parent } = accordionItem;
          accordionItem.parent = parent === root ? "" : parent;
          return accordionItem;
        });
      },
    },
  );

  return BioontologyResults;
});
