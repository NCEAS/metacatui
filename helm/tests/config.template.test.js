// This test renders the helm chart with a specific values file
// and compares the generated MetacatUI.AppConfig to the expected output.
// Run using:  node helm/tests/config.template.test.js
//
const cp = require('child_process');
const assert = require('assert');
const { expected } = require('./expected-config-test.js');

try {
    const rendered = cp.execSync(
        `helm template test-release --debug helm/ -f ./helm/tests/values-config-test.yaml`,
        {encoding: 'utf8'}
    );

    const match = rendered.match(/MetacatUI\.AppConfig\s*=\s*\{[\s\S]*?\}\s*/);
    assert(match, 'MetacatUI.AppConfig not found in rendered output');

    const actual = match[0].trim();

    const normalize = (s) => s.replace(/\s+/g, ' ').trim();
    const actualNorm = normalize(actual);
    const expectedNorm = normalize(expected);

    assert.strictEqual(actualNorm, expectedNorm,
        'helm output DOES NOT METCH ./expected-config-test.js');

    console.log('PASS - helm output matches ./expected-config-test.js exactly');
    process.exit(0);
} catch (err) {
    console.error('FAIL - ', err.message || err);
    process.exit(1);
}
