define(["views/portals/editor/PortEditorSectionView"], (
  PortEditorSectionView,
) => {
  const PortEditorMapSectionView = PortEditorSectionView.extend(
    /** @lends PortEditorMapSectionView.prototype */ {
      type: "PortEditorMapSection",
      className: `${PortEditorSectionView.prototype.className} port-editor-map port-editor-viz`,
      attributes: {
        "data-category": "sections",
      },
      sectionType: "cesium",
      events: {},
      render() {
        this.$el.data("view", this);
        return this;
      },
    },
  );

  return PortEditorMapSectionView;
});
