define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  "use strict";

  // Node Model
  // ------------------
  var Node = Backbone.Model.extend({
    // This model contains all of the information retrieved from calling listNodes() using the DataONE API
    defaults: {
      members: [],
      coordinators: [],
      hiddenMembers: [],
      currentMemberNode: MetacatUI.appModel.get("nodeId") || null,
      checked: false,
      error: false,
    },

    initialize: function () {
      var model = this;

      if (MetacatUI.appModel.get("nodeServiceUrl")) {
        //Get the node information from the CN
        this.getNodeInfo();
      }
    },

    getMember: function (memberInfo) {
      if (!memberInfo) return false;

      //Get the member ID
      var memberId = null;
      if (typeof memberInfo === "object" && memberInfo.type == "SolrResult")
        memberId = memberInfo.get("datasource");
      else if (typeof memberInfo === "string") memberId = memberInfo;
      else return false;

      //Find the member by its ID
      var member = _.findWhere(this.get("members"), { identifier: memberId });
      if (!member) return false;

      return member;
    },

    getMembers: function (memberInfo) {
      if (!memberInfo) return false;

      if (!Array.isArray(memberInfo)) memberInfo = [memberInfo];

      var members = [];

      _.each(
        memberInfo,
        function (info) {
          var foundMember = this.getMember(info);

          if (foundMember) members.push(foundMember);
        },
        this,
      );

      if (members.length) return members;
      else return false;
    },

    getNodeInfo: function () {
      var thisModel = this,
        memberList = this.get("members"),
        coordList = this.get("coordinators");

      $.ajax({
        url: MetacatUI.appModel.get("nodeServiceUrl"),
        dataType: "text",
        success: function (data, textStatus, xhr) {
          var xmlResponse = $.parseXML(data) || null;
          if (!xmlResponse) return;

          thisModel.saveNodeInfo(xmlResponse);

          thisModel.set("checked", true);
        },
        error: function (xhr, textStatus, errorThrown) {
          //Log the error to the console
          console.error(
            "Couldn't get the DataONE Node info document: ",
            textStatus,
            errorThrown,
          );

          // Track the error
          const message =
            `Couldn't get the DataONE Node info document: ` +
            `${textStatus}, ${errorThrown}`;
          MetacatUI.analytics?.trackException(message, null, false);

          //Trigger an error on this model
          thisModel.set("error", true);
          thisModel.trigger("error");

          thisModel.set("checked", true);
        },
      });
    },

    saveNodeInfo: function (xml) {
      var thisModel = this,
        memberList = this.get("members"),
        coordList = this.get("coordinators"),
        children = xml.children || xml.childNodes;

      //Traverse the XML response to get the MN info
      _.each(children, function (d1NodeList) {
        var d1NodeListChildren = d1NodeList.children || d1NodeList.childNodes;

        //The first (and only) child should be the d1NodeList
        _.each(d1NodeListChildren, function (thisNode) {
          //Ignore parts of the XML that is not MN info
          if (!thisNode.attributes) return;

          //'node' will be a single node
          var node = {},
            nodeProperties = thisNode.children || thisNode.childNodes;

          //Grab information about this node from XML nodes
          _.each(nodeProperties, function (nodeProperty) {
            if (nodeProperty.nodeName == "property")
              node[$(nodeProperty).attr("key")] = nodeProperty.textContent;
            else node[nodeProperty.nodeName] = nodeProperty.textContent;

            //Check if this member node has v2 read capabilities - important for the Package service
            if (
              nodeProperty.nodeName == "services" &&
              nodeProperty.childNodes.length
            ) {
              var v2 = $(nodeProperty).find(
                "service[name='MNRead'][version='v2'][available='true']",
              ).length;
              node["readv2"] = v2;
            }
          });

          //Grab information about this node from XLM attributes
          _.each(thisNode.attributes, function (attribute) {
            node[attribute.nodeName] = attribute.nodeValue;
          });

          //Create some aliases for node info properties
          if (node.CN_logo_url) node.logo = node.CN_logo_url;

          if (node.CN_node_name) node.name = node.CN_node_name;

          if (node.CN_operational_status)
            node.status = node.CN_operational_status;

          if (node.CN_date_operational)
            node.memberSince = node.CN_date_operational;

          node.shortIdentifier = node.identifier.substring(
            node.identifier.lastIndexOf(":") + 1,
          );

          // Push only if the node is not present in the list
          if (node.type == "mn") {
            if (!thisModel.containsObject(node, memberList)) {
              memberList.push(node);
            }
          }

          // Push only if the node is not present in the list
          if (node.type == "cn") {
            if (!thisModel.containsObject(node, coordList)) {
              coordList.push(node);
            }
          }
        });

        //Save the cn and mn lists in the model when all members have been added
        thisModel.set("members", memberList);
        thisModel.trigger("change:members");
        thisModel.set("coordinators", coordList);
        thisModel.trigger("change:coordinators");

        //If we don't have a current member node yet, find it
        if (!thisModel.get("currentMemberNode")) {
          // Find the current member node by matching the current DataONE MN API base URL
          // with the DataONE MN API base URLs in the member list
          var thisMember = _.findWhere(thisModel.get("members"), {
            baseURL: (
              MetacatUI.appModel.get("baseUrl") +
              MetacatUI.appModel.get("context") +
              MetacatUI.appModel.get("d1Service")
            )
              .replace("/v2", "")
              .replace("/v1", ""),
          });

          if (thisMember !== undefined) {
            //If a matching member node is found, set the node ID
            thisModel.set("currentMemberNode", thisMember.identifier);

            //If the node ID is not set in the appModel user the matching MN we found
            if (!MetacatUI.appModel.get("nodeId"))
              MetacatUI.appModel.set("nodeId", thisMember.identifier);
          }

          //Trigger a change so the rest of the app knows we at least looked for the current MN
          thisModel.trigger("change:currentMemberNode");
        }
      });
    },

    // Checks if the node already exists in the List
    containsObject: function (obj, list) {
      var res = _.find(list, function (val) {
        return _.isEqual(obj, val);
      });
      return _.isObject(res) ? true : false;
    },

    /*
     * Returns true if the given nodeId is a Coordinating Node
     */
    isCN: function (nodeId) {
      return _.findWhere(this.get("coordinators"), { identifier: nodeId });
    },
  });
  return Node;
});
