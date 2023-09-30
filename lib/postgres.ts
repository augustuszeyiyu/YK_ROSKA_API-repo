/**
 *	Author: cheny
 *	Create: 2021-08-10
**/
import pg from "pg";
import Cursor from "pg-cursor";



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
function URI(uri:string):URIInfo {
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





type ScopeHandler<ClientInst, ReturnType=any> = (inst:ClientInst)=>ReturnType;
type PostgresSessionInitOptions = { uri:string; } & pg.PoolConfig;
type CursorHandler<ReturnType=any> = (cursor:Cursor<ReturnType>)=>void|Promise<void>;
type QueryDesc<ValueType extends any[] = any[]> = {text:string, values?:ValueType};


interface PGClient extends pg.PoolClient {
	sql<ReturnType extends pg.QueryResultRow=any, ValueType extends any[] = any[]>(query:QueryDesc<ValueType>):Promise<pg.QueryResult<ReturnType>>;
	sql<ReturnType extends pg.QueryResultRow=any, ValueType extends any[] = any[]>(text:string, values?:ValueType):Promise<pg.QueryResult<ReturnType>>;
};


// Overwrite all existing pg.Client.query to support dynamic
{
	// @ts-ignore
	pg.Client.prototype.sql = function(text:any, values:any, callback:any) {
		if ( typeof text === "string" ) {
			if ( typeof values === "function" ) {
				callback = values;
				values = false;
			}

			const args:any[] = [{text}];
			if ( values ) { args[0].values = values; }
			if ( typeof callback === "function" ) { args.push(callback); }
			return this.query(...args);
		}
		else {
			const args:any[] = [text];
			if ( typeof values === "function" ) { args.push(values); }
			return this.query(...args);
		}
	}
}


export default class PostgreSession {
	private conn_pool:pg.Pool|null = null;
	

	static async init(conn_info:PostgresSessionInitOptions):Promise<PostgreSession> {
		const session_inst = new PostgreSession();
		const {user:_1, password:_2, host:_3, database:_4, port:_5, ...conn_options} = conn_info;
		
		const uri_info = URI(conn_info.uri);
		const uri_path = uri_info.path!;
		
		let sep = uri_path.indexOf('/', 1);
        const db_name = uri_path.substring(1, sep<=0?uri_path.length:sep);
		const port = uri_info.port||5432;

		
		session_inst.conn_pool = new pg.Pool({
			user:uri_info.username!,
			password:uri_info.password!,
			host:uri_info.hostname!,
			port,
			database:db_name,
			...conn_options
		});

		const client = await session_inst.conn_pool.connect();
		client.release();

		return session_inst;
	}
	async release() {
		await this.conn_pool?.end();
		this.conn_pool = null;
	}

	
	async scoped<ReturnType=any>(handler:ScopeHandler<PGClient, ReturnType>, transaction:boolean=false):Promise<ReturnType> {
		if (typeof handler !== "function") {
			throw new Error("Session handler is required!");
		}


		const inst_client:PGClient = <PGClient>(await this.instantiate());

		if ( !transaction ) {
			return Promise.resolve()
			.then(()=>handler(inst_client))
			.finally(()=>inst_client.release());
		}
		else {
			return inst_client.query('BEGIN;')
			.then(()=>handler(inst_client))
			.then(async(r)=>{
				await inst_client.query('COMMIT;');
				return r;
			})
			.catch(async(e)=>{
				await inst_client.query('ROLLBACK;');
				return Promise.reject(e);
			})
			.finally(()=>inst_client.release());
		}
	}
	
	async query<ReturnType extends pg.QueryResultRow=any, ValueType extends any[] = any[]>(query:QueryDesc<ValueType>):Promise<pg.QueryResult<ReturnType>>;
	async query<ReturnType extends pg.QueryResultRow=any, ValueType extends any[] = any[]>(text:string, values?:ValueType):Promise<pg.QueryResult<ReturnType>>;
	async query<ReturnType extends pg.QueryResultRow=any, ValueType extends any[] = any[]>(...args:any[]):Promise<pg.QueryResult<ReturnType>> {
		// @ts-ignore
		return this.sql(...args);
	}

	async sql<ReturnType extends pg.QueryResultRow=any, ValueType extends any[] = any[]>(query:QueryDesc<ValueType>):Promise<pg.QueryResult<ReturnType>>;
	async sql<ReturnType extends pg.QueryResultRow=any, ValueType extends any[] = any[]>(text:string, values?:ValueType):Promise<pg.QueryResult<ReturnType>>;
	async sql<ReturnType extends pg.QueryResultRow=any, ValueType extends any[] = any[]>(...args:any[]):Promise<pg.QueryResult<ReturnType>> {
		const inst_client:PGClient = <PGClient>(await this.instantiate());
		// @ts-ignore
		return Promise.resolve().then(()=>inst_client.sql(...args))
		.finally(()=>inst_client.release());
	}

	async cursor<ReturnType=any, ValueType=any>(text:string, handler:CursorHandler<ReturnType>):Promise<void>
	async cursor<ReturnType=any, ValueType=any>(text:string, values:ValueType[], handler:CursorHandler<ReturnType>):Promise<void>;
	async cursor<ReturnType=any, ValueType=any>(text:string, values:ValueType[]|CursorHandler, handler?:CursorHandler<ReturnType>):Promise<void> {
		let _values:ValueType[];
		let _handler:CursorHandler|null;

		if ( typeof values === "function" ) {
			_handler = values;
			_values = [];
		}
		else {
			_values = values;
			_handler = handler||null;
		}

		if ( typeof _handler !== "function" ) {
			throw new SyntaxError("cursor handler is required!");
		}

		if ( !Array.isArray(_values) ) {
			throw new SyntaxError("values must be an array!");
		}


		let inst_client = await this.instantiate();
		return Promise.resolve().then(async()=>{
			const cursor = inst_client.query(new Cursor<ReturnType>(text, _values));
			await _handler!(cursor);
			await cursor.close();
		})
		.finally(()=>inst_client.release());
	}

	private async instantiate():Promise<pg.PoolClient> {
		if ( this.conn_pool === null ) {
			throw new Error("PostgreSession is not initialized yet!");
		}

		return await this.conn_pool.connect();
	}
}

export class PostgresHelper {
	static column_escape(column:string):string;
	static column_escape(columns:string[]):string[];
	static column_escape(columns:string[], return_anchor:true):[string[],string[]];
	static column_escape(column:string|string[], return_anchors?:boolean):string|string[]|[string[],string[]] {
		if ( typeof column === "string" ) {
			return '"' + column.replace(/(?<!\\)\"/, "\\\"") + '"';
		}
		else 
		if ( Array.isArray(column) ) {
			if ( !return_anchors ) {
				return column.map((v)=>'"' + v.replace(/(?<!\\)\"/, "\\\"") + '"');
			}
			else {
				const anchors:string[] = [], columns:string[] = [];
				column.forEach((v, i)=>{
					columns.push('"' + v.replace(/(?<!\\)\"/, "\\\"") + '"');
					anchors.push(`$${i+1}`);
				});
				return [columns, anchors];
			}
		}

		throw new TypeError("Given column must be a string or a string array!");
	}
}