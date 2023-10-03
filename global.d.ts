import ajv from "ajv";
import redipc from "redipc";
import {RedisClient, createClient} from "redis";
import mongodb from "mongodb";
import { VarStore } from "varstore";
import { Http_Send_Mail_Noti } from "/data-type/mail.js"
import { User } from "./data-type/user";
import {SysVarControl} from "/lib/sysvar.js";
import MQTTCore from "./lib/mqttcore.js";

declare global {
	interface ExtendedSharedStorage {
		ajv: ajv;
		promise:{<DataType = any>(handler:{(callback:{(err:Error, data:any):void}):void}):Promise<DataType>};
		sysvar:SysVarControl;
		STORAGE_ROOT: string;	
	}


	interface PaginateCursor<RecordType> {
		records:RecordType[];
		meta: {
			page:uint;
			page_size:uint;
			total_records:uint;
			total_pages:uint;
		}
	}

	// #region DEPRECATED
	type HuntSuccResponse = {
		code:string;
		[key:string]:any;
	};
	type HuntErrorResponse = {
		code:string;
		msg:string;
		detail?:any;
	};
	type HuntErrorItem = HuntErrorResponse & {status?:number};
	// #endregion


	interface APIErrorResponse {
		scope:string;
		code:string;
		msg:string;
		detail?:any;
	};
	type APIResponse<SuccessType=any> = SuccessType|APIErrorResponse;





	type LoginSession = {
		source: 'unkown'|'cookie'|'auth';
		is_login: boolean;
		token?: RoscaSessToken;
		raw_token?: string;
		admin_level?: number;
	};
	type RoscaSessToken = {
		tid: string, 	// token's corresponding unique id
		uid: string, 	// related user's unique id
		role: string,
		iss: string, 	// issuer
		iat: number, 	// epoch timestamp
		exp: number 	// expired time - epoch timestamp
	};
	type HuntRefreshToken = Pick<RoscaSessToken, 'tid'|'exp'>
}

declare module 'fastify' {
	export interface FastifyRequest {
		time: number;
		time_milli:number;
		session: LoginSession
	}
	export interface FastifyReply {
		errorHandler: (error_info: HuntErrorItem, detail?:any)=>void
	}
}