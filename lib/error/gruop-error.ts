export class GroupError {
	// 400
	public static SID_NOT_FOUND:HuntErrorItem = {
		status:400, code:'api#gruop#sid-not-found',
		msg:'sid not found.'
	};
	public static GID_NOT_FOUND:HuntErrorItem = {
		status:400, code:'api#gruop#gid-not-found',
		msg:'gid not found.'
	};
	public static INVALID_bid_start_time:HuntErrorItem = {
		status:400, code:'api#gruop#invalid-bid-start-time',
		msg:'下注時間錯誤.'
	};
	public static INVALID_bid_amount:HuntErrorItem = {
		status:400, code:'api#gruop#invalid-bid-amount',
		msg:'下注金額錯誤.'
	};
	public static GROUP_SERIAL_IS_FULL:HuntErrorItem = {
		status:400, code:'api#gruop#group-serial-is-full',
		msg:'此會組已額滿'
	};
	public static NO_MEMBER_BID:HuntErrorItem = {
		status:400, code:'api#gruop#no-member-bid',
		msg:'無人下標'
	};
};
