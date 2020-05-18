/**
 *   MetacatUI
 *   https://github.com/NCEAS/metacatui
 *   MetacatUI is a client-side web interface for querying Metacat servers and other servers that implement the DataONE REST API.
 **/

// Step 1: Find the data-theme specified in the script include
var MetacatUI = MetacatUI || {};
MetacatUI.theme = document.getElementById("loader").getAttribute("data-theme");
MetacatUI.metacatContext = document.getElementById("loader").getAttribute("data-metacat-context");
MetacatUI.mapKey = document.getElementById("loader").getAttribute("data-map-key");
if ( (MetacatUI.mapKey == "YOUR-GOOGLE-MAPS-API-KEY") || (!MetacatUI.mapKey) ) {
    MetacatUI.mapKey = null;
}
MetacatUI.useD3 = true;

// Find out of MetacatUI is deployed in a sub-directory off the top level of
// the domain. This value is used throughout the app to determin the location
// of assets and, if not set correctly, a lot of things break. Your web server
// should also set a FallbackResource directive accordingly in order to support
// users entering MetacatUI from URLs other than the root
MetacatUI.root = "/metacatui"
// Remove trailing slash if one is present
MetacatUI.root = MetacatUI.root.replace(/\/$/, "");

//This version of Metacat UI - used for cache busting
MetacatUI.metacatUIVersion = "2.11.4";

MetacatUI.loadTheme = function(theme) {
    var script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.setAttribute("src", MetacatUI.root + "/js/themes/" + theme + "/config.js?v=" + MetacatUI.metacatUIVersion);
    document.getElementsByTagName("body")[0].appendChild(script);

    script.onload = function(){
	    //If this theme has a custom function to start the app, then use it
	    if(typeof MetacatUI.customInitApp == "function") {
            MetacatUI.customInitApp();
        }
	    //Start the app
	    else MetacatUI.initApp();
    }
}
MetacatUI.initApp = function () {
    var script = document.createElement("script");
    script.setAttribute("data-main", MetacatUI.root + "/js/app.js?v=" + MetacatUI.metacatUIVersion);
    script.src = MetacatUI.root + "/components/require.js";
    document.getElementsByTagName("body")[0].appendChild(script);
}


// Fix compatibility issues with mainly IE 8 and earlier. Do this before the rest of the app loads since even common
// functions are missing, such as console.log
MetacatUI.preventCompatibilityIssues = function(){
	// Detecting IE
	function isIE () {
		  var myNav = navigator.userAgent.toLowerCase();
		  return (myNav.indexOf('msie') != -1) ? parseInt(myNav.split('msie')[1]) : false;
	}
	//If IE 8 or earlier, don't use D3
	if (isIE() && (isIE() < 9)) MetacatUI.useD3 = false;


	/* Add trim() function for IE*/
	if(typeof String.prototype.trim !== 'function') {
		  String.prototype.trim = function() {
		    return this.replace(/^\s+|\s+$/g, '');
		  }
	}

	/* Polyfill for startsWith() - IE 8 and earlier */
	if (!String.prototype.startsWith) {
		  String.prototype.startsWith = function(searchString, position) {
		    position = position || 0;
		    return this.indexOf(searchString, position) === position;
		  };
	}

	/* Polyfill for endsWith() - IE 8 and earlier */
	if (!String.prototype.endsWith) {
		  String.prototype.endsWith = function(searchString, position) {
		      var subjectString = this.toString();
		      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
		        position = subjectString.length;
		      }
		      position -= searchString.length;
		      var lastIndex = subjectString.indexOf(searchString, position);
		      return lastIndex !== -1 && lastIndex === position;
		  };
	}

	/* POlyfill for Array.isArray() - IE 8 and earlier */
	if (!Array.isArray) {
		  Array.isArray = function(arg) {
		    return Object.prototype.toString.call(arg) === '[object Array]';
		  };
	}

	/**
	 * Protect window.console method calls, e.g. console is not defined on IE
	 * unless dev tools are open, and IE doesn't define console.debug
	 */
	(function() {
	  if (!window.console) {
	    window.console = {};
	  }
	  // union of Chrome, FF, IE, and Safari console methods
	  var m = [
	    "log", "info", "warn", "error", "debug", "trace", "dir", "group",
	    "groupCollapsed", "groupEnd", "time", "timeEnd", "profile", "profileEnd",
	    "dirxml", "assert", "count", "markTimeline", "timeStamp", "clear"
	  ];
	  // define undefined methods as noops to prevent errors
	  for (var i = 0; i < m.length; i++) {
	    if (!window.console[m[i]]) {
	      window.console[m[i]] = function() {};
	    }
	  }
	})();

	//Add a polyfill for the .map() function for arrays for IE 8. Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
	// Production steps of ECMA-262, Edition 5, 15.4.4.19
	// Reference: http://es5.github.io/#x15.4.4.19
	if (!Array.prototype.map) {

	  Array.prototype.map = function(callback, thisArg) {

	    var T, A, k;

	    if (this == null) {
	      throw new TypeError(" this is null or not defined");
	    }

	    // 1. Let O be the result of calling ToObject passing the |this|
	    //    value as the argument.
	    var O = Object(this);

	    // 2. Let lenValue be the result of calling the Get internal
	    //    method of O with the argument "length".
	    // 3. Let len be ToUint32(lenValue).
	    var len = O.length >>> 0;

	    // 4. If IsCallable(callback) is false, throw a TypeError exception.
	    // See: http://es5.github.com/#x9.11
	    if (typeof callback !== "function") {
	      throw new TypeError(callback + " is not a function");
	    }

	    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
	    if (arguments.length > 1) {
	      T = thisArg;
	    }

	    // 6. Let A be a new array created as if by the expression new Array(len)
	    //    where Array is the standard built-in constructor with that name and
	    //    len is the value of len.
	    A = new Array(len);

	    // 7. Let k be 0
	    k = 0;

	    // 8. Repeat, while k < len
	    while (k < len) {

	      var kValue, mappedValue;

	      // a. Let Pk be ToString(k).
	      //   This is implicit for LHS operands of the in operator
	      // b. Let kPresent be the result of calling the HasProperty internal
	      //    method of O with argument Pk.
	      //   This step can be combined with c
	      // c. If kPresent is true, then
	      if (k in O) {

	        // i. Let kValue be the result of calling the Get internal
	        //    method of O with argument Pk.
	        kValue = O[k];

	        // ii. Let mappedValue be the result of calling the Call internal
	        //     method of callback with T as the this value and argument
	        //     list containing kValue, k, and O.
	        mappedValue = callback.call(T, kValue, k, O);

	        // iii. Call the DefineOwnProperty internal method of A with arguments
	        // Pk, Property Descriptor
	        // { Value: mappedValue,
	        //   Writable: true,
	        //   Enumerable: true,
	        //   Configurable: true },
	        // and false.

	        // In browsers that support Object.defineProperty, use the following:
	        // Object.defineProperty(A, k, {
	        //   value: mappedValue,
	        //   writable: true,
	        //   enumerable: true,
	        //   configurable: true
	        // });

	        // For best browser support, use the following:
	        A[k] = mappedValue;
	      }
	      // d. Increase k by 1.
	      k++;
	    }

	    // 9. return A
	    return A;
	  };
	}

	// Polyfill for Array function foreach() - from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#Polyfill
	// Production steps of ECMA-262, Edition 5, 15.4.4.18
	// Reference: http://es5.github.io/#x15.4.4.18
	if (!Array.prototype.forEach) {

	  Array.prototype.forEach = function(callback, thisArg) {

	    var T, k;

	    if (this == null) {
	      throw new TypeError(' this is null or not defined');
	    }

	    // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
	    var O = Object(this);

	    // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
	    // 3. Let len be ToUint32(lenValue).
	    var len = O.length >>> 0;

	    // 4. If IsCallable(callback) is false, throw a TypeError exception.
	    // See: http://es5.github.com/#x9.11
	    if (typeof callback !== "function") {
	      throw new TypeError(callback + ' is not a function');
	    }

	    // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
	    if (arguments.length > 1) {
	      T = thisArg;
	    }

	    // 6. Let k be 0
	    k = 0;

	    // 7. Repeat, while k < len
	    while (k < len) {

	      var kValue;

	      // a. Let Pk be ToString(k).
	      //   This is implicit for LHS operands of the in operator
	      // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
	      //   This step can be combined with c
	      // c. If kPresent is true, then
	      if (k in O) {

	        // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
	        kValue = O[k];

	        // ii. Call the Call internal method of callback with T as the this value and
	        // argument list containing kValue, k, and O.
	        callback.call(T, kValue, k, O);
	      }
	      // d. Increase k by 1.
	      k++;
	    }
	    // 8. return undefined
	  };
	}

	// Polyfill for Object.keys()
	// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
	if (!Object.keys) {
	  Object.keys = (function() {
	    'use strict';
	    var hasOwnProperty = Object.prototype.hasOwnProperty,
	        hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
	        dontEnums = [
	          'toString',
	          'toLocaleString',
	          'valueOf',
	          'hasOwnProperty',
	          'isPrototypeOf',
	          'propertyIsEnumerable',
	          'constructor'
	        ],
	        dontEnumsLength = dontEnums.length;

	    return function(obj) {
	      if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
	        throw new TypeError('Object.keys called on non-object');
	      }

	      var result = [], prop, i;

	      for (prop in obj) {
	        if (hasOwnProperty.call(obj, prop)) {
	          result.push(prop);
	        }
	      }

	      if (hasDontEnumBug) {
	        for (i = 0; i < dontEnumsLength; i++) {
	          if (hasOwnProperty.call(obj, dontEnums[i])) {
	            result.push(dontEnums[i]);
	          }
	        }
	      }
	      return result;
	    };
	  }());
	}

    // Polyfill for Array.indexOf
    // Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf#Polyfill
    // Production steps of ECMA-262, Edition 5, 15.4.4.14
    // Reference: http://es5.github.io/#x15.4.4.14
    if (!Array.prototype.indexOf) {
      Array.prototype.indexOf = function(searchElement, fromIndex) {

        var k;

        // 1. Let o be the result of calling ToObject passing
        //    the this value as the argument.
        if (this == null) {
          throw new TypeError('"this" is null or not defined');
        }

        var o = Object(this);

        // 2. Let lenValue be the result of calling the Get
        //    internal method of o with the argument "length".
        // 3. Let len be ToUint32(lenValue).
        var len = o.length >>> 0;

        // 4. If len is 0, return -1.
        if (len === 0) {
          return -1;
        }

        // 5. If argument fromIndex was passed let n be
        //    ToInteger(fromIndex); else let n be 0.
        var n = fromIndex | 0;

        // 6. If n >= len, return -1.
        if (n >= len) {
          return -1;
        }

        // 7. If n >= 0, then Let k be n.
        // 8. Else, n<0, Let k be len - abs(n).
        //    If k is less than 0, then let k be 0.
        k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

        // 9. Repeat, while k < len
        while (k < len) {
          // a. Let Pk be ToString(k).
          //   This is implicit for LHS operands of the in operator
          // b. Let kPresent be the result of calling the
          //    HasProperty internal method of o with argument Pk.
          //   This step can be combined with c
          // c. If kPresent is true, then
          //    i.  Let elementK be the result of calling the Get
          //        internal method of o with the argument ToString(k).
          //   ii.  Let same be the result of applying the
          //        Strict Equality Comparison Algorithm to
          //        searchElement and elementK.
          //  iii.  If same is true, return k.
          if (k in o && o[k] === searchElement) {
            return k;
          }
          k++;
        }
        return -1;
      };
    }

    //Polyfill for NodeList.forEach, which isn't supported in IE at all, or Edge before v16.
    // https://developer.mozilla.org/en-US/docs/Web/API/NodeList/forEach#Polyfill
    if (window.NodeList && !NodeList.prototype.forEach) {
      NodeList.prototype.forEach = Array.prototype.forEach;
    }

    //Polyfill for Object.assign()
    if (typeof Object.assign != 'function') {
      // Must be writable: true, enumerable: false, configurable: true
      Object.defineProperty(Object, "assign", {
        value: function assign(target, varArgs) { // .length of function is 2
          'use strict';
          if (target == null) { // TypeError if undefined or null
            throw new TypeError('Cannot convert undefined or null to object');
          }

          var to = Object(target);

          for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];

            if (nextSource != null) { // Skip over if undefined or null
              for (var nextKey in nextSource) {
                // Avoid bugs when hasOwnProperty is shadowed
                if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                  to[nextKey] = nextSource[nextKey];
                }
              }
            }
          }
          return to;
        },
        writable: true,
        configurable: true
      });
    }

    //Polyfill for Array.includes, taken from https://github.com/kevlatus/polyfill-array-includes#readme
	Array.prototype.includes||Object.defineProperty(Array.prototype,"includes",{value:function(r,e){if(null==this)throw new TypeError('"this" is null or not defined');var t=Object(this),n=t.length>>>0;if(0===n)return!1;var i,o,a=0|e,u=Math.max(a>=0?a:n-Math.abs(a),0);for(;u<n;){if((i=t[u])===(o=r)||"number"==typeof i&&"number"==typeof o&&isNaN(i)&&isNaN(o))return!0;u++}return!1}});

	// Polyfill
	// This Polyfill emulates the Math.log2 function.
	if (!Math.log2) Math.log2 = function(x) {
		return Math.log(x) * Math.LOG2E;
	}
}

MetacatUI.preventCompatibilityIssues();
MetacatUI.loadTheme(MetacatUI.theme);
