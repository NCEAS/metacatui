/*global define */

define(['jquery', 'underscore', 'backbone', 'fancybox', 'text!templates/login.html', 'text!templates/loginButtons.html', 'text!templates/loginOptions.html', 'text!templates/ldapLogin.html'], 				
	function($, _, Backbone, fancybox, LoginTemplate, LoginButtonsTemplate, LoginOptionsTemplate, LdapLoginTemplate) {
	'use strict';
	
	var SignInView = Backbone.View.extend({
		
		template: _.template(LoginTemplate),
		buttonsTemplate: _.template(LoginButtonsTemplate),
		loginOptionsTemplate: _.template(LoginOptionsTemplate),
		ldapLoginTemplate: _.template(LdapLoginTemplate),
		
		tagName: "div",
		className: "inline-buttons sign-in-btns",
		
		initialize: function(options){
			if(typeof options !== "undefined"){
				this.inPlace = options.inPlace;
				this.topMessage = options.topMessage;
			}
		},
		
		render: function(){
			//Don't render a SignIn view if there are no Sign In URLs configured
			if(!MetacatUI.appModel.get("signInUrl") && !MetacatUI.appModel.get("signInUrlOrcid")) return this;
			
			var view = this;
			
			if(this.inPlace){
				this.$el.addClass("hidden modal container");
				this.$el.attr("data-backdrop", "static");
				
				//Add a message to the top, if supplied
				if(typeof this.topMessage == "string")
					this.$el.prepend('<p class="center container">' + this.topMessage + '</p>');
				else if(typeof this.topMessage == "object")
					this.$el.prepend(this.topMessage);
						
				//Copy/paste the contents of the sign-in popup
				var signInBtns = $.parseHTML($("#signinPopup").html().trim()),
					signInBtnsContainer = $(document.createElement("div")).addClass("center container").html(signInBtns);
				signInBtnsContainer.find("a").each(function(i, a){
					var url = $(a).attr("href");
					url = url.substring(0, url.indexOf("target=")+7) + window.location.origin + window.location.pathname + encodeURIComponent("#") + "signinsuccess";
					$(a).attr("href", url);
				});
				signInBtnsContainer.find("h1, h2").remove();
				this.$el.append(signInBtnsContainer);
				
				this.$el.prepend($(document.createElement("div")).addClass("container").prepend(
						$(document.createElement("a")).text("Close").addClass("close").prepend(
						$(document.createElement("i")).addClass("icon icon-on-left icon-remove"))));
				
				//Listen for clicks 
				this.$("a.signin").on("click", function(e){	
					//Get the link URL and change the target to a special route					
					e.preventDefault();
										
					var link = e.target;
					if(link.nodeName != "A") link = $(link).parents("a");
					
					var url = $(link).attr("href");
					
					//Open up a new small window with this URL to allow the user to login
					window.open(url, "Login", "height=600,width=700");
					
					//Listen for successful sign-in
					window.listenForSignIn = setInterval(function(){
						MetacatUI.appUserModel.checkToken(function(data){
							$(".modal.sign-in-btns").modal("hide");
							clearInterval(window.listenForSignIn);
							
							if(MetacatUI.appUserModel.get("checked"))
								MetacatUI.appUserModel.trigger("change:checked");
							else
								MetacatUI.appUserModel.set("checked", true);
						});
					}, 750);
				});
				
				this.$("a.close").on("click", function(e){
					view.$el.modal("hide");
				});
			}
			else{			
				//Insert the sign in popup screen once
				if(!$("#signinPopup").length){
					var target = encodeURIComponent(window.location.href);
					var signInUrl = MetacatUI.appModel.get('signInUrl')? MetacatUI.appModel.get('signInUrl') + target : null;
					var signInUrlOrcid = MetacatUI.appModel.get('signInUrlOrcid') ? MetacatUI.appModel.get('signInUrlOrcid') + target : null;
					var signInUrlLdap = MetacatUI.appModel.get('signInUrlLdap') ? MetacatUI.appModel.get('signInUrlLdap') + target : null;	
					
					$("body").append(this.template({
						signInUrl:  signInUrl,
						signInUrlOrcid:  signInUrlOrcid,
						signInUrlLdap:  signInUrlLdap,
						currentUrl: window.location.href,
						loginOptions: this.loginOptionsTemplate({ signInUrl: signInUrl }).trim()
					}));
				}
				
				this.$el.append(this.buttonsTemplate());
			}
			
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
					$("a.update-sign-in-url").attr("href", MetacatUI.appModel.get("signInUrl") + encodeURIComponent(window.location.href));
					$("a.update-orcid-sign-in-url").attr("href", MetacatUI.appModel.get("signInUrlOrcid") + encodeURIComponent(window.location.href));
					$("a.update-ldap-sign-in-url").attr("href", MetacatUI.appModel.get("signInUrlLdap") + encodeURIComponent(window.location.href));
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
					signInUrlLdap: MetacatUI.appModel.get("signInUrlLdap"),
					accountType: accountType,
					org: org				
				});
			}
			else
				window.location = MetacatUI.appModel.get("signInUrl") + window.location;
			
			$("#signinPopup").append(ldapLogin);
			
			var view = this;
			$("#SignInLdap .back").on("click", function(e){
				e.preventDefault();
				
				 $("#signinPopup").html(view.loginPopup);
			});
		},
		
		onClose: function(){
			this.$el.empty();
			
			if(window.listenForSignIn)	clearInterval(window.listenForSignIn);
		}
	});
	return SignInView;
	
});