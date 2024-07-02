# MetacatUI Helm chart

This is a helm chart for deploying MetacatUI.

---
## Deployment in a Kubernetes cluster:

1. Modify values.yaml as appropriate
2. install the helm chart:
    ```shell
    $ helm -n knb upgrade --install knbmcui ./helm
    ```

There's no need to set up any persistent storage, unless you wish to add your own theme. The chart
ships with [a few pre-defined themes](https://github.com/NCEAS/metacatui/tree/main/src/js/themes),
which can be selected in values.yaml.

---
## MetacatUI Configuration Files ('config.js')

The k8s version of Metacatui requires two 'config.js' configuration files:
1. the "root config" at the path `{root}/config/config.js`, and
2. the "theme config" in the theme directory itself (for example, see the knb `config.js` at:
    https://github.com/NCEAS/metacatui/blob/main/src/js/themes/knb/config.js)

The "root config" file must, at an absolute minimum, contain the name of the theme to be used; e.g:

```javascript
MetacatUI.AppConfig = {
  theme: "knb",
};
```
...and metacatui will then load that theme and the corresponding "theme config".

If any additional settings are defined in the "root config", Metacatui will use them to override
corresponding settings in the "theme config".

By default, this chart creates a simple "root config", which will contain any values of the form:
`key: stringValue,` or `key: intValue,` that are provided in the `appConfig:` section of
[values.yaml](./values.yaml).

If you need to provide more-complex overrides, set `appConfig.enabled: false`, and manually
create your own configMap named `<YourReleaseName>-metacatui-config-js`, containing your custom
config.js:
```shell
kubectl create configmap  <yourReleaseName>-metacatui-config-js \
        --from-file=config.js=<yourCustomConfig.js>
```
---

## Using a Custom Theme

See [the MetacatUI
documentation](https://nceas.github.io/metacatui/install/configuration/index.html) for help with
creating custom themes.

If you wish to deploy MetacatUI with your own custom theme, instead of using one of the themes that
are bundled with metacatui, you will need to provide the files for that theme (including its
"theme config" file) on shared filesystem, accessed via a manually-created Persistent Volume (PV)
mount and a Persistent Volume Claim (PVC). Example files for creating PVs and PVCs are provided
in the [admin](./admin) directory.

Once you've got the chart deployed (see above), next steps are:

1. Copy your theme files to a directory on a filesystem that is accessible from your Kubernetes
   cluster
2. Create a Persistent Volume (PV) pointing to the correct directory on the filesystem
3. Create a PVC for the PV, and edit the `customTheme:` section in values.yaml
4. upgrade the helm chart
   ```shell
   $ helm -n knb upgrade --install knbmcui ./helm

---

## Development on Localhost

(e.g. Rancher Desktop/Docker Desktop)

1. Create a namespace for the deployment (e.g. `mcui`)
2. Create a PV that is mapped to a local `hostPath` directory containing the source code
3. Create a PVC for the PV
4. Modify values.yaml:
   1. Add the name of the PVC, so MetacatUI can find the files
   2. Set your hostname for the Ingress definition
5. install the helm chart:
   ```shell
   $ helm -n mcui upgrade --install --debug mcui ./helm
   Release "mcui" has been upgraded. Happy Helming!
   NAME: mcui
   LAST DEPLOYED: Wed Apr 17 19:45:58 2024
   NAMESPACE: mcui
   STATUS: deployed
   REVISION: 11
   ...etc

You can now edit the MetacatUI source files, and changes will be immediately visible in your k8s
deployment.

You will likely need to edit the `config.js` file to get a minimal setup working. Example contents
for `config/config.js`:

```javascript
MetacatUI.AppConfig = {
      root: "/",
      baseUrl: "https://dev.nceas.ucsb.edu/knb/d1/mn"
}
```
