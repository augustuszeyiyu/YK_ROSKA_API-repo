export class UserError {
	public static INVITE_CODE_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#invite_code-is-required',
		msg:'Invite Code is required'
	};
	public static INVALID_CODE:HuntErrorItem = {
		status:400, code:'api#user#incorrect-code',
		msg:'Provided code is invalid'
	};
	public static INVALID_ACCOUNT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-account',
		msg:'Provided account information is invalid'
	};
	public static INVALID_ACCOUNT_FORMAT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-account-format',
		msg:'Provided account format is invalid'
	};
	public static INVALID_EMAIL:HuntErrorItem = {
		status:400, code:'api#user#incorrect-email',
		msg:'Provided email information is invalid'
	};
	public static INVALID_EMAIL_FORMAT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-email-format',
		msg:'Provided email format is invalid'
	};
	public static INVALID_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-password',
		msg:'Provided password is invalid'
	};
	public static INVALID_PASSWORD_FORMAT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-password-format',
		msg:'Provided password format is invalid'
	};
	public static INVALID_SECURE_PASSWORD_FORMAT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-secure-password-format',
		msg:'Provided secure password format is invalid'
	};
	public static INVALID_OLD_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-old-password',
		msg:'Provided old password is invalid'
	};
	public static INVALID_NEW_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-new-password',
		msg:'Provided new password is invalid'
	};
	public static INVALID_OLD_SECURE_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-old-secure-password',
		msg:'Provided old secure password is invalid'
	};
	public static INVALID_NEW_SECURE_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-new-secure-password',
		msg:'Provided new secure password is invalid'
	};
	public static INVALID_SECURITY_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-security-password',
		msg:'Provided secuirty password is invalid'
	};
	public static INVALID_SECURITY_PASSWORD_FORMAT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-security-password-format',
		msg:'Provided secuirty password format is invalid'
	};
	public static INVALID_OLD_SECURITY_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-old-security-password',
		msg:'Provided old secuirty password is invalid'
	};
	public static INVALID_NEW_SECURITY_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-new-security-password',
		msg:'Provided new secuirty password is invalid'
	};
	public static INVALID_CAPTCHA:HuntErrorItem = {
		status:400, code:'api#user#invalid-captcha',
		msg:'Provided captcha is invalid'
	};
	public static INVALID_ADDRESS:HuntErrorItem = {
		status:400, code:'api#user#invalid-address',
		msg:'Provided address is invalid'
	};
	public static INVALID_REFERRER_CODE:HuntErrorItem = {
		status:400, code:'api#user#invalid-referrer-code',
		msg:'Provided referrer code is invalid'
	};
	public static ACCOUNT_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#account-exists',
		msg:'Account or ID exists'
	};
	public static ACCOUNT_NOT_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#account-not-exists',
		msg:'Account or ID does not exists'
	};

	public static EMAIL_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#email-exists',
		msg:'Account exists already'
	};
	public static EMAIL_NOT_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#email-not-exists',
		msg:'Account does not exists'
	};
	public static USER_NOT_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#user-not-exists',
		msg:'User does not exists'
	};
	public static REFERRER_NOT_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#referrer-not-exists',
		msg:'Referrer does not exists'
	};

	public static CANNOT_DOWNGRADE:HuntErrorItem = {
		status:400, code:'api#user#cannot-downgrade',
		msg:'Cannot downgrade'
	};
	public static MEMBERSHIP_EXPIRED:HuntErrorItem = {
		status:400, code:'api#user#membership-expired',
		msg:'membership expired'
	};


	public static REFERRAL_USER_NOT_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#referral-user-not-exists',
		msg:'Referral user does not exists'
	};
	public static INSUFFICIENT_BALANCE:HuntErrorItem = {
		status:400, code:'api#user#insufficient-balance',
		msg:'Insufficient balance when withdraw from your account.'
	};

	public static WRONG_WALLET_ADDRESS:HuntErrorItem = {
		status:400, code:'api#user#wrong-wallet-address',
		msg:'Invalid wallet address.'
	};
};
