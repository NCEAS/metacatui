# MetacatUI Helm chart

This is a simple helm chart for debugging a MetacatUI deployment. It works by:

0. Create a namespace `mcui` for the deployment (or pick another of your liking)
1. Create a PV that is mapped to a local `hostPath` directory that contains the web files to deploy
2. Create a PVC for the PV
3. Create a nginx deployment behind an ingress that mounts the PVC where nginx expects its web files to live

To deploy this, you need to 1) create the PV and PVC for your system layout, 2) modify the values.yaml to your hostname for the Ingress definition, and 3) install the helm chart:

```bash
❯ helm -n mcui upgrade --install mcui ./helm
Release "mcui" has been upgraded. Happy Helming!
NAME: mcui
LAST DEPLOYED: Wed Apr 17 19:45:58 2024
NAMESPACE: mcui
STATUS: deployed
REVISION: 11
NOTES:
1. Get the application URL by running these commands:
  http://firn.local/
```

You can now edit the MetacatUI files and changes will be immediately visible in your chart. You will likely need to edit the `config.js` file to get a minimal setup working.  For example, I used the `config/config.js` with these contents:

```javascript
MetacatUI.AppConfig = {
      root: "/",
      baseUrl: "https://dev.nceas.ucsb.edu/knb/d1/mn"
}
```

