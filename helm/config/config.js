MetacatUI.AppConfig = {
  {{- $ignoreList := list "enabled" "root" "baseUrl" -}}
  {{- range $key, $value := .Values.appConfig }}
      {{- if not (has $key $ignoreList) }}
          {{- if eq (typeOf $value) "string" }}
              {{- $key | nindent 4 }}: {{ $value | quote }},
          {{- else }}
              {{- $key | nindent 4 }}: {{ $value }},
          {{- end }}
      {{- end }}
  {{- end -}}
  {{/* These go last, so we can handle the trailing comma */}}
  root: {{ required "root is REQUIRED" .Values.appConfig.root | quote }},
  baseUrl: {{ required "baseUrl is REQUIRED" .Values.appConfig.baseUrl | quote }}
}
