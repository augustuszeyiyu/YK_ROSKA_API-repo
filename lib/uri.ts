type URIInfo = {
	scheme:string|null,
	authority:string|null,
	userinfo:string|null,
	username:string|null,
	password:string|null,
	host:string|null,
	hostname:string|null,
	port:number|null,
	path:string|null,
	query:string|null,
	fragment:string|null
};
export function URI(uri:string):URIInfo {
	let remained = uri;
	const result:URIInfo = {
		scheme:null,
		authority:null,
		userinfo:null,
		username:null,
		password:null,
		host:null,
		hostname:null,
		port:null,
		path:null,
		query:null,
		fragment:null
	};
	

	// Parse scheme
	let anchor = remained.indexOf(':');
	if ( anchor >= 0 ) {
		result.scheme = remained.substring(0, anchor+1);
		remained = remained.substring(anchor+1);
	}


	// Parse authority
	if ( remained.substring(0, 2) === "//" ) {
		anchor = remained.indexOf('/', 2);
		if ( anchor >= 0 ) {
			result.authority = remained.substring(2, anchor);
			remained = remained.substring(anchor);
		}
	}

	// Parse fragement
	anchor = remained.indexOf('#');
	if ( anchor >= 0 ) {
		result.fragment = remained.substring(anchor);
		remained = remained.substring(0, anchor);
	}

	// Parse query
	anchor = remained.indexOf('?');
	if ( anchor >= 0 ) {
		result.query = remained.substring(anchor);
		remained = remained.substring(0, anchor);
	}
	
	// Set path
	result.path = remained;


	if ( result.authority !== null ) {
		try {
			const parsed = new URL("http://"+result.authority);
			result.host = parsed.host;
			result.hostname = parsed.hostname;

			if ( parsed.port !== "" ) {
				result.port = parseInt(parsed.port);
			}


			anchor = result.authority.indexOf('@');
			if ( anchor >= 0 ) {
				result.userinfo = result.authority.substring(0, anchor);
				result.username = parsed.username;

				if ( result.userinfo.indexOf(':') >= 0 ) {
					result.password = parsed.password;
				}
			}
		}
		catch(e) {
			throw new Error("Invalid URI authority!");
		}
	}
	
	return result;
}