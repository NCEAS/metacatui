const parts = [
    'googleAnalyticsKey: ""',
    'portalLimit: 100',
    'showDatasetPublicToggle: true',
    'showDatasetPublicToggleForSubjects: []',
    'temporaryMessage: "' +
      '\\u003ch5\\u003eThe Arctic Data Center Repository will undergo scheduled ' +
      'maintenance on October 30, 2025,\\nfrom 8:00 PM to 8:15 PM PDT. Please ' +
      'refrain from submitting or editing content during this\\nperiod, since ' +
      'the repository may be in read-only mode or unavailable for part of the ' +
      'time.\\u003c/h5\\u003e"',
    'temporaryMessageClasses: "warning"',
    'temporaryMessageEndTime: new Date("2222-06-16T13:30:00Z")',
    'temporaryMessageStartTime: new Date("2020-06-16T13:30:00Z")',
    'trustedContentSources: [' +
      '"https://*ecoinformatics.org*",' +
      '"https://*arcticdata.io",' +
      '"https://cosima.nceas.ucsb.edu*",' +
      '"https://sasap-data.shinyapps.io/board_of_fisheries/",' +
      '"https://shirlysteph.github.io/salmon-storymap/"' +
    ']',
    'd1CNBaseUrl: "https://cn-sandbox.test.dataone.org/"',
    'theme: "default"',
    'root: "/"',
    'metacatContext: "metacat"',
    'baseUrl: "https://metacat-dev.test.dataone.org/"'
];

const expected = `MetacatUI.AppConfig = {   ${parts.join(',   ')} }`;

module.exports = { expected };
