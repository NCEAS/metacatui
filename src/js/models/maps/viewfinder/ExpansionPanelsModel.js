'use strict';

define([], () => {
  /**
  * @class ExpansionPanelsModel
  * @classdes ExpansionPanelsModel maintains state for multiple
  * ExpansionPanelView instances so that only one is open at a time.
  * @classcategory Models/Maps
  */
  const ExpansionPanelsModel = Backbone.Model.extend({
    /**
     * @name ExpansionPanelsModel#defaults
     * @type {Object}
     * @property {ExpansionPanelView[]} panels The expansion panel views that
     * are meant to have only a single panel open at a time.
     * @property {string} mode The open mode which determines the behavior of 
     * other panels in group when a panel is opened. Possible values are
     * 'single'|'multi".
     */
    defaults() {
      return {
        panels: [],
        mode: 'single'
      }
    },

    /**
     * @param {string} mode is the open mode.
     */
    initialize({ mode } = { mode: 'single' }) {
      this.set('mode', mode);
    },

    /**
     * Register a panel to coordinate collapse state.
     * @property {ExpansionPanelView} panel The expansion panel view to be 
     * tracked.
     */
    register(panel) {
      this.set('panels', [...this.get('panels'), panel]);
    },

    /**
     * Collapse all panels except for the newly opened panel for certain open
     * modes.
     * @property {ExpansionPanelView} openedPanel The expansion panel view that 
     * should remain open.
     */
    collapseOthers(openedPanel) {
      const isSingleOpenMode = this.get('mode') === 'single';
      for (const panel of this.get('panels')) {
        if (isSingleOpenMode && panel !== openedPanel) {
          panel.collapse();
        }
      }
    }
  });

  return ExpansionPanelsModel;
});