# MetacatUI Github Pages website
This folder of the MetacatUI repository houses the files for a simple website about MetacatUI. This website contains:
- Basic information about MetacatUI
- Developer documentation for the MetacatUI application

## Building documentation
To build the MetacatUI JSDoc documentation HTML files, run the following commands:

### Step 1. Install jsdoc
```bash
npm install jsdoc
```

### Step 2. Build docs
```bash
cd /path/to/git/datadepot
jsdoc -r -d docs/docs/ -c docs/jsdoc-templates/metacatui/conf.js src/js/
```
