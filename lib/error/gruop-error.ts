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
};
