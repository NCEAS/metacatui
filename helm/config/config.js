MetacatUI.AppConfig = {
  {{- $ignoreList := list "enabled" "theme" "root" "baseUrl" "metacatContext" "d1CNBaseUrl" -}}
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
  theme: {{ required "metacatUiThemeName_is_REQUIRED" .Values.global.metacatUiThemeName | quote }},
  root: {{ required "root_is_REQUIRED" .Values.global.metacatUiWebRoot | quote }},
  metacatContext: {{ required "metacatAppContext_is_REQUIRED" .Values.global.metacatAppContext | quote }},
  baseUrl: {{ required "metacatExternalBaseUrl_is_REQUIRED"  .Values.global.metacatExternalBaseUrl | quote }}
}
