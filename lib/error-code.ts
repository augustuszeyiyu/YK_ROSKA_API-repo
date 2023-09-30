export enum ErrorCode {
	UNKOWN_ERROR					= 'base#unkown-error',
	RESOURCE_NOT_FOUND				= 'base#resource-not-found',						// 404
	UNAUTHORIZED					= 'base#unauthorized-access',						// 401
	FORBIDDEN_ACCESS				= 'base#unauthorized-access',						// 403
	INVALID_REQUEST_MIME			= 'base#invalid-request-mime',
	INVALID_REQUEST_PAYLOAD			= 'base#invalid-request-payload',					// 400
	INVALID_REQUEST_QUERY			= 'base#invalid-request-query',						// 400
	UNEXPECTED_MISSING_DATA			= 'base#unexpected-missing-data',
	UNEXPECTED_DB_INSERTION_FAILURE = 'base#unexpected-db-insertion-failure',			// 500
	UNEXPECTED_DB_UPDATE_FAILURE	= 'base#unexpected-db-update-failure',				// 500
	UNEXPECTED_DB_DELETE_FAILURE	= 'base#unexpected-db-delete-failure',				// 500
	INSUFFICIENT_BALANCE			= 'base#insufficient-balance',

	USER_REG_LIMIT_HAS_REACHED		= 'api#register#user-registration-limit-has-reached',

	PURCHASE_WITH_INVALID_INVITE_CODE = 'api#purchase#purchase-with-invalid-invite-code',
	PURCHASE_WITH_INVALID_PRODUCT_ID  = 'api#purchase#purchase-with-invalid-product-id',

	DUPLICATED_USER_NAME = 'profile#user-name-is-duplicated',
	DUPLICATED_BINANCE_KEY = 'error#dup-binance-key',
	DUPLICATED_BITGET_KEY = 'error#dup-bitget-key',
	DUPLICATED_BINGX_KEY = 'error#dup-bingx-key',
	DUPLICATED_BYBIT_KEY = 'error#dup-bybit-key',
	DUPLICATED_OKX_KEY = 'error#dup-okx-key',
	SIGNAL_ID_NOT_FOUNT = 'error#signal-id-not-found',            		// 找不到
	SIGNAL_HAS_NOT_BEEN_EXPIRED ='error#signal-has-not-been-expired',   // 購買資訊尚未過期


	// Trading related errors
	NONE_EMPTY_POSITION = 'api#trading#none-empty-position',
	UNSUPPORTED_SYMBOL = 'api#trading#unsupported-symbol',
	ALLOW_FOLLOW_IS_ON = 'api#trading#allow-follow-is-on',
	FOLLOWING_IS_ON = 'api#trading#following-is-on',
	CUSTOM_IS_ON = 'api#trading#custom-is-on',
	CUSTOM_IS_OFF = 'api#trading#custom-is-off',
	NO_TAKER_SELECTED = 'api#trading#no-taker-selected',
	SELF_FOLLOWING_IS_NOT_PERMITTED = 'api#trading#self-following-is-not-permitted',
	TARGET_USER_DOES_NOT_ALLOW_BEING_FOLLOWED = 'api#trading#target-user-does-not-allow-being-followed',
	MAX_ASSETS_VALUE_IS_INVALID = 'api#trading#max-asset-value-is-invalid',
	INVITE_CODE_REQUIRED = 'api#trading#invite-code-is-required',
	TURN_OFF_ALLOW_FOLLOWED = 'api#trading#turn-off-allow-followed',
	INVALID_INVITE_CODE = 'api#trading#invalid-invite-code',
	INVALID_INVITE_CODE_FORMAT = 'api#trading#invalid-invite-code-format',
	

	DOWNGRADING_IS_FORBIDDEN = 'api#purchase#downgrading-is-forbidden',


	RPC_CALL_NOT_FOUND = 'rpc#call-not-found',
	RPC_CALL_EXEC_ERROR = 'rpc#call-exec-error',
	RPC_INVALID_CALL_ARGS = 'rpc#invalid-call-arg'
};