define([
  "../../../../../../../src/js/models/metadata/eml211/EMLEntity.js",
], function (EMLEntity) {
  // Configure the Chai assertion library
  let should = chai.should();
  let expect = chai.expect;

  describe("EMLEntity", function () {
    let emlEntity, xml, attributes, updatedDOM;

    /* Setup */
    before(function () {
      attributes = {
        id: "12345",
        altIds: ["altid.1.1.png", "altid2.1.1.png"],
        entityName: "entity.1.1.png",
        entityDescription: "A description of entity.1.1.png",
        entityType: "Portable Network graphic image",
      };

      xml = `<otherEntity id="${attributes.id}">
        <alternateIdentifier>${attributes.altIds[0]}</alternateIdentifier>
        <alternateIdentifier>${attributes.altIds[1]}</alternateIdentifier>
        <entityName>${attributes.entityName}</entityName>
        <entityDescription>${attributes.entityDescription}</entityDescription>
        <entityType>${attributes.entityType}</entityType>
      </otherEntity>`;

      emlEntity = new EMLEntity();
    });

    /* Tear down */
    after(function () {
      emlEntity = undefined;
      xml = undefined;
      attributes = undefined;
      updatedDOM = undefined;
    });

    describe("Creating", function () {
      it("parses an EML snippet", function () {
        let json = emlEntity.parse({
          objectXML: xml,
        });
        json.should.be.a("object");
        emlEntity.set(json);
      });

      it("has an xml id attribute", function () {
        emlEntity.get("xmlID").should.be.a("string");
        emlEntity.get("xmlID").should.equal(attributes.id);
      });

      it("has alternate identifiers", function () {
        emlEntity.get("alternateIdentifier").should.be.an("array");
        emlEntity.get("alternateIdentifier").length.should.equal(2);
        emlEntity
          .get("alternateIdentifier")[0]
          .should.equal(attributes.altIds[0]);
        emlEntity
          .get("alternateIdentifier")[1]
          .should.equal(attributes.altIds[1]);
      });

      it("has an entity name", function () {
        emlEntity.get("entityName").should.equal(attributes.entityName);
      });

      it("has an entity description", function () {
        emlEntity
          .get("entityDescription")
          .should.equal(attributes.entityDescription);
      });

      it("decodes a DataONE PID from a download URL", function () {
        const entity = new EMLEntity();
        const parsed = entity.parse({
          objectXML: `<otherEntity id="urn-uuid-data.1">
            <entityName>data.csv</entityName>
            <physical>
              <distribution>
                <online>
                  <url function="download">https://cn.test/resolve/urn%3Auuid%3Adata.1</url>
                </online>
              </distribution>
            </physical>
          </otherEntity>`,
        });

        parsed.downloadID.should.equal("urn:uuid:data.1");
      });
    });

    describe("Updating", function () {
      before(function () {
        attributes = {
          id: "54321",
          altIds: ["new.png", "new2.png"],
          entityName: "entity.new.png",
          entityDescription: "A description of entity.new.png",
          entityType: "New entity type",
        };
      });

      beforeEach(function () {
        emlEntity.set("xmlID", attributes.id);
        emlEntity.set("alternateIdentifier", [
          attributes.altIds[0],
          attributes.altIds[1],
        ]);
        emlEntity.set("entityName", attributes.entityName);
        emlEntity.set("entityDescription", attributes.entityDescription);
        updatedDOM = emlEntity.updateDOM();
      });

      it("updates the XML DOM", function () {
        expect(updatedDOM).to.exist;
      });

      it("updates the XML ID", function () {
        $(updatedDOM).attr("id").should.equal(attributes.id);
      });

      it("has two new alternateIdentifier elements", function () {
        $(updatedDOM)
          .children("alternateIdentifier")[0]
          .textContent.should.equal(attributes.altIds[0]);
        $(updatedDOM)
          .children("alternateIdentifier")[1]
          .textContent.should.equal(attributes.altIds[1]);
      });

      it("has a new entityName element", function () {
        $(updatedDOM)
          .children("entityName")
          .text()
          .should.equal(attributes.entityName);
      });

      it("has a new entityDescription element", function () {
        $(updatedDOM)
          .children("entityDescription")
          .text()
          .should.equal(attributes.entityDescription);
      });

      it("derives a data pid from the entity and reuses it for xmlID when needed", function () {
        emlEntity.unset("xmlID");
        emlEntity.set("downloadID", "urn:uuid:data.1");

        const dom = emlEntity.updateDOM();

        emlEntity.getDataPid().should.equal("urn:uuid:data.1");
        emlEntity.get("xmlID").should.equal("urn-uuid-data.1");
        $(dom).attr("id").should.equal("urn-uuid-data.1");
      });

      it("serializes the current PID in an existing download URL", function () {
        const entity = new EMLEntity(
          {
            objectXML: `<otherEntity id="data.1">
              <physical>
                <distribution>
                  <online>
                    <url function="download">https://cn.test/resolve/data.1</url>
                  </online>
                </distribution>
              </physical>
            </otherEntity>`,
          },
          { parse: true },
        );

        entity.setMemberDescriptor({
          id: "urn:uuid:data.2",
          previousId: "data.1",
        });

        entity
          .updateDOM()
          .querySelector('url[function="download"]')
          .textContent.should.equal(
            "https://cn.test/resolve/urn%3Auuid%3Adata.2",
          );
      });

      it("does not replace an information URL after an external download URL", function () {
        const entity = new EMLEntity(
          {
            objectXML: `<otherEntity id="data.1">
              <physical>
                <distribution>
                  <online>
                    <url function="download">https://example.test/download</url>
                    <url function="information">https://cn.test/resolve/data.1</url>
                  </online>
                </distribution>
              </physical>
            </otherEntity>`,
          },
          { parse: true },
        );

        entity.setMemberDescriptor({
          id: "data.2",
          previousId: "data.1",
        });

        const urls = entity.updateDOM().querySelectorAll("url");
        urls[0].textContent.should.equal("https://example.test/download");
        urls[1].textContent.should.equal("https://cn.test/resolve/data.1");
      });
    });
  });
});
