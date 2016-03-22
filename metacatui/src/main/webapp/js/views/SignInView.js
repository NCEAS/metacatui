/*global define */

define(['jquery', 'underscore', 'backbone', 'text!templates/login.html', 'text!templates/loginButtons.html', 'text!templates/loginOptions.html', 'text!templates/ldapLogin.html'], 				
	function($, _, Backbone, LoginTemplate, LoginButtonsTemplate, LoginOptionsTemplate, LdapLoginTemplate) {
	'use strict';
	
	var SignInView = Backbone.View.extend({
		
		template: _.template(LoginTemplate),
		buttonsTemplate: _.template(LoginButtonsTemplate),
		loginOptionsTemplate: _.template(LoginOptionsTemplate),
		ldapLoginTemplate: _.template(LdapLoginTemplate),
		
		tagName: "div",
		className: "inline-buttons sign-in-btns",
		
		render: function(){
			//Don't render a SignIn view if there are no Sign In URLs configured
			if(!appModel.get("signInUrl") && !appModel.get("signInUrlOrcid")) return this;
			
			
			//Insert the sign in popup screen once
			if(!$("#signinPopup").length){
				var target = encodeURIComponent(window.location.href);
				var signInUrl = appModel.get('signInUrl')? appModel.get('signInUrl') + target : null;
				var signInUrlOrcid = appModel.get('signInUrlOrcid') ? appModel.get('signInUrlOrcid') + target : null;
				var signInUrlLdap = appModel.get('signInUrlLdap') ? appModel.get('signInUrlLdap') + target : null;	
				
				$("body").append(this.template({
					signInUrl:  signInUrl,
					signInUrlOrcid:  signInUrlOrcid,
					signInUrlLdap:  signInUrlLdap,
					currentUrl: window.location.href,
					loginOptions: this.loginOptionsTemplate({ signInUrl: signInUrl }).trim()
				}));
			}
			
			this.$el.append(this.buttonsTemplate());
			
			return this;
		},
		
		setUpPopup: function(){
			var view = this;
			
			//Initialize the fancybox elements
			this.$(".fancybox").fancybox({
				transitionIn: "elastic",
				afterShow: function(){
					$("#signinPopup a.ldap").on("click", null, view, view.showLDAPLogin);
					
					//Update the sign-in URLs so we are redirected back to the previous page after authentication
					$("a.update-sign-in-url").attr("href", appModel.get("signInUrl") + encodeURIComponent(window.location.href));
					$("a.update-orcid-sign-in-url").attr("href", appModel.get("signInUrlOrcid") + encodeURIComponent(window.location.href));
					$("a.update-ldap-sign-in-url").attr("href", appModel.get("signInUrlLdap") + encodeURIComponent(window.location.href));
				}
			});
		},	
		
		showLDAPLogin: function(e, a){
			e.preventDefault();
			
			if($(e.target).hasClass("ldap")){
				var org = $(e.target).attr("data-value"),
					accountType = $(e.target).attr("data-name"),
					view = e.data;
				
				this.loginPopup = $("#signinPopup").children().detach();
				
				var ldapLogin = view.ldapLoginTemplate({
					signInUrlLdap: appModel.get("signInUrlLdap"),
					accountType: accountType,
					org: org				
				});
			}
			else
				window.location = appModel.get("signInUrl") + window.location;
			
			$("#signinPopup").append(ldapLogin);
			
			var view = this;
			$("#SignInLdap .back").on("click", function(e){
				e.preventDefault();
				
				 $("#signinPopup").html(view.loginPopup);
			});
		},
		
		onClose: function(){
			this.$el.empty();
		}
	});
	return SignInView;
	
});