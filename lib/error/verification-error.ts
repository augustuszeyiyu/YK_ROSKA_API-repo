export class VerificationError {
	public static INVALID_LINK:HuntErrorItem = {
		status:400, code:'api#verification#invalid-link',
		msg:'Your password reset link appears to be invalid. Please request a new link agian.'
	};
	public static INVALID_CODE:HuntErrorItem = {
		status:400, code:'api#verification#invalid-status',
		msg:'Verification status is invalid'
	};
	public static INVALID_TOKEN:HuntErrorItem = {
		status:400, code:'api#verification#invalid-token',
		msg:'Token is invalid'
	};
	
	public static TOKEN_EXPIRED:HuntErrorItem = {
		status:400, code:'api#verification#token-expired',
		msg:'Token has been expired or revoked'
	};

	public static RESET_PASSWORD_SUCCESS:HuntErrorItem = {
		status:200, code:'api#verification#reset-password-success',
		msg:'Your password has been reset successfully. Please check your mailbox.'
	};

	public static RESET_SECURITY_SUCCESS:HuntErrorItem = {
		status:200, code:'api#verification#reset-secuirty-success',
		msg:'Your security status has been reset successfully. Please check your mailbox.'
	};
};
