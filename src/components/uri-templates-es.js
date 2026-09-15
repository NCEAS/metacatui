"use strict";

/*
 * uri-templates-es
 * https://github.com/lagoshny/uri-templates-es
 *
 * Copyright (c) Ilya Lagoshny
 *
 * Licensed under the MIT License:
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * Vendored AMD wrapper for uri-templates-es.
 *
 * Why this file exists:
 * - MetacatUI browser code uses RequireJS/AMD modules.
 * - uri-templates-es ships ESM, so we wrap it for AMD loading.
 *
 * Source:
 * - npm package: uri-templates-es
 * - pinned version: 2.0.2
 * - upstream file: node_modules/uri-templates-es/dist/uri-templates-es/index.js
 */

define([], () => {
// main/src/lib/uri-template.ts
var _UriTemplate = class _UriTemplate {
  constructor(template) {
    this.template = template;
    var _a, _b;
    const parts = template.split("{");
    this.textParts = [(_a = parts.shift()) != null ? _a : ""];
    this.prefixes = [];
    this.substitutions = [];
    this.unSubstitutions = [];
    let varNames = [];
    while (parts.length > 0) {
      const part = (_b = parts.shift()) != null ? _b : "";
      const spec = part.split("}")[0];
      const remainder = part.substring(spec.length + 1);
      const funcs = this.uriTemplateSubstitution(spec);
      this.substitutions.push(funcs.substitution);
      this.unSubstitutions.push(funcs.unSubstitution);
      this.prefixes.push(funcs.prefix);
      this.textParts.push(remainder);
      varNames = varNames.concat(funcs.substitution.varNames);
    }
  }
  fill(valueFunction) {
    const valueFn = typeof valueFunction === "function" ? valueFunction : (varName) => valueFunction[varName];
    let result = this.textParts[0];
    for (let i = 0; i < this.substitutions.length; i++) {
      const substitution = this.substitutions[i];
      result += substitution(valueFn);
      result += this.textParts[i + 1];
    }
    return result;
  }
  fillFromObject(obj) {
    return this.fill(obj);
  }
  fromUri(substituted) {
    const result = {};
    for (let i = 0; i < this.textParts.length; i++) {
      const part = this.textParts[i];
      if (substituted.substring(0, part.length) !== part) {
        return void 0;
      }
      substituted = substituted.substring(part.length);
      if (i >= this.textParts.length - 1) {
        if (substituted === "") {
          break;
        } else {
          return void 0;
        }
      }
      let nextPart = this.textParts[i + 1];
      let offset = i;
      let stringValue;
      while (true) {
        if (offset === this.textParts.length - 2) {
          const endPart = substituted.substring(substituted.length - nextPart.length);
          if (endPart !== nextPart) {
            return void 0;
          }
          stringValue = substituted.substring(0, substituted.length - nextPart.length);
          substituted = endPart;
        } else if (nextPart) {
          const nextPartPos = substituted.indexOf(nextPart);
          stringValue = substituted.substring(0, nextPartPos);
          substituted = substituted.substring(nextPartPos);
        } else if (this.prefixes[offset + 1]) {
          let nextPartPos = substituted.indexOf(this.prefixes[offset + 1]);
          if (nextPartPos === -1) nextPartPos = substituted.length;
          stringValue = substituted.substring(0, nextPartPos);
          substituted = substituted.substring(nextPartPos);
        } else if (this.textParts.length > offset + 2) {
          offset++;
          nextPart = this.textParts[offset + 1];
          continue;
        } else {
          stringValue = substituted;
          substituted = "";
        }
        break;
      }
      this.unSubstitutions[i](stringValue, result);
    }
    return result;
  }
  toString() {
    return this.template;
  }
  uriTemplateSubstitution(spec) {
    let modifier = "";
    if (_UriTemplate.uriTemplateGlobalModifiers[spec.charAt(0)]) {
      modifier = spec.charAt(0);
      spec = spec.substring(1);
    }
    let separator = "";
    let prefix = "";
    let shouldEscape = true;
    let showVariables = false;
    let trimEmptyString = false;
    if (modifier === "+") {
      shouldEscape = false;
    } else if (modifier === ".") {
      prefix = ".";
      separator = ".";
    } else if (modifier === "/") {
      prefix = "/";
      separator = "/";
    } else if (modifier === "#") {
      prefix = "#";
      shouldEscape = false;
    } else if (modifier === ";") {
      prefix = ";";
      separator = ";";
      showVariables = true;
      trimEmptyString = true;
    } else if (modifier === "?") {
      prefix = "?";
      separator = "&";
      showVariables = true;
    } else if (modifier === "&") {
      prefix = "&";
      separator = "&";
      showVariables = true;
    }
    const varNames = [];
    const varList = spec.split(",");
    const varSpecs = [];
    const varSpecMap = {};
    for (let i = 0; i < varList.length; i++) {
      let varName = varList[i];
      let truncate = null;
      if (varName.indexOf(":") !== -1) {
        const parts = varName.split(":");
        varName = parts[0];
        truncate = parseInt(parts[1], 10);
      }
      const suffices = {};
      while (_UriTemplate.uriTemplateSuffices[varName.charAt(varName.length - 1)]) {
        const lastChar = varName.charAt(varName.length - 1);
        suffices[lastChar] = true;
        varName = varName.substring(0, varName.length - 1);
      }
      const varSpec = {
        truncate,
        name: varName,
        suffices
      };
      varSpecs.push(varSpec);
      varSpecMap[varName] = varSpec;
      varNames.push(varName);
    }
    const subFunction = (function(valueFunction) {
      let result = "";
      let startIndex = 0;
      for (let i = 0; i < varSpecs.length; i++) {
        const varSpec = varSpecs[i];
        let value = valueFunction(varSpec.name);
        if (value == null || Array.isArray(value) && value.length === 0 || typeof value === "object" && Object.keys(value).length === 0) {
          startIndex++;
          continue;
        }
        if (i === startIndex) {
          result += prefix;
        } else {
          result += separator || ",";
        }
        if (Array.isArray(value)) {
          if (showVariables) {
            result += varSpec.name + "=";
          }
          for (let j = 0; j < value.length; j++) {
            if (j > 0) {
              result += varSpec.suffices["*"] ? separator || "," : ",";
              if (varSpec.suffices["*"] && showVariables) {
                result += varSpec.name + "=";
              }
            }
            result += shouldEscape ? encodeURIComponent(value[j]).replace(/!/g, "%21") : _UriTemplate.notReallyPercentEncode(value[j]);
          }
        } else if (typeof value === "object") {
          if (showVariables && !varSpec.suffices["*"]) {
            result += varSpec.name + "=";
          }
          let first = true;
          for (const key in value) {
            if (!first) {
              result += varSpec.suffices["*"] ? separator || "," : ",";
            }
            first = false;
            result += shouldEscape ? encodeURIComponent(key).replace(/!/g, "%21") : _UriTemplate.notReallyPercentEncode(key);
            result += varSpec.suffices["*"] ? "=" : ",";
            result += shouldEscape ? encodeURIComponent(value[key]).replace(/!/g, "%21") : _UriTemplate.notReallyPercentEncode(value[key]);
          }
        } else {
          if (showVariables) {
            result += varSpec.name;
            if (!trimEmptyString || value !== "") {
              result += "=";
            }
          }
          if (varSpec.truncate != null) {
            value = value.substring(0, varSpec.truncate);
          }
          result += shouldEscape ? encodeURIComponent(value).replace(/!/g, "%21") : _UriTemplate.notReallyPercentEncode(value);
        }
      }
      return result;
    });
    const guessFunction = function(stringValue, resultObj) {
      if (prefix) {
        if (stringValue.substring(0, prefix.length) === prefix) {
          stringValue = stringValue.substring(prefix.length);
        } else {
          return null;
        }
      }
      if (varSpecs.length === 1 && varSpecs[0].suffices["*"]) {
        const varSpec = varSpecs[0];
        const varName = varSpec.name;
        let arrayValue = varSpec.suffices["*"] ? stringValue.split(separator || ",") : [stringValue];
        let hasEquals = shouldEscape && stringValue.indexOf("=") !== -1;
        for (let i = 1; i < arrayValue.length; i++) {
          const sv = arrayValue[i];
          if (hasEquals && sv.indexOf("=") === -1) {
            arrayValue[i - 1] += (separator || ",") + sv;
            arrayValue.splice(i, 1);
            i--;
          }
        }
        for (let i = 0; i < arrayValue.length; i++) {
          let sv = arrayValue[i];
          if (shouldEscape && sv.indexOf("=") !== -1) {
            hasEquals = true;
          }
          const innerArrayValue = sv.split(",");
          for (let j = 0; j < innerArrayValue.length; j++) {
            if (shouldEscape) {
              innerArrayValue[j] = decodeURIComponent(innerArrayValue[j]);
            }
          }
          if (innerArrayValue.length === 1) {
            arrayValue[i] = innerArrayValue[0];
          } else {
            arrayValue[i] = innerArrayValue;
          }
        }
        if (showVariables || hasEquals) {
          const objectValue = resultObj[varName] || {};
          for (let j = 0; j < arrayValue.length; j++) {
            let innerValue = stringValue;
            if (showVariables && !innerValue) {
              continue;
            }
            let innerVarName;
            if (typeof arrayValue[j] === "string") {
              let sv = arrayValue[j];
              innerVarName = sv.split("=", 1)[0];
              sv = sv.substring(innerVarName.length + 1);
              innerValue = sv;
            } else if (Array.isArray(arrayValue[j])) {
              const arr = arrayValue[j];
              let sv = arr[0];
              innerVarName = sv.split("=", 1)[0];
              sv = sv.substring(innerVarName.length + 1);
              arr[0] = sv;
              innerValue = arr;
            } else {
              continue;
            }
            if (objectValue[innerVarName] !== void 0) {
              if (Array.isArray(objectValue[innerVarName])) {
                objectValue[innerVarName].push(innerValue);
              } else {
                objectValue[innerVarName] = [objectValue[innerVarName], innerValue];
              }
            } else {
              objectValue[innerVarName] = innerValue;
            }
          }
          if (Object.keys(objectValue).length === 1 && objectValue[varName] !== void 0) {
            resultObj[varName] = objectValue[varName];
          } else {
            resultObj[varName] = objectValue;
          }
        } else {
          if (resultObj[varName] !== void 0) {
            if (Array.isArray(resultObj[varName])) {
              resultObj[varName] = resultObj[varName].concat(arrayValue);
            } else {
              resultObj[varName] = [resultObj[varName]].concat(arrayValue);
            }
          } else {
            if (arrayValue.length === 1 && !varSpec.suffices["*"]) {
              resultObj[varName] = arrayValue[0];
            } else {
              resultObj[varName] = arrayValue;
            }
          }
        }
      } else {
        const arrayValue = varSpecs.length === 1 ? [stringValue] : stringValue.split(separator || ",");
        const specIndexMap = {};
        for (let i = 0; i < arrayValue.length; i++) {
          let firstStarred = 0;
          for (; firstStarred < varSpecs.length - 1 && firstStarred < i; firstStarred++) {
            if (varSpecs[firstStarred].suffices["*"]) {
              break;
            }
          }
          if (firstStarred === i) {
            specIndexMap[i] = i;
            continue;
          } else {
            for (let lastStarred = varSpecs.length - 1; lastStarred > 0 && varSpecs.length - lastStarred < arrayValue.length - i; lastStarred--) {
              if (varSpecs[lastStarred].suffices["*"]) {
                break;
              }
              if (varSpecs.length - lastStarred === arrayValue.length - i) {
                specIndexMap[i] = lastStarred;
              }
            }
          }
          specIndexMap[i] = firstStarred;
        }
        for (let i = 0; i < arrayValue.length; i++) {
          let sv = arrayValue[i];
          if (!sv && showVariables) {
            continue;
          }
          const innerArrayValue = sv.split(",");
          let varSpec;
          let varName;
          if (showVariables) {
            sv = innerArrayValue[0];
            varName = sv.split("=", 1)[0];
            sv = sv.substring(varName.length + 1);
            innerArrayValue[0] = sv;
            varSpec = varSpecMap[varName] || varSpecs[0];
          } else {
            varSpec = varSpecs[specIndexMap[i]];
            varName = varSpec.name;
          }
          for (let j = 0; j < innerArrayValue.length; j++) {
            if (shouldEscape) {
              innerArrayValue[j] = decodeURIComponent(innerArrayValue[j]);
            }
          }
          if ((showVariables || varSpec.suffices["*"]) && resultObj[varName] !== void 0) {
            if (Array.isArray(resultObj[varName])) {
              resultObj[varName] = resultObj[varName].concat(innerArrayValue);
            } else {
              resultObj[varName] = [resultObj[varName]].concat(innerArrayValue);
            }
          } else {
            if (innerArrayValue.length === 1 && !varSpec.suffices["*"]) {
              resultObj[varName] = innerArrayValue[0];
            } else {
              resultObj[varName] = innerArrayValue;
            }
          }
        }
      }
    };
    subFunction.varNames = varNames;
    return {
      prefix,
      substitution: subFunction,
      unSubstitution: guessFunction
    };
  }
  static notReallyPercentEncode(str) {
    return encodeURI(str).replace(/%25[0-9][0-9]/g, (doubleEncoded) => {
      return "%" + doubleEncoded.substring(3);
    });
  }
};
_UriTemplate.uriTemplateGlobalModifiers = {
  "+": true,
  "#": true,
  ".": true,
  "/": true,
  ";": true,
  "?": true,
  "&": true
};
_UriTemplate.uriTemplateSuffices = {
  "*": true
};
var UriTemplate = _UriTemplate;


  return { UriTemplate };
});
