define(["../../../../../../../../src/js/collections/DataPackage"], function(DataPackage) {
    var expect = chai.expect;

    describe("DataPackage Test Suite", function() {
        let dataPackage;

        beforeEach(function() {
            dataPackage = new DataPackage();
        });

        afterEach(function() {
            dataPackage = undefined;
        });

        describe("Resolving relative paths", function() {
            it("should resolve a relative path with '..', '.', and '~'", function() {
                const relativePath = './q/../w.csv';
                const result = dataPackage.getAbsolutePath(relativePath);
                expect(result).to.equal('w.csv');
            });

            it("should handle empty relative path", function() {
                const relativePath = '';
                const result = dataPackage.getAbsolutePath(relativePath);
                expect(result).to.equal('/');
            });

            it("should handle relative path with '~' (ignoring '~')", function() {
                const relativePath = '~/q/w.csv';
                const result = dataPackage.getAbsolutePath(relativePath);
                expect(result).to.equal('q/w.csv');
            });

            it("should handle relative path with multiple consecutive '/'", function() {
                const relativePath = 'folder1///folder2/file.txt';
                const result = dataPackage.getAbsolutePath(relativePath);
                expect(result).to.equal('folder1/folder2/file.txt');
            });
        });
    });
});
