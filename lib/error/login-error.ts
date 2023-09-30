export class LoginError {
	public static INVALID_ACCOUNT_OR_PASSWORD:HuntErrorItem = {
		status:400, code:'api#login#incorrect-account-or-password',
		msg:'Given account or password is invalid!'
	};
	public static REPEAT_SIGN_IN_GOOGLE:HuntErrorItem = {
		status:400, code:'api#login#repeat_sign_in_google',
		msg:'Repeat sign in google in short time!'
	};
	public static INVALID_GOOGLE_TOTP:HuntErrorItem = {
		status:400, code:'api#login#incorrect-google-totp',
		msg:"Provided Google TOTP is invalid. If you don't have totp, please apply totp first."
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
};
