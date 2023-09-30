declare type bytes			= Uint8Array;

declare type uniqid			= string;

declare type hex			= `0x${string}`;
declare type base64			= string;
declare type base32			= string;
declare type base58			= string;
declare type http_str		= `${'http'|'https'}://${string}`;
declare type email_str		= `${string}@${string}.${string}`;

declare type uint			= number;
declare type uint8			= number;
declare type uint16			= number;
declare type uint32			= number;

declare type int			= number;
declare type int8			= number;
declare type int16			= number;
declare type int32			= number;

declare type int_str		= string;
declare type uint_str		= string;

declare type float			= number;
declare type float32		= float;
declare type double			= number;
declare type float64		= double;

declare type epoch			= number;
declare type epoch_milli	= number;
declare type num_str		= string;
declare type json_str		= string;


declare type AnyObject = {[key:string|number|symbol]:any}
declare type EmptyObject = {[K in any]:never};
declare type Without<T, U> = {[P in Exclude<keyof T, keyof U>]?:never};
declare type XOR<T, U> = (T | U) extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;
declare type DeepPartial<T> = {[P in keyof T]?: DeepPartial<T[P]>;};
declare type ObjectKeys<T extends {[key:string]:any}> = keyof T;
declare type ObjectValues<T extends {[key:string]:any}> = T[keyof T];
declare type MakeRequired<T, R extends keyof T> = T & Required<Pick<T, R>>;
declare type MakePartial<T, R extends keyof T> = Omit<T, R> & Partial<Pick<T, R>>;
declare type MakeExcluded<T, E extends keyof T> = Omit<T, E>;





// Postgres Types
declare namespace PostgresTypes {
	type BigSerial	= num_str;
	type BigInt		= num_str;
	type Numeric	= num_str;
	type Decimal	= num_str;
	type LTree		= string;
	type Serial		= int32;
	type Integer	= int32;
	type SmallInt	= int16;
	type Real		= float32;
	type Double		= float64;
}