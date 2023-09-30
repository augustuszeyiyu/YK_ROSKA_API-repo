/**
 *	Author: JCloudYu
 *	Create: 2019/08/19
**/
import Crypto = require('crypto');
import Beson  = require('beson');



const BASE32_ENCODE_CHAR = "0123456789abcdefghijklmnopqrstuv".split('');
const BASE32_DECODE_CHAR = {
	'0':  0, '1':  1, '2':  2, '3':  3, '4':  4, '5':  5, '6':  6, '7':  7, '8':  8, '9':  9, 
	'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16, 'H': 17, 'I': 18, 'J': 19, 'K': 20, 'L': 21, 'M': 22,
	'N': 23, 'O': 24, 'P': 25, 'Q': 26, 'R': 27, 'S': 28, 'T': 29, 'U': 30, 'V': 31, 
	'a': 10, 'b': 11, 'c': 12, 'd': 13, 'e': 14, 'f': 15, 'g': 16, 'h': 17, 'i': 18, 'j': 19, 'k': 20, 'l': 21, 'm': 22,
	'n': 23, 'o': 24, 'p': 25, 'q': 26, 'r': 27, 's': 28, 't': 29, 'u': 30, 'v': 31,
};



export default class BWT {
	static GenBWT(body:object, secret:ArrayBuffer|Uint8Array):string {
		if ( Object(body) !== body ) {
			throw new Error('Parameter `body` must be an object!');
		}

		if ( secret instanceof ArrayBuffer ){
			secret = Buffer.from(secret);
		}

		
		if ( !Buffer.isBuffer(secret) && !(secret instanceof Uint8Array) ) {
			throw new Error('Secret must be an instance of Uint8Array, ArrayBuffer or Buffer!');
		}
		

		
		const payload	= Base32HexEncode(new Uint8Array(Beson.Serialize(body)));
		const signature	= Base32HexEncode(Crypto.createHmac("sha256", secret).update(payload).digest());

		return `${signature}${payload}`;
	}
	static ParseBWT<ReturnType={[key:string]:any}>(bwt:string, secret?:ArrayBuffer|Uint8Array):ReturnType|null {
		if ( typeof bwt !== "string" ) {
			throw new TypeError("Given bwt argument must be a string!");
		}

		if ( secret instanceof ArrayBuffer ){
			secret = Buffer.from(secret);
		}
		
		if ( !Buffer.isBuffer(secret) && !(secret instanceof Uint8Array) ) {
			throw new Error('Secret must be an instance of Uint8Array, ArrayBuffer or Buffer!');
		}



		const S = bwt.substring(0, 52);
		const P = bwt.substring(52);
		if ( !P || !S ) { return null; }
		
		try {
			const raw_data = Base32HexDecode(P);
			if ( !raw_data ) return null;

			const payload = Beson.Deserialize(raw_data);
			if ( !payload ) return null;
			
			let valid = true;
			if ( arguments.length > 0 ) {
				const verf_sig = Base32HexEncode(Crypto.createHmac("sha256", secret).update(P).digest());
				
				valid = verf_sig === S;
			}
			return valid ? payload : null;
		}
		catch(e) {
			return null;
		}
	}
};





function Base32HexEncode(bytes:Uint8Array):string {
	if ( bytes.length < 1 ) return '';
	
	
	// Run complete bundles
	let encoded = '';
	let begin, loop = Math.floor(bytes.length/5);
	for (let run=0; run<loop; run++) {
		begin = run * 5;
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x3E) >> 1];								// 2
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x01) << 4 | (bytes[begin+2] >> 4)];	// 3
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+2] & 0x0F) << 1 | (bytes[begin+3] >> 7)];	// 4
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+3] & 0x7C) >> 2];								// 5
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+3] & 0x03) << 3 | (bytes[begin+4] >> 5)];	// 6
		encoded += BASE32_ENCODE_CHAR[  bytes[begin+4] & 0x1F];										// 7
	}
	
	// Run remains
	let remain = bytes.length % 5;
	if ( remain === 0 ) { return encoded; }
	
	
	begin = loop*5;
	if ( remain === 1 ) {
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2];								// 1
	}
	else
	if ( remain === 2 ) {
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x3E) >> 1];								// 2
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x01) << 4];								// 3
	}
	else
	if ( remain === 3 ) {
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x3E) >> 1];								// 2
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x01) << 4 | (bytes[begin+2] >> 4)];	// 3
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+2] & 0x0F) << 1];								// 4
	}
	else
	if ( remain === 4 ) {
		encoded += BASE32_ENCODE_CHAR[  bytes[begin]           >> 3];								// 0
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin  ] & 0x07) << 2 | (bytes[begin+1] >> 6)];	// 1
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x3E) >> 1];								// 2
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+1] & 0x01) << 4 | (bytes[begin+2] >> 4)];	// 3
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+2] & 0x0F) << 1 | (bytes[begin+3] >> 7)];	// 4
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+3] & 0x7C) >> 2];								// 5
		encoded += BASE32_ENCODE_CHAR[ (bytes[begin+3] & 0x03) << 3];								// 6
	}
	
	return encoded;
}
function Base32HexDecode(input:string):null|Uint8Array {
	let remain = input.length % 8;
	if ( [0, 2, 4, 5, 7].indexOf(remain) < 0 ) return null;
	
	
	let decoded = new Uint8Array(Math.floor(input.length * 5 / 8));
	
	
	
	
	// Run complete bundles
	let dest, begin, loop = Math.floor(input.length/8);
	for (let run=0; run<loop; run++) {
		begin = run * 8;
		dest  = run * 5;

		const v1 = BASE32_DECODE_CHAR[input[begin]];
		const v2 = BASE32_DECODE_CHAR[input[begin+1]];
		const v3 = BASE32_DECODE_CHAR[input[begin+2]];
		const v4 = BASE32_DECODE_CHAR[input[begin+3]];
		const v5 = BASE32_DECODE_CHAR[input[begin+4]];
		const v6 = BASE32_DECODE_CHAR[input[begin+5]];
		const v7 = BASE32_DECODE_CHAR[input[begin+6]];
		const v8 = BASE32_DECODE_CHAR[input[begin+7]];

		if ( v1 === undefined || v2 === undefined || v3 === undefined || v4 === undefined || v5 === undefined || v6 === undefined || v7 === undefined || v8 === undefined ) {
			throw new RangeError("Given input string is not base32hex encoded!");
		}


		decoded[dest] 	=  v1 << 3 | v2 >> 2;					// 0
		decoded[dest+1] = (v2 & 0x03) << 6 | v3 << 1 | v4 >> 4;	// 1
		decoded[dest+2] = (v4 & 0x0F) << 4 | v5 >> 1;			// 2
		decoded[dest+3] = (v5 & 0x01) << 7 | v6 << 2 | v7 >> 3;	// 3
		decoded[dest+4] = (v7 & 0x07) << 5 | v8;				// 4
	}
	
	if ( remain === 0 ) { return decoded; }
	
	
	
	{
		begin = loop*8;
		dest  = loop*5;

		const v1 = BASE32_DECODE_CHAR[input[begin]];
		const v2 = BASE32_DECODE_CHAR[input[begin+1]];
		const v3 = BASE32_DECODE_CHAR[input[begin+2]];
		const v4 = BASE32_DECODE_CHAR[input[begin+3]];
		const v5 = BASE32_DECODE_CHAR[input[begin+4]];
		const v6 = BASE32_DECODE_CHAR[input[begin+5]];
		const v7 = BASE32_DECODE_CHAR[input[begin+6]];


		if ( remain >= 2 ) {
			if ( v1 === undefined || v2 === undefined ) {
				throw new RangeError("Given input string is not base32hex encoded!");
			}

			decoded[dest] =  v1 << 3 | v2 >> 2;						// 0
		}
		
		if ( remain >= 4 ) {
			if ( v2 === undefined || v3 === undefined || v4 === undefined ) {
				throw new RangeError("Given input string is not base32hex encoded!");
			}

			decoded[dest+1] = (v2 & 0x03) << 6 | v3 << 1 | v4 >> 4;	// 1
		}
		
		if ( remain >= 5 ) {
			if ( v4 === undefined || v5 === undefined ) {
				throw new RangeError("Given input string is not base32hex encoded!");
			}

			decoded[dest+2] = (v4 & 0x0F) << 4 | v5 >> 1;			// 2
		}
		
		if ( remain === 7 ) {
			if ( v5 === undefined || v6 === undefined || v7 === undefined ) {
				throw new RangeError("Given input string is not base32hex encoded!");
			}

			decoded[dest+3] = (v5 & 0x01) << 7 | v6 << 2 | v7 >> 3;	// 3
		}
	}
	
	return decoded;
}