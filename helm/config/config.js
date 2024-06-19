MetacatUI.AppConfig = {
  {{- $ignoreList := list "enabled" "root" "baseUrl" "metacatContext" "d1CNBaseUrl" -}}
  {{- range $key, $value := .Values.appConfig }}
      {{- if not (has $key $ignoreList) }}
          {{- if eq (typeOf $value) "string" }}
              {{- $key | nindent 4 }}: {{ $value | quote }},
          {{- else }}
              {{- $key | nindent 4 }}: {{ $value }},
          {{- end }}
      {{- end }}
  {{- end -}}
  {{- include "metacatui.cn.url" . | nindent 4 }}
  theme: {{ required "theme_is_REQUIRED" .Values.appConfig.theme | quote }},
  root: {{ required "root_is_REQUIRED" .Values.appConfig.root | quote }},
  metacatContext: {{ required "metacatAppContext_is_REQUIRED" .Values.global.metacatAppContext | quote }},
  baseUrl: {{ required "metacatExternalBaseUrl_is_REQUIRED"  .Values.global.metacatExternalBaseUrl | quote }}
}
