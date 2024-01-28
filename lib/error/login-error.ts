export class LoginError {
	public static LOGIN_REQUIRED:HuntErrorItem = {
		status:400, code:'api#login#login-required',
		msg:'Login Required!'
	};
	public static NID_REQUIRED:HuntErrorItem = {
		status:400, code:'api#login#nid-required',
		msg:'NID Required!'
	};
	public static MOBILE_NUMBER_REQUIRED:HuntErrorItem = {
		status:400, code:'api#login#mobile-number-required',
		msg:'Mobile number Required!'
	};
	public static PASSWORD_REQUIRED:HuntErrorItem = {
		status:400, code:'api#login#password-required',
		msg:'Password Required!'
	};
	public static CAPTCHA_REQUIRED:HuntErrorItem = {
		status:400, code:'api#login#captcha-required',
		msg:'Captcha Required!'
	};
	public static CAPTCHA_INVALID:HuntErrorItem = {
		status:400, code:'api#login#captcha-invalid',
		msg:'Captcha invalid!'
	};
	public static INVALID_ACCOUNT_OR_PASSWORD:HuntErrorItem = {
		status:400, code:'api#login#incorrect-account-or-password',
		msg:'Given account or password is invalid!'
	};
	public static REPEAT_SIGN_IN_GOOGLE:HuntErrorItem = {
		status:400, code:'api#login#repeat_sign_in_google',
		msg:'Repeat sign in google in short time!'
	};
	public static SESSION_ID_REQUIRE:HuntErrorItem = {
		status:400, code:'api#login#totp-required',
		msg:'session id is missing! session id is required!'
	};
	public static TOTP_REQUIRE:HuntErrorItem = {
		status:400, code:'api#login#totp-required',
		msg:'totp is missing! Totp is required!'
	};
	public static INVALID_SESSION_ID:HuntErrorItem = {
		status:400, code:'api#login#incorrect-session-id',
		msg:"Provided session id is invalid or exipired."
	};
	public static INVALID_TOKEN:HuntErrorItem = {
		status:400, code:'api#login#incorrect-token',
		msg:"Provided token is invalid or not exists."
	};
	public static TOKEN_EXPIRED:HuntErrorItem = {
		status:400, code:'api#login#token-expired',
		msg:"Token 已過期，請重新請求。"
	};
};
