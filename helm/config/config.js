MetacatUI.AppConfig = {
    root: {{ .Values.appConfig.root | quote }},
    theme: {{ .Values.appConfig.theme | quote }},
    baseUrl: {{ .Values.appConfig.baseUrl | quote }}
    {{/* Add any new keys to these lists, and they will be populated automatically if set */}}
    {{- $optionalStringValues := list
        "d1CNBaseUrl"
        "mapKey"
        "mdqBaseUrl"
        "dataoneSearchUrl"
        "googleAnalyticsKey"
        "bioportalAPIKey"
        "cesiumToken"
    -}}
    {{- $optionalIntValues := list
        "portalLimit"
    -}}
    {{- range $key, $value := .Values.appConfig }}
        {{- if has $key $optionalStringValues }}
            {{- (printf ",") }}
            {{- (printf "%s: \"%s\"" $key (toString $value)) | nindent 6 }}
        {{- else }}
            {{- if has $key $optionalIntValues }}
                {{- (printf ",") }}
                {{- (printf "%s: %s" $key (toString $value)) | nindent 6 }}
            {{- end }}
        {{- end }}
    {{- end }}
}
