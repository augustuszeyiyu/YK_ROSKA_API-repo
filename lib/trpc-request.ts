import http = require('http');
import https = require('https');

type RequestHeaders = {[key:string]:string|string[]};
interface InitParams {
	url:string;
	headers?: RequestHeaders;
	timeout?:number;
	retry_count?:number;
	retry_interval?:number;
}
interface TinyRPCRequestPrivates {
	url:string,
	headers:RequestHeaders
	timeout:number;
	retry_count:number;
	retry_interval:number;
}


const __TinyRPCRequest:WeakMap<TinyRPCRequest, TinyRPCRequestPrivates> = new WeakMap();

const DEFAULT_REQ_TIMEOUT = 30 * 1000;
const DEFAULT_RETRY_INTERVAL = 5 * 1000;
class TinyRPCRequest {
	constructor() {
		__TinyRPCRequest.set(this, {url:'', headers:{}, timeout:DEFAULT_REQ_TIMEOUT, retry_count:0, retry_interval:DEFAULT_RETRY_INTERVAL});
	}
	get url() { return __TinyRPCRequest.get(this)!.url; }
	set url(url:string) {
		if ( typeof url !== "string" ) return;
		__TinyRPCRequest.get(this)!.url = url;
	}

	get timeout() { return __TinyRPCRequest.get(this)!.timeout; }
	set timeout(timeout:number) {
		if ( typeof timeout !== "number" || timeout <= 0 ) return;
		__TinyRPCRequest.get(this)!.timeout = timeout;
	}

	get headers() { return __TinyRPCRequest.get(this)!.headers; }
	set headers(headers:RequestHeaders) {
		if ( Object(headers) !== headers ) return;
		__TinyRPCRequest.get(this)!.headers = Object.assign({}, headers);
	}

	get retry_count() { return __TinyRPCRequest.get(this)!.retry_count; }
	set retry_count(retry_count:number) {
		if ( typeof retry_count !== "number" || retry_count <= 0 ) return;
		__TinyRPCRequest.get(this)!.retry_count = retry_count;
	}

	get retry_interval() { return __TinyRPCRequest.get(this)!.retry_interval; }
	set retry_interval(retry_interval:number) {
		if ( typeof retry_interval !== "number" || retry_interval <= 0 ) return;
		__TinyRPCRequest.get(this)!.retry_interval = retry_interval;
	}

	
	async request<ReturnType=any>(method:string, ...args:any[]):Promise<ReturnType> {
		const _TinyRPCRequest = {...__TinyRPCRequest.get(this)!};
		const {retry_count, retry_interval} = _TinyRPCRequest;
		const max_error_counts = retry_count + 1;

		const errors:Error[] = [];
		let result:any = undefined;
		while(errors.length < max_error_counts) {
			if ( errors.length > 0 ) await Idle(retry_interval);
			
			const _result:Error|ReturnType = await DoRequest<ReturnType>(_TinyRPCRequest, method, ...args).catch((e:Error)=>e);
			if ( _result instanceof Error ) {
				const error = <Error&{is_remote:boolean;}>_result;
				if ( error.is_remote ) throw error;
				
				errors.push(error);
				continue;
			}
			
			result = _result;
			break;
		}

		if ( errors.length > 0 ) {
			if ( retry_count > 0 ) {
				throw Object.assign(new Error("Request error after tries!"), {
					code: 'error#request-error-after-retries',
					errors
				});
			}

			throw errors[0];
		}

		return result as ReturnType;
	}
}
function DoRequest<ReturnType=any>(conn_info:TinyRPCRequestPrivates, method:string, ...args:any[]):Promise<ReturnType> {
	return new Promise<ReturnType>((resolve, reject)=>{
		const {url, headers, timeout} = conn_info;
		const _http = url.substring(0, 6) === 'https:' ? https : http;
		const _headers = {...headers};
		delete _headers['content-type'];
		delete _headers['Content-Type'];
		_headers['Content-Type'] = 'application/json';

		const body = Buffer.from(JSON.stringify({call: method, args}));
		_http.request(url, {method:'POST', headers:_headers}, (res)=>{
			const chunks:Buffer[] = [];
			const status_code = res.statusCode!;
			
			res
			.on('data', c=>chunks.push(c))
			.on('error', err=>reject(err))
			.on('end', ()=>{
				const raw_data = Buffer.concat(chunks);
				let utfdata:string|undefined = undefined;
				let jsondata:any|undefined = undefined;
				
				try { utfdata = raw_data.toString('utf8'); } catch(e) {}
				if ( utfdata !== undefined ) {
					try { jsondata = JSON.parse(utfdata); } catch(e) {}
				}
				
				
				if ( jsondata === undefined || Object(jsondata) !== jsondata ) {
					return reject(Object.assign(new Error("Unable to resolve response body content!"), {
						code: 'error#incorrect-response-format' as const,
						status: status_code,
						data: jsondata||utfdata||raw_data
					}));
				}

				if ( jsondata.error !== undefined ) {
					return reject(Object.assign(new Error(jsondata.error.message), jsondata.error, {
						status: status_code,
						is_remote: true
					}));
				}
				
				return resolve(jsondata.result);
			});
		})
		.on('error', (err)=>reject(err))
		.on('timeout', function(this:http.ClientRequest) {
			this.destroy();
		})
		.setTimeout(timeout)
		.end(body);
	});
}
function Idle(interval:number):Promise<void> {
	return new Promise((resolve)=>setTimeout(resolve, interval));
}



export = function TRPCRequest(init:string|InitParams):TinyRPCRequest {
	let url:string = '', headers:{[key:string]:string|string[]} = {}, timeout:number = DEFAULT_REQ_TIMEOUT, num_retries:number = 0, retry_interval:number = DEFAULT_RETRY_INTERVAL;
	if ( typeof init !== "string" ) {
		url = init.url;
		headers =  init.headers||{};
		timeout = init.timeout||timeout;
		num_retries = init.retry_count||num_retries;
		retry_interval = init.retry_interval||retry_interval;
	}

	const req = new TinyRPCRequest();
	const _TinyRPCRequest = __TinyRPCRequest.get(req)!
	Object.assign(_TinyRPCRequest, {
		url,
		headers:Object.assign({}, headers),
		timeout,
		retry_count:num_retries,
		retry_interval
	});

	return req;
}