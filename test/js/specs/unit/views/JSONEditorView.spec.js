define(["views/JSONEditorView"], (JSONEditorView) => {
  const expect = chai.expect;

  describe("JSONEditorView", () => {
    let view;
    let field;

    beforeEach(() => {
      view = new JSONEditorView({
        value: { enabled: true },
        label: "Configuration JSON",
      }).render();
      field = view.el.querySelector("textarea");
      document.body.append(view.el);
    });

    afterEach(() => {
      view.remove();
    });

    const edit = (text) => {
      field.value = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };

    it("formats JSON as literal text and associates its label with the field", () => {
      view.remove();
      view = new JSONEditorView({
        value: { description: "</textarea><b>Layer description</b>" },
        label: "<b>Layer JSON</b>",
      }).render();
      document.body.append(view.el);
      field = view.el.querySelector("textarea");
      view.showError("<b>Invalid source</b>");
      expect(view.el.querySelector("b")).to.equal(null);
      expect(field.value).to.equal(
        '{\n  "description": "</textarea><b>Layer description</b>"\n}',
      );
      const label = view.el.querySelector("label");
      expect(label.textContent).to.equal("<b>Layer JSON</b>");
      expect(label.htmlFor).to.equal(field.id);
      expect(view.errorEl.textContent).to.equal("<b>Invalid source</b>");
    });

    it("accepts arrays, strings, numbers, booleans, and null", () => {
      [[1, false], "Text", 0, true, false, null].forEach((value) => {
        view.setValue(value);
        expect(view.parse()).to.deep.equal({ value, error: null });
      });
    });

    it("preserves invalid drafts through validation and rerendering, then accepts corrections", () => {
      edit('{"enabled":');
      field.setSelectionRange(3, 3);
      const result = view.parse();
      const error = document.getElementById(
        field.getAttribute("aria-describedby"),
      );
      expect(result.error).to.be.a("string").and.not.to.equal("");
      expect(result.value).to.equal(undefined);
      expect(field.value).to.equal('{"enabled":');
      expect(field.getAttribute("aria-invalid")).to.equal("true");
      expect(error.textContent).to.equal(result.error);
      expect(error.getAttribute("role")).to.equal("alert");
      expect(document.activeElement).to.equal(field);
      expect(field.selectionStart).to.equal(3);
      expect(field.selectionEnd).to.equal(3);
      view.render();
      field = view.el.querySelector("textarea");
      expect(field.value).to.equal('{"enabled":');
      expect(field.getAttribute("aria-invalid")).to.equal("true");
      expect(view.errorEl.textContent).to.equal(result.error);
      expect(view.hasPendingChanges()).to.equal(true);
      edit('{"');
      expect(field.hasAttribute("aria-invalid")).to.equal(false);
      expect(view.errorEl.textContent).to.equal("");
      edit('{"enabled":false}');
      expect(view.parse()).to.deep.equal({
        value: { enabled: false },
        error: null,
      });
      expect(view.hasPendingChanges()).to.equal(true);
    });

    it("emits pending transitions and clears the draft and error when reset", () => {
      const changes = [];
      view.on("change:draft", (pending) => changes.push(pending));
      edit("{");
      edit('{"');
      edit('{\n  "enabled": true\n}');
      edit("{");
      view.parse();
      view.setValue(null);
      expect(changes).to.deep.equal([true, false, true, false]);
      expect(field.value).to.equal("null");
      expect(view.hasPendingChanges()).to.equal(false);
      expect(field.hasAttribute("aria-invalid")).to.equal(false);
      expect(view.errorEl.textContent).to.equal("");
      expect(view.parse()).to.deep.equal({ value: null, error: null });
    });

    it("keeps field IDs and validation separate between editors", () => {
      const other = new JSONEditorView({
        value: { count: 2 },
        label: "Other JSON",
      }).render();
      document.body.append(other.el);
      try {
        edit("{");
        view.parse();
        const otherField = other.el.querySelector("textarea");
        expect(otherField.id).not.to.equal(field.id);
        expect(otherField.getAttribute("aria-describedby")).not.to.equal(
          field.getAttribute("aria-describedby"),
        );
        expect(otherField.hasAttribute("aria-invalid")).to.equal(false);
        expect(other.parse()).to.deep.equal({
          value: { count: 2 },
          error: null,
        });
      } finally {
        other.remove();
      }
    });
  });
});
