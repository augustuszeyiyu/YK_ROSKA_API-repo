import crypto = require("crypto");



export function GenTOTP(secret:Buffer|Uint8Array|ArrayBuffer, length:number=6, unit:number=3600, start_time:number=0):string {
	const time_base = Math.floor(Date.now()/1000) - start_time;
	const counter	= Math.floor(time_base/unit);    
	return GenHOTP(secret, counter, length);
}
export function GenHOTP(secret:Buffer|Uint8Array|ArrayBuffer, counter:number, length:number=6):string {
	if ( secret instanceof ArrayBuffer ) {
		secret = new Uint8Array(secret);
	}

	if ( !(secret instanceof Buffer) && !(secret instanceof Uint8Array) ) {
		throw new TypeError("secret param must be a Buffer, a Uint8Array or an ArrayBuffer!");
	}
	

	const data_buffer = new ArrayBuffer(8);

	{
		const big_u64_buffer = new DataView(data_buffer);
		big_u64_buffer.setInt32(0, Math.floor(counter/0xFFFFFFFF), false);
		big_u64_buffer.setInt32(4, counter%0xFFFFFFFF, false);
	}
	
	
	
	const hmac = crypto.createHmac('sha1', secret).update(Buffer.from(data_buffer)).digest();
	const offset = (hmac[hmac.length-1]&0x0f)>>>0;
	
	const v = new Uint32Array(1);
	const bytes = new Uint8Array(v.buffer);
	bytes[0] = (hmac[offset+3]&0xff)>>>0;
	bytes[1] = (hmac[offset+2]&0xff)>>>0;
	bytes[2] = (hmac[offset+1]&0xff)>>>0;
	bytes[3] = (hmac[offset  ]&0x7f)>>>0;
	
	
	
	const num = ''+(v[0] % Math.pow(10, length));
	const pad_len = length - num.length;
	return '0'.repeat(pad_len>=0?pad_len:0) + num;
}
export function VerifyTOTP(totp:string, secret:Buffer|Uint8Array|ArrayBuffer, length:number=6, unit:number=3600, start_time:number=0):boolean {
	const time_base = Math.floor(Date.now()/1000) - start_time;
	const counter	= Math.floor(time_base/unit);    
	const result_1 = GenHOTP(secret, counter, length);
	const result_2 = GenHOTP(secret, counter-1, length);
	
	return result_1===totp || result_2===totp? true : false;
} 
export function VerifyGoogleTOTP(google_otp:string, secret:Buffer|Uint8Array|ArrayBuffer, length:number=6, unit:number=3600, start_time:number=0):boolean {
	const time_base = Math.floor(Date.now()/1000) - start_time;
	const counter	= Math.floor(time_base/unit);    
	const result_1 = GenHOTP(secret, counter, length);
	const result_2 = GenHOTP(secret, counter-1, length);
	
	return result_1===google_otp || result_2===google_otp? true : false;
}