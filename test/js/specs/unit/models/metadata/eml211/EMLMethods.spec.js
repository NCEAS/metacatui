define(["../../../../../../../../src/js/models/metadata/eml211/EMLMethods"],
    function(EMLMethods) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        describe("EMLMethods Test Suite", function (){

            /* Setup */
            before(function() {

            });

            /* Tear down */
            after(function() {
                // If needed
            });

            describe("The EMLMethods object", function() {
                it('should exist', function() {
                    let emlMethods = new EMLMethods();
                    emlMethods.should.exist;
                    emlMethods.should.be.instanceof(EMLMethods);
                });
            });

            describe("Serializing", function(){

                describe("Basic serializing", function(){
                    it("should return an XML string", function(){
                        let emlMethods = new EMLMethods({
                            objectXML: `<methods>
                            <methodStep><description><para>No method step description provided.</para></description></methodStep>
                            <sampling><studyExtent><description>
                                  <para>On a given date, a study area is chosen to be surveyed. Possible areas have included Ano Nuevo, Point Lobos, Piedras Blancas, and Point Buchon since 2007. Twelve new areas (Cape Mendocino, Ten Mile, Trinidad, Bodega Head, Stewart's Point, Farallon Islands, Point Conception, Carrington Point, Anacapa Island, Laguna Beach, Swami's and South La Jolla) were added in 2017. All areas except for Trinidad contain two survey sites: a marine protected area site (or "protected site") and a fished reference site. Marine protected areas are delineated by California State Marine Reserve or State Marine Conservation Area boundaries. Fished reference sites are nearby, unprotected locations with similar rocky reef habitat. Trinidad contains a fished reference site only. The California Collaborative Fisheries Research Program (CCFRP) surveys each study area six times annually (if possible) between July and October, three times inside the Marine Protected Area and three times at the fished reference site.</para>
                                </description></studyExtent><samplingDescription><para>Each site (protected site or fished reference site) contains a minimum of two pre-identified 500x500 m grid cells. Grid cells were selected such that they are positioned in nearshore rocky reef habitat, in water less than 40 meters deep, and in areas that have been identified by fishermen as having suitable habitat for nearshore fishes. A grid cell is selected at random, and 30-45 minutes of timed fishing activity is conducted along 1-3 drifts at discrete locations within the cell. Between 4 and 18 (with a mode of 12) volunteer anglers use hook-and-line rigs and fishing gear appropriate to the area to catch fish. Three different standard gear types are used on each sampling trip (with some regional variation throughout the state) to target the full fish assemblage. Any fish caught is identified to the species level whenever possible. Otherwise, it is identified to the lowest possible taxonomic level. Throughout each drift, the length of each fish caught and the amount of time each angler spends fishing are also recorded.</para><para>Each of the 6 CCFRP member institutions maintains a Microsoft ACCESS database built from a uniform database template. At the end of a survey, each member institution inputs the data into their database. A person separate from the individual who entered the data checks for copying errors. Additionally, drifts are mapped in ArcGIS to ensure that GPS coordinates are correct. Drifts are excluded from the data if they start or end in different grid cells, if any part of the drift was greater than 50% outside the intended grid cell and ends greater than 80 m from the intended grid cell boundaries, or if a drift is completely outside of the intended grid cell and the start and end of the drift is greater than 25 m away. Finally, the 6 member databases are merged together to produce a single statewide data set.</para></samplingDescription></sampling>
                          </methods>`
                        });

                        expect(emlMethods.serialize()).to.have.lengthOf.at.least(1);
                    });
                });

               
                describe("Has sampling but no methods", function(){
                    let emlMethods = new EMLMethods({
                        objectXML: `<methods>
                        <methodStep><description><para>No method step description provided.</para></description></methodStep>
                        <sampling><studyExtent><description>
                              <para>On a given date, a study area is chosen to be surveyed. Possible areas have included Ano Nuevo, Point Lobos, Piedras Blancas, and Point Buchon since 2007. Twelve new areas (Cape Mendocino, Ten Mile, Trinidad, Bodega Head, Stewart's Point, Farallon Islands, Point Conception, Carrington Point, Anacapa Island, Laguna Beach, Swami's and South La Jolla) were added in 2017. All areas except for Trinidad contain two survey sites: a marine protected area site (or "protected site") and a fished reference site. Marine protected areas are delineated by California State Marine Reserve or State Marine Conservation Area boundaries. Fished reference sites are nearby, unprotected locations with similar rocky reef habitat. Trinidad contains a fished reference site only. The California Collaborative Fisheries Research Program (CCFRP) surveys each study area six times annually (if possible) between July and October, three times inside the Marine Protected Area and three times at the fished reference site.</para>
                            </description></studyExtent><samplingDescription><para>This is a paragraph.</para><para>This is a second.</para></samplingDescription></sampling>
                      </methods>`
                    });

                    let parser = new DOMParser();
                    let xmlDoc = parser.parseFromString(emlMethods.serialize(),"text/xml");
                    
                    it("should have one method step", ()=>{
                        expect(xmlDoc.getElementsByTagName("methodStep")).to.have.lengthOf(1);
                        expect(xmlDoc.getElementsByTagName("methodStep")[0].childNodes[0].childNodes[0].textContent).to.eql("No method step description provided.")
                    });
                    it("should have a sampling description", ()=>{
                        expect(xmlDoc.getElementsByTagName("sampling")).to.have.lengthOf(1);
                        expect(xmlDoc.getElementsByTagName("samplingdescription")).to.have.lengthOf(1);
                        expect(xmlDoc.getElementsByTagName("samplingdescription")[0].textContent).to.equal(`This is a paragraph.This is a second.`);
                    });
                    it("should have a study extent description", ()=>{
                        expect(xmlDoc.getElementsByTagName("studyExtent")).to.have.lengthOf(1);
                    });
                })
            });



        });

    });
