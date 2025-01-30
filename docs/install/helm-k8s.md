# Helm Install on Kubernetes (Local or Remote)

As a simpler alternative to deploying in traditional server environments, MetacatUI can be installed on a Kubernetes cluster, using Helm to simplify deployment. This facilitates evaluation or development, either on a local machine, or on a remote Kubernetes cluster.

(For more background information, see [Appendix 1: Brief Overview of Images, Containers, Kubernetes and Helm](#appendix-1-brief-overview-of-images-containers-kubernetes-and-helm), below)

## Prerequisites

You will need `helm`, `docker` and `kubectl` already installed and running on your local machine, along with access to a Kubernetes cluster.

- We recommend installing [Rancher Desktop](https://rancherdesktop.io/), which provides `helm`, `docker` and `kubectl` functionality, in addition to creating a Kubernetes cluster on your local machine (see `Preferences->Kubernetes->Enable Kubernetes`).
- If you are instead deploying to a remote Kubernetes cluster, make sure you have the necessary permissions to deploy to that cluster (and also install Rancher Desktop to your local machine, to provide the necessary tools).
- Ensure you are using the correct Kubernetes context, so you deploy to the right place. Use `kubectl config get-contexts` to see all the available contexts, and `kubectl config use-context <contextname>` to switch to the correct one; for example:

  ```shell
  kubectl config use-context "rancher-desktop"
  ```

The steps are the same for installing on either a local Machine or on a remote cluster:

## Step 1. Install the Helm chart

a. Easiest: using a specific release version from GitHub (e.g. v1.0.2 - see ["Recent tagged image versions" on GitHub](https://github.com/NCEAS/metacatui/pkgs/container/charts%2Fmetacatui) to find the latest).

```shell
helm install mcui oci://ghcr.io/nceas/charts/metacatui --version 1.0.2
```

b. Alternatively, if you want to deploy from the latest source code, you can clone the repository from GitHub and use the latest helm chart to install:

> **⚠️ _CAUTION_**: _Not an official release - do not use in production_

```shell
# clone the repo, cd to it, and check out the develop branch
git clone https://github.com/NCEAS/metacatui.git
cd metacatui
git switch develop

# helm install with the local path to the helm chart
helm install mcui ./helm
```

## Step 2. Start Port forwarding

This will map port 80 of the K8s deployment to port 8080 on your local machine. Do this in a separate terminal window, so you can leave it running:

```shell
# Assumes your deployment is named 'mcui', but you can check with `kubectl get services`
kubectl port-forward service/mcui-metacatui 8080:80
```

After waiting a few seconds for the release to get up and running, use your browser to view MetacatUI at [http://localhost:8080/](http://localhost:8080/), where you should see MetacatUI using the KNB theme.

> _**NOTE**: You have not yet provided details of an existing Metacat back-end for MetacatUI to contact, so you will therefore see an error message on [the search page](http://localhost:8080/data), saying `Something went wrong while getting the list of datasets` - this is expected, and can be ignored._ However, if you want to resolve this...

## Step 3. Override Some Configuration Values

Create a file (named `my-values.yaml`), and add the following content. Helm will use these values to override the corresponding ones in the default `values.yaml`. The rest will remain unchanged:

```yaml
global:
 metacatUiThemeName: "arctic"
 metacatExternalBaseUrl: "https://dev.nceas.ucsb.edu/"
 metacatAppContext: "knb"
 d1ClientCnUrl: "https://cn-stage.test.dataone.org/cn"
```

## Step 4. Upgrade the Release, with the New Values:

```shell
helm upgrade mcui  -f my-values.yaml  oci://ghcr.io/nceas/charts/metacatui --version 1.0.2
# or if deploying from the local repo, use ./helm instead of oci://... and --version (see Step 1)
```

Ensure port-forwarding is still running (see Step 2), and you should simply be able to refresh your browser to see the updated version at [http://localhost:8080/](http://localhost:8080/). You should now see MetacatUI using the Arctic Data Center theme, and [the search page](http://localhost:8080/data) should be populated with test data from [https://dev.nceas.ucsb.edu/](https://dev.nceas.ucsb.edu/data)

> _**TIP:** the `upgrade` command **should** restart the metacatui pod, if settings have changed since the previous release. However, sometimes this may not work as expected, and you may need to `delete` the pod manually, thus prompting K8s to re-create it with the new settings._

> You can check the status of the pods with `kubectl get pods`:
>
> ```shell
> $ kubectl get pods
> NAME                               READY   STATUS    RESTARTS   AGE
> mcui-metacatui-557545c55-tk7wg     1/1     Running   0          3m24s
> ```
>
> If the `AGE` does not reflect your most-recent `helm upgrade`, you may need to delete the pod with `kubectl delete pod <podname>`:
>
> ```shell
> kubectl delete pod mcui-metacatui-557545c55-tk7wg    ## copy your pod name from above
> ```
>
> ...and then monitor the new pod startup using `kubectl get pods` again, until you see `READY` change from `0/1` to `1/1`.
>
> Alternatively, instead of using `helm upgrade`, you can delete the release with `helm delete mcui`, and then re-install it with the original `helm install` command.

## Configuration

> _**NOTE**: Complete documentation for configuring the Helm chart can be found in the [Helm README file](https://github.com/NCEAS/metacatui/blob/main/helm/README.md), and within the comments in the [values.yaml file](https://github.com/NCEAS/metacatui/blob/main/helm/values.yaml)._

The Helm chart supports the following different configuration options:

### Setting or Overriding MetacatUI's config.js values

See the [`AppConfig` documentation](../docs/AppConfig.html) for all the available MetacatUI config options.

- Any entries of the form `key: stringValue`, or `key: intValue` provided in the `appConfig:` section of `values.yaml` will be automatically incorporated into MetacatUI's `config.js` file, overriding any existing entries with the same name. Example:

  ```yaml
  appConfig:
    temporaryMessage: "<h5>THIS IS A TEST SITE! DO NOT USE FOR VALUABLE DATASETS!</h5>"
    temporaryMessageStartTime: new Date("2020-06-16T13:30:00")
    temporaryMessageEndTime: new Date("2222-06-16T13:30:00")
    showDatasetPublicToggle: true
    showDatasetPublicToggleForSubjects: []
  ```

> _**NOTE**: There are a few specific values (such as the `theme`, `root`, `baseUrl` etc) which must NOT be set in the `appConfig:` section of `values.yaml`, but should instead be set in the `global:` section (and with different names, e.g. `metacatUiThemeName`, `metacatUiWebRoot`, `metacatExternalBaseUrl` etc.). Please see the related comments in the [values.yaml file](https://github.com/NCEAS/metacatui/blob/main/helm/values.yaml) for specific details._

- If you need to provide more-complex overrides, you can set:

  ```yaml
  appConfig:
    enabled: false
  ```

  ...and manually create your own configMap named `<YourReleaseName>-metacatui-config-js`, containing your complete custom config.js file:

  ```shell
  kubectl create configmap  <yourReleaseName>-metacatui-config-js \
            --from-file=config.js=<yourCustomConfig.js>
  ```

### Using a Custom Theme

- If you wish to deploy MetacatUI with your own custom theme, instead of using one of the themes that are provided, see [the Helm README section on "Using a Custom Theme"](https://github.com/NCEAS/metacatui/blob/main/helm/README.md#using-a-custom-theme).
- See [the MetacatUI documentation](/install/configuration/index.html) for help with creating custom themes.

### Development on Localhost

You can set up the chart to use your own copy of the MetacatUI source files on your local machine, thus allowing you to edit the source files, and have changes be immediately visible in the browser. See the [Helm README section on "Development on Localhost"](https://github.com/NCEAS/metacatui/blob/main/helm/README.md#development-on-localhost) for details.

---

## Useful links

- [Helm Documentation](https://helm.sh/docs/)
- [MetacatUI Helm Chart - latest source code (`develop` branch)](https://github.com/NCEAS/metacatui/tree/develop/helm)
- [MetacatUI Helm Chart Releases](https://github.com/NCEAS/metacatui/releases?q=%22MetacatUI+Helm+chart%22&expanded=true)
- ["Learn Kubernetes Basics" at kubernetes.io](https://kubernetes.io/docs/tutorials/kubernetes-basics/)
- ["Foundations of Docker" at docker.com](https://docs.docker.com/get-started/#foundations-of-docker) - skip downloading docker desktop, if you already have Rancher Desktop installed.

---

## Appendix 1: Brief Overview of Images, Containers, Kubernetes and Helm

**Helm** is a package manager that uses pre-configured “Helm charts” to simplify deployment of **containerized applications** to a **Kubernetes cluster**.

### Images and Containers

An **image** is essentially a blueprint or template that defines how to create a new container. Think of it like a recipe book - just as a recipe tells you how to make a specific dish, an image provides the instructions for creating a container with a specific set of characteristics, such as which software packages are installed.

A **container** is the actual instance of an image that's running and executing code. It's a lightweight, portable, and isolated execution environment that packages an application and its dependencies together, allowing consistent deployment across different computing platforms and environments. Once you create a container from an image, it can run independently and be managed separately. Containers can be run on any machine that has the container runtime installed, regardless of the underlying operating system or hardware.

**Docker** is an example of an open-source platform for developing, shipping, and running these images and containers. Many images are available on [Docker Hub](https://hub.docker.com/), a public registry for Docker images.

#### Simple example of running a container on a local machine:

Ensure you already installed Rancher Desktop - see [Prerequisites](#prerequisites), above - and then type `docker run hello-world` to run the example "hello-world" container, and you should see the following:

```shell
$ docker run hello-world
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
c9c5fd25a1bd: Pull complete
Digest: sha256:d715f14f9eca81473d9112df50457893aa4d099adeb4729f679006bf5ea12407
Status: Downloaded newer image for hello-world:latest

Hello from Docker!
This message shows that your installation appears to be working correctly.

To generate this message, Docker took the following steps:
 1. The Docker client contacted the Docker daemon.
 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.
    (arm64v8)
 3. The Docker daemon created a new container from that image which runs the
    executable that produces the output you are currently reading.
 4. The Docker daemon streamed that output to the Docker client, which sent it
    to your terminal.
```

(Also see ["Foundations of Docker" at docker.com](https://docs.docker.com/get-started/#foundations-of-docker) - skip downloading docker desktop, if you already have Rancher Desktop installed.)

### Kubernetes

Kubernetes is an open-source tool that helps you run and manage multiple containers together efficiently, deployed across a **cluster** of worker machines called **nodes**. It takes care of deploying, scaling, and keeping your containerized applications running smoothly, allowing you to focus on building or using your software, rather than dealing with infrastructure complexities. Kubernetes is also known as "K8s" (the "8" representing the number of letters between the "K" and the "s")

#### Key Features

- **Pods**: The smallest deployable units in Kubernetes are named **Pods**. Each pod may contain one or more **containers**.
- **Automated deployment**: Kubernetes handles the deployment of these pods across a **cluster** of worker machines called **nodes**, ensuring efficient resource allocation.
- **Scaling**: It automatically scales applications up or down based on demand, optimizing resource usage.
- **Self-healing**: Kubernetes monitors container health and automatically restarts failed containers or reschedules them when nodes fail.
- **Load balancing**: It distributes network traffic to ensure stable application performance.
- **Storage orchestration**: Kubernetes can automatically mount storage systems of your choice, whether from local storage, public cloud providers, or network storage systems.
- **Secrets and configuration management**: Kubernetes lets you store and manage configuration details (including sensitive information, such as passwords etc.), separately from your container image.

(Also see ["Learn Kubernetes Basics" at kubernetes.io](https://kubernetes.io/docs/tutorials/kubernetes-basics/))

While Kubernetes greatly simplifies deployment, many manual steps may still be required in order to deploy and manage applications, especially those with many components. This is where **Helm** comes in...

### Helm

Helm is a package manager for Kubernetes. It uses pre-configured packages called “Helm charts” to provide a consistent and repeatable method of packaging, configuring, deploying and upgrading complex applications, often with zero downtime.
(You can think of it as the K8s equivalent of `Homebrew`, `apt`, or `WinGet`.)

Many ready-made charts are publicly available in various Helm Repositories. Examples include:

- [The Artifact Hub](https://artifacthub.io/packages/search?kind=0&sort=relevance&page=1) - publicly-available charts from many repos
- [The Bitnami Library for Kubernetes](https://github.com/bitnami/charts/tree/main/bitnami)

#### Basic Helm Commands

```shell
# install a chart
helm install <releasename> <chartname>

# makes changes on the fly, often with zero downtime, and increments the release version
helm upgrade <releasename> <chartname>

# delete a release
helm delete <releasename>
```

(Also see the [Helm Documentation](https://helm.sh/docs/))

[⭡ Back to top](#helm-install-on-kubernetes-local-or-remote)
