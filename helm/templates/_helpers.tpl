{{/*
Expand the name of the chart.
*/}}
{{- define "metacatui.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "metacatui.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "metacatui.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "metacatui.labels" -}}
helm.sh/chart: {{ include "metacatui.chart" . }}
{{ include "metacatui.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "metacatui.selectorLabels" -}}
app.kubernetes.io/name: {{ include "metacatui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "metacatui.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "metacatui.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Populate the dataone cn url
*/}}
{{- define "metacatui.cn.url" -}}
{{- $d1ClientCnUrl := .Values.global.d1ClientCnUrl }}
{{- if $d1ClientCnUrl }}
{{- if not (hasSuffix "/" $d1ClientCnUrl) -}}
  {{- $d1ClientCnUrl = print $d1ClientCnUrl "/" -}}
{{- end -}}
{{- $baseCnURL := regexFind "http.?://[^/]*/" $d1ClientCnUrl }}
{{- if not $baseCnURL -}}
d1CNBaseUrl: "ERROR_IN_URL__{{ $d1ClientCnUrl }}",
{{- else -}}
d1CNBaseUrl: "{{ $baseCnURL }}",
{{- end }}
{{- end }}
{{- end }}

{{/*
Remove trailing slash from root, if it exists
*/}}
{{- define "metacatui.clean.root" -}}
{{- $cleanedRoot := regexReplaceAll "/$" .Values.appConfig.root "" -}}
{{- $cleanedRoot }}
{{- end }}

{{/*
generate file path for the web root mount
*/}}
{{- define "metacatui.root.mountpath" -}}
/usr/share/nginx/html{{ include "metacatui.clean.root" . }}
{{- end }}
