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
	public static INVALID_HEADER_ATTRIBUTES:HuntErrorItem = {
		status:400, code:'api#base#invalid-header-attributes',
		msg:'Request header contains invalid attributes'
	};
	public static INVALID_REQUEST_PAYLOAD:HuntErrorItem = {
		status:400, code:'api#base#invalid-request-payload',
		msg:'Cannot correctly parse request payload'
	};
	public static INVALID_REQUEST_PAYLOAD_CONTENT:HuntErrorItem = {
		status:400, code:'api#base#missing-required-fields',
		msg:'Request content lacks some required fields'
	};
	public static INVALID_URL_FORMAT:HuntErrorItem = {
		status:400, code:'api#base#invalid-url-format',
		msg:'Invalid url format'
	};
	
};
