export class UserError {
	public static NID_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#nid-is-required',
		msg:'身分證字號必填'
	};
	public static NID_IS_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#nid-is-exists',
		msg:'身分證字號已存在'
	};
	public static NID_IS_INVALID:HuntErrorItem = {
		status:400, code:'api#user#nid-is-invalid',
		msg:'身分證字號錯誤'
	};
	public static NAME_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#name-is-required',
		msg:'姓名必填'
	};
	public static ADDRESS_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#address-is-required',
		msg:'地址必填'
	};
	public static GENDER_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#gender-is-required',
		msg:'性別必填'
	};
	public static PASSWORD_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#password-is-required',
		msg:'密碼必填'
	};
	public static DOB_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#dob-is-required',
		msg:'生日必填'
	};
	public static DOB_FORMAT_INVALID:HuntErrorItem = {
		status:400, code:'api#user#dob-format-invliad',
		msg:'生日日期格式錯誤'
	};
	public static HOME_PHONE_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#home-phone-is-required',
		msg:'連絡電話-市話格式必填'
	};	
	public static HOME_PHONE_FORMAT_INVALID:HuntErrorItem = {
		status:400, code:'api#user#home-phone-format-invliad',
		msg:'連絡電話-市話格式錯誤'
	};
	public static MOBILE_PHONE_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#mobile-phone-is-required',
		msg:'連絡電話-行動電話格式必填'
	};	
	public static MOBILE_PHONE_FORMAT_INVALID:HuntErrorItem = {
		status:400, code:'api#user#mobile-phone-format-invliad',
		msg:'連絡電話-行動電話格式錯誤'
	};
	public static BANK_CODE_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#bank-code-is-required',
		msg:'銀行代號必填'
	};
	public static BRANCH_CODE_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#bank-branch-is-required',
		msg:'銀行分行代號必填'
	};
	public static BANK_ACCOUNT_NAME_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#bank-account-name-is-required',
		msg:'銀行帳號用戶名必填'
	};
	public static BANK_ACCOUNT_NUMBER_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#bank-account-number-is-required',
		msg:'銀行帳號必填'
	};
	public static EMERGENCY_NID_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#emergency-nid-is-required',
		msg:'緊急連絡人身分證字號必填'
	};
	public static EMERGENCY_CONTACT_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#emergency-contact-is-required',
		msg:'緊急連絡人必填'
	};
	public static EMERGENCY_CONTACT_NUMBER_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#emergency-contact-number-is-required',
		msg:'緊急連絡電話必填'
	};
	public static EMERGENCY_CONTACT_NUMBER_FORMAT_INVALID:HuntErrorItem = {
		status:400, code:'api#user#emergency-contact-number-format-invalid',
		msg:'緊急聯絡電話格式錯誤'
	};
	public static EMERGENCY_CONTACT_RELATION_IS_REQUIRED:HuntErrorItem = {
		status:400, code:'api#user#emergency-relation-is-required',
		msg:'緊急連絡關係必填'
	};
	public static USER_NOT_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#user-not-exists',
		msg:'系統查無此人，請先註冊'
	};
	public static INVALID_ACCOUNT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-account',
		msg:'Provided account information is invalid'
	};
	public static INVALID_ACCOUNT_FORMAT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-account-format',
		msg:'Provided account format is invalid'
	};
	public static INVALID_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-password',
		msg:'登入密碼錯誤'
	};
	public static INVALID_PASSWORD_FORMAT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-password-format',
		msg:'Provided password format is invalid'
	};
	public static INVALID_OLD_PASSWORD:HuntErrorItem = {
		status:400, code:'api#user#incorrect-old-password',
		msg:'Provided old password is invalid'
	};
	public static INVALID_NEW_PASSWORD_FORMAT:HuntErrorItem = {
		status:400, code:'api#user#incorrect-new-password-format',
		msg:'新密碼格式錯誤'
	};
	public static INVALID_CAPTCHA:HuntErrorItem = {
		status:400, code:'api#user#invalid-captcha',
		msg:'Provided captcha is invalid'
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
	public static REFERRER_NOT_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#referrer-not-exists',
		msg:'Referrer does not exists'
	};
	public static REFERRAL_USER_NOT_EXISTS:HuntErrorItem = {
		status:400, code:'api#user#referral-user-not-exists',
		msg:'Referral user does not exists'
	};
};
