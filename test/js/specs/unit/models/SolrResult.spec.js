define(["../../../../../../../../src/js/models/SolrResult"], function(SolrResult) {
    // Configure the Chai assertion library
    var should =  chai.should();
    var expect = chai.expect;
    let solrResult;

    describe("Search Test Suite", function(){
        /* Set up */
        beforeEach(function(){
            solrResult = new SolrResult();
        })

        /* Tear down */
        after(function() {
            solrResult = undefined;
        });

        describe("The SolrResult model", function(){
            it("should be created", function(){
                solrResult.should.be.instanceof(SolrResult);
            })
        });

        describe("Converting bytes to human-readable size", function() {
            it("should handle undefined bytes", function() {
                const result = solrResult.bytesToSize(undefined, 2);
                expect(result).to.equal('0 B');
            });
    
            it("should handle bytes less than 1 KiB", function() {
                const result = solrResult.bytesToSize(512, 2);
                expect(result).to.equal('512 B');
            });
    
            it("should convert bytes to KiB with precision", function() {
                const result = solrResult.bytesToSize(2048, 2);
                expect(result).to.equal('2.00 KiB');
            });
    
            it("should convert bytes to MiB with precision", function() {
                const result = solrResult.bytesToSize(2 * 1024 * 1024, 3);
                expect(result).to.equal('2.000 MiB');
            });
    
            it("should convert bytes to GiB with precision", function() {
                const result = solrResult.bytesToSize(2 * 1024 * 1024 * 1024, 4);
                expect(result).to.equal('2.0000 GiB');
            });
    
            it("should convert bytes to TiB with precision", function() {
                const result = solrResult.bytesToSize(2 * 1024 * 1024 * 1024 * 1024, 5);
                expect(result).to.equal('2.00000 TiB');
            });
    
            it("should handle very large bytes", function() {
                const result = solrResult.bytesToSize(2 * 1024 * 1024 * 1024 * 1024 * 1024, 2);
                expect(result).to.equal('2048.00 TiB');
            });
        });

        
    });
});