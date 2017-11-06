/*global define */

define(['jquery', 'underscore', 'backbone', 'text!templates/login.html', 'text!templates/alert.html', 'text!templates/loginButtons.html', 'text!templates/loginOptions.html'], 				
	function($, _, Backbone, LoginTemplate, AlertTemplate, LoginButtonsTemplate, LoginOptionsTemplate) {
	'use strict';
	
	var SignInView = Backbone.View.extend({
		
		template: _.template(LoginTemplate),
		alertTemplate: _.template(AlertTemplate),
		buttonsTemplate: _.template(LoginButtonsTemplate),
		loginOptionsTemplate: _.template(LoginOptionsTemplate),
		
		tagName: "div",
		className: "inline-buttons sign-in-btns",
		
		ldapError: false,
		
		/* Set to true if this SignInView is the only thing on the page */
		fullPage: false,
		
		/* Set to true if this SignInView is in a modal window */
		inPlace: false,
		
		/*A message to display at the top of the view */
		topMessage: "",
		
		initialize: function(options){
			if(typeof options !== "undefined"){
				this.inPlace = options.inPlace;
				this.topMessage = options.topMessage;
				this.fullPage = options.fullPage;
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
				
				//If it's a full-page sign-in view, then empty it first
				if(this.el == MetacatUI.appView.el || this.fullPage){
					this.$el.empty();
					var container = document.createElement("div");
					container.className = "container login";
					$(container).append(this.buttonsTemplate());
					this.$el.append(container);					
				}
				else
					this.$el.append(this.buttonsTemplate());
				
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
						loginOptions: this.loginOptionsTemplate({ signInUrl: signInUrl }).trim(),
						collapseLdap: !MetacatUI.appUserModel.get("errorLogin"),
						redirectUrl: (window.location.href.indexOf("#signinldaperror") > -1) ? 
								window.location.href.replace("#signinldaperror", "") : window.location.href
					}));
					
					this.setUpPopup();
				}

				//Open the Sign In modal window
				if(this.fullPage)
					$("#signinPopup").modal("show");
								
				//If there is an error message in the URL, it means authentication has failed
				if(this.ldapError){
					MetacatUI.appUserModel.failedLdapLogin();
					this.failedLdapLogin();					
				};
			}
			
			return this;
		},
		
		/*
		 * This function is executed when LDAP authentication fails in the DataONE portal
		 */
		failedLdapLogin: function(){
			//Insert an error message
			$("#signinPopup form").before(this.alertTemplate({
				classes: "alert-error",
				msg: "Incorrect username or password. Please try again."
			}));
			
			//If this is a full-page sign-in view, then take the from and insert it into the page
			if(this.$el.attr("id") == "Content")
				$("#Content").html( $("#ldap-login").html() );
			//Else, just show the login in the modal window
			else{
				$("#signinPopup").modal("show");
			}
			
			//Show the LDAP login form
			$('#ldap-login').removeClass("collapse").css("height", "auto");
		},
		
		setUpPopup: function(){
			var view = this;
			
			//Initialize the modal elements
			$("#signupPopup, #signinPopup").modal({
				show: false,
				shown: function(){
					
					//Update the sign-in URLs so we are redirected back to the previous page after authentication
					$("a.update-sign-in-url").attr("href", MetacatUI.appModel.get("signInUrl") + encodeURIComponent(window.location.href));
					$("a.update-orcid-sign-in-url").attr("href", MetacatUI.appModel.get("signInUrlOrcid") + encodeURIComponent(window.location.href));
					
				}
			});
		},
		
		onClose: function(){
			this.$el.empty();
			
			if(window.listenForSignIn)	clearInterval(window.listenForSignIn);
		}
	});
	return SignInView;
	
});