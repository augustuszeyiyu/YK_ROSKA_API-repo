export class BaseError {
	// 400
	public static BAD_REQUEST:HuntErrorItem = {
		status:400, code:'api#base#bad-request',
		msg:'Request payload contains invalid information'
	};
	public static MISSING_REQUIRED_HEADER_ATTRIBUTES:HuntErrorItem = {
		status:400, code:'api#base#missing-required-header-attributes',
		msg:'Required header attributes are not exposed in request header'
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
	
	// 401
	public static UNAUTHORIZED_ACCESS:HuntErrorItem = {
		status:401, code:'api#base#unauthorized',
		msg:'Authorization is required to access this resource'
	};

	
	// 403
	public static FORBIDDEN_ACCESS:HuntErrorItem = {
		status:403, code:'api#base#forbidden',
		msg:"You're not allowed to access this resource"
	};
	public static EXPIRED_TOKEN:HuntErrorItem = {
		status:403, code:'api#base#expired-token',
		msg:"Your token has been expired"
	};

	
	//404
	public static RESOURCE_NOT_FOUND:HuntErrorItem = {
		status:404, code:'api#base#res-not-found',
		msg:'Requested resource cannot be found'
	};
	
	// 405
	public static METHOD_NOT_ALLOWED:HuntErrorItem = {
		status:405, code:'api#base#method-not-allowed',
		msg:'Requesting method is not supported by the resource'
	};
	
	// 413
	public static REQUEST_PAYLOAD_IS_TOO_LARGE:HuntErrorItem = {
		status:413, code:'api#base#payload-is-too-large',
		msg:'Request body payload is too large'
	};
	
	// 415
	public static UNSUPPORTED_MEDIA_TYPE:HuntErrorItem = {
		status:415, code:'api#base#unsupported-media-type',
		msg:'Unsupported requesting media type'
	};
	// 429
	public static TOO_MANY_REQUEST: HuntErrorItem = {
		status:429, code:`api#base#too-many-requests`,
		msg: 'Too many requests. Please wait!'
	}
	// 500
	public static UNEXPECTED_SERVER_ERROR:HuntErrorItem = {
		status:500, code:'api#base#unexpected-error',
		msg:'Unexpected error has occurred'
	};
	public static UNEXPECTED_DB_FAILURE:HuntErrorItem = {
		status:500, code:'api#base#unexpected-db-failure',
		msg:'Unexpected database failure has occurred'
	};
	public static UNEXPECTED_MISSING_DATA:HuntErrorItem = {
		status:500, code:'api#base#unexpected-missing-data',
		msg:'Related data is missing unexpectedly'
	};
	public static DB_INSERTION_FAILURE:HuntErrorItem = {
		status:500, code:'api#base#db-insertion-failure',
		msg:'Cannot insert new info!'
	}
	public static DB_UPDATE_FAILURE:HuntErrorItem = {
		status:500, code:'api#base#db-updata-failure',
		msg:'Cannot update info!'
	}
	public static DB_DELETION_FAILURE:HuntErrorItem = {
		status:500, code:'api#base#db-insertin-failure',
		msg:'Cannot delete this record or this record is not exist!'
	}
};
