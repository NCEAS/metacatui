"use strict";

define([], () => {
  /**
   * @namespace FileTableMetrics
   * @description Pure helpers for shaping per PID metrics for the file table
   * {@link FileTableMetrics.parse} turns the existing dataset metrics response
   * into a `pid -> counts` map, and {@link FileTableMetrics.getRowMetric}
   * adapts that map to the file table's metric resolver
   * @classcategory Models/FileTable
   * @since 0.0.0
   */

  /**
   * Coerce a raw metrics record to numeric counts.
   * @param {object} values Raw metric values
   * @returns {object} `{views, downloads, citations}` counts
   */
  function toCounts(values = {}) {
    return {
      views: Number(values.views ?? values.viewCount) || 0,
      downloads: Number(values.downloads ?? values.downloadCount) || 0,
      citations: Number(values.citations ?? values.citationCount) || 0,
    };
  }

  /**
   * Parse a metrics service response into a `pid -> counts` map. Handles the
   * dataset response's `resultDetails.metrics_package_counts`, plus the
   * array of rows shape (`results: [{pid, views, ...}]`) and the parallel array
   * shape (`results: {pid: [...], views: [...], ...}`).
   * @param {object} response Metrics service response
   * @returns {Map<string, object>} Counts keyed by PID
   */
  function parse(response) {
    const map = new Map();
    const packageCounts = response?.resultDetails?.metrics_package_counts;
    if (packageCounts && typeof packageCounts === "object") {
      Object.entries(packageCounts).forEach(([pid, counts]) => {
        if (pid) map.set(pid, toCounts(counts));
      });
      return map;
    }

    const results = response?.results;
    if (!results) return map;

    if (Array.isArray(results)) {
      results.forEach((row) => {
        const pid = row?.pid || row?.identifier;
        if (pid) map.set(pid, toCounts(row));
      });
      return map;
    }

    const pids =
      results.pid || results.identifier || results.pids || results.datasets;
    if (Array.isArray(pids)) {
      pids.forEach((pid, index) => {
        if (!pid) return;
        map.set(
          pid,
          toCounts({
            views: results.views?.[index],
            downloads: results.downloads?.[index],
            citations: results.citations?.[index],
          }),
        );
      });
    }
    return map;
  }

  /**
   * Build a file table metric resolver from a `pid -> counts` map. Metadata
   * rows show views; other rows show downloads, matching the legacy table.
   * @param {Map<string, object>} metricsByPid Counts keyed by PID
   * @returns {Function} Resolver `(member, type) => {label, title, iconClass}`
   */
  function getRowMetric(metricsByPid) {
    return (member, type) => {
      const counts = member?.pid ? metricsByPid?.get(member.pid) : null;
      if (!counts) return null;
      if (type === "METADATA") {
        return {
          label: String(counts.views),
          title: `${counts.views} views`,
          iconClass: "icon icon-eye-open",
        };
      }
      return {
        label: String(counts.downloads),
        title: `${counts.downloads} downloads`,
        iconClass: "icon icon-cloud-download",
      };
    };
  }

  return {
    parse,
    getRowMetric,
  };
});
