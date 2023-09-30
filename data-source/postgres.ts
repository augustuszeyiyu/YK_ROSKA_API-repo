/**
 *	Author: cheny
 *	Create: 2021-08-10
**/
import postgres from "pg";
import Cursor from "pg-cursor";

import {URI} from "/lib/uri.js";
import {PostgresHelper} from "/lib/postgres.js";


 
const RUNTIME:{
	sess_inst?:PostgreSession
} = {};

type ScopeHandler<ClientInst, ReturnType=any> = (inst:ClientInst)=>ReturnType|Promise<ReturnType>;
type PostgresSessionInitOptions = { uri:string; } & postgres.PoolConfig;
type Condition = {condition:string, values:any[]}

export class PostgresTableClient {
	private _client:postgres.PoolClient;
	private _table:string;
	private _schema:string;
	private _index:number;

	get client():postgres.PoolClient {
		return this._client;
	}

	get schema():string { return this._schema; }
	set schema(v:string) { this._schema = v.trim(); }

	get table():string { return this._table; }
	set table(v:string) { this._table = `${this._schema}.` + v.trim(); }

	constructor(client:postgres.PoolClient, table_name:string, target_schema:string='public') {
		this._client = client;
		this._index = 1;
		this.schema = target_schema;
		this.table = table_name;
	}
	public async release():Promise<void> {
		this._client.release();
	}


	
	public async QueryDocument(condition?:QueryCondition, order?:object, projection?:string[], join:string='') {
		this._index=1;
		const payload = this.GetWhereConditions(condition);
		const select = projection && projection.length>0 ? projection.join(',') : '*';
		const orderby = order? this.getOrderBy(order) : '';

		
		if (condition && payload.values.length===0) {
			return [];
		}
		
		
		const query:postgres.QueryConfig = {
			text: `SELECT ${select} FROM ${this._table} ${join} ${payload.condition} ${orderby}`,
			values: payload.values,
		};
		// console.log(query);
		

		const { rows } = await this._client.query(query);		
		return rows;
	}
	public async QueryByFunciton(func:string, params:any[]=[]) {
		this._index=1;
		const args:any[]=[], payload:any[]=[];
		for (let index = 1; index <= params.length; index++) {			
			args.push(`$${index}`)
		}

		const query:postgres.QueryConfig = {
			text: `SELECT * FROM ${func}(${args.join(',')})`,
			values: params,
		};
		
		const { rows } = await this._client.query(query);		
		return rows;
	}
	public async UpdateDocument(condition:QueryCondition={}, update_op:UpdateFilter={}) {
		this._index=1;
		let payload:any;
		const updates = this.GetUpdates(update_op);

		const [key] = Object.keys(condition);
		if (Array.isArray(condition[key])) {
			payload = this.GetInCondition(condition);
		}
		else {			
			payload = this.GetWhereConditions(condition);
		}
		
		const query:postgres.QueryConfig = {
			text: `Update ${this._table} set ${updates.update.join(',')} ${payload.condition} RETURNING *`,
			values: updates.values.concat(payload.values),
		};
		
		const {rows:[row]} = await this._client.query(query);
		return row;	
	}
	public async UpsertDocument(insert_data:object, columns:string[], update_op:UpdateFilter={}) {
		this._index=1;
		const keys:string[]=[];
		const insert_values:any[] = [];

		for (const key in insert_data) {
			const elm = insert_data[key];
			if (['from', 'to'].includes(key))  keys.push(`"${key}"`);
			else keys.push(`${key}`);

			insert_values.push(`$${this._index++}`);
		}
		const updates = this.GetUpdates(update_op, true);


		const query = {
			text:  `INSERT INTO ${this._table}(${keys.join(',')}) VALUES(${insert_values.join(',')})
					ON CONFLICT (${columns.join(',')}) DO UPDATE SET ${updates.update.join(',')}
					RETURNING ${Object.keys(insert_data)[0]}`,
			values: Object.values(insert_data).concat(updates.values)
		}
		 
		console.log(query);
		
		const {rows:[row]} = await this._client.query(query);
		return row;
	}
	public async InsertDocument(data:object) {
		this._index=1;
		const keys:any[] = [];
		const values:any[] = [];

		for (const key in data) {
			const elm = data[key];
			if (['from', 'to'].includes(key))  keys.push(`"${key}"`);
			else keys.push(`${key}`);

			values.push(`$${this._index++}`);
		}

		const query = {
			text: `INSERT INTO ${this._table}(${keys.join(',')}) VALUES(${values.join(',')}) RETURNING *`,
			values: Object.values(data)
		}
		 
		// console.log(query);
		
		const {rows} = await this._client.query(query);
		return rows[0];	
	}
	public async CustomInsertDocument(query:string) {
		const {rows} = await this._client.query(query);
		console.log(rows);
		
		return rows;
	}
	public async CountDocument(condition:QueryCondition):Promise<number> {
		this._index=1;		
		const payload = this.GetWhereConditions(condition);

		const query = {
			text: `SELECT COUNT(*) FROM ${this._table} ${payload.condition}`,
			values: payload.values
		};
		

		const {rows:[row]} = await this._client.query(query);			
		return row? parseInt(row.count) : 0;
	}
	public async DeleteDocument(condition:QueryCondition) {
		this._index=1;
		const payload = this.GetWhereConditions(condition);
		
		const query = {
			text:  `DELETE FROM ${this._table} ${payload.condition} RETURNING *`,
			values: payload.values
		}
		
		const { rows } = await this._client.query(query);			
		return rows[0];		
	}
	private GetWhereConditions(condition?:QueryCondition):Condition {
		if (!condition || Object.keys(condition).length===0) return {condition:'', values:[]};;
		
		let values:any[]=[], cond='';
		
		for (const _key in condition) {
			const elm = condition[_key];

			
			if (cond.length > 5) {				
				cond += `AND ${_key}=$${this._index++} `
			}
			else {
				cond += `WHERE ${_key}=$${this._index++} `
			}

			if (Array.isArray(elm)) {
				let contents:any[] = [];
				for (const it of elm) {
					if (typeof it == 'string')	contents.push(`'${it}'`);
					else contents.push(`${it}`);
				}
				values.push(`Array[${contents.join(',')}]`);
			}
			else values.push(elm);			
		};
		return {condition:cond, values};
	}
	private GetInCondition(condition:QueryCondition):Condition {

		const temp:string[] = [];
		const [key] = Object.keys(condition);
		for (const elm of condition[key]) {
			temp.push(`$${this._index++}`);			
		}
		let cond = `WHERE ${key} in (${temp.join(',')})`;
		
		return {condition:cond, values:condition[key]};
	}
	private GetUpdates(update_op:UpdateFilter, conflic:boolean=false) {
		const update:string[] = [];
		const values:any[] = [];

		for (const key in update_op) {
			if (['from', 'to'].includes(key)) update.push(`"${key}"=$${this._index++}`);
			else if ( Array.isArray(update_op[key]) ) {
				const operator = update_op[key][0];
				const value = update_op[key][1];
				switch (operator) {
					case '+':
						update.push(`${key} = ${key} + $${this._index++}`);
						break;
					case '-':
						update.push(`${key} = ${key} - $${this._index++}`);
						break;
					case '*':
						update.push(`${key} = ${key} * $${this._index++}`);
						break;
					case '/':
						update.push(`${key} = ${key} / $${this._index++}`);
						break;
				}
	
				console.log(update);
				values.push(value);
			}
			else {
				update.push(`${key}=$${this._index++}`);
				values.push(update_op[key]);
			};
		}
		return {update, values};
	}
	private getOrderBy(orderby:object) {
		let sort:string;
		for (const key in orderby) {
			switch (orderby[key]) {
				case 1:
					sort = 'ASC';
					break;
				case -1:
					sort = 'DESC';
					break;
				default:
					sort = 'ASC';
					break;
			}
			
			return `ORDER BY ${key} ${sort}`;			
		}
	}
	private operator(update_op:UpdateFilter={}) {
		let update:string='';
		const first_key = Object.keys(update_op)[0];
		if (Array.isArray(update_op[first_key])) {
			const operator = update_op[first_key][0];
			const value = update_op[first_key][1];
			switch (operator) {
				case '+':
					update = `${first_key} = ${first_key} + ${this._index++}`
					break;
				case '-':
					update = `${first_key} = ${first_key} - ${this._index++}`
					break;
				case '<':
					update = `${first_key} < ${this._index++}`
					break;
				case '<@':
					update = `${first_key} <@ ${this._index++}`
					break;
				case '>':
					update = `${first_key} > ${this._index++}`
					break;
				case '>@':
					update = `${first_key} >@ ${this._index++}`
					break;
			}

			console.log(update);
			
			return {update, values:[value]};
		}
	}
}
export class PostgreSession {
	private conn_pool:postgres.Pool|null = null;
	private client: postgres.PoolClient;
	
	async inst():Promise<postgres.PoolClient>;
	async inst(table_name:string):Promise<PostgresTableClient>;
	async inst(table_name?:string):Promise<PostgresTableClient|postgres.PoolClient> {
		if ( this.conn_pool === null ) {
			throw new Error("PostgreSession is not initialized yet!");
		}


		const client = await this.conn_pool.connect();
		if ( table_name === undefined ) return client;

		return new PostgresTableClient(client, table_name);
	}
	async init(conn_info:PostgresSessionInitOptions):Promise<void> {
		if ( this.conn_pool !== null ) return;

		const {user:_1, password:_2, host:_3, database:_4, port:_5, ...conn_options} = conn_info;



		const uri_info = URI(conn_info.uri);
		const uri_path = uri_info.path!;
		
		let sep = uri_path.indexOf('/', 1);
        const db_name = uri_path.substring(1, sep<=0?uri_path.length:sep);
		const port = uri_info.port||5432;

		
		this.conn_pool = new postgres.Pool({
			user:uri_info.username!,
			password:uri_info.password!,
			host:uri_info.hostname!,
			port,
			database:db_name,
			...conn_options
		});

		this.client = await this.conn_pool.connect();
		this.client.release();
	}

	async release() {
		await this.conn_pool?.end();
		this.conn_pool = null;
	}
}

type CursorHandler<ReturnType=any> = (cursor:Cursor<ReturnType>)=>void|Promise<void>;


export default class PostgreSQL {
	public static async zone<ReturnType=any>(handler:ScopeHandler<postgres.PoolClient, ReturnType>):Promise<ReturnType>;
	public static async zone<ReturnType=any>(table_name:string, handler:ScopeHandler<PostgresTableClient, ReturnType>):Promise<ReturnType>;
	public static async zone<ReturnType=any>(table_name:string|ScopeHandler<postgres.PoolClient, ReturnType>, handler?:ScopeHandler<PostgresTableClient>):Promise<ReturnType> {
		const instance = RUNTIME.sess_inst;
		if ( !instance ) throw new Error(`PGFactory hasn't initialized yet!`);


		if ( typeof table_name === "function" ) {
			let inst_client = await instance.inst();


			return Promise.resolve()
			.then(()=>table_name(inst_client))
			.finally(()=>inst_client.release());
		}
		else 
		if ( typeof handler === "function" ) {
			let inst_client = await instance.inst(table_name);


			return Promise.resolve()
			.then(()=>handler(inst_client))
			.finally(()=>inst_client.release());
		}
		else {
			throw new Error("Scope handler is required!");
		}
	}



	public static async auto_release<ReturnType=any>(handler:ScopeHandler<postgres.PoolClient, ReturnType>):Promise<ReturnType> {
		const instance = RUNTIME.sess_inst;
		if ( !instance ) throw new Error(`PGFactory hasn't initialized yet!`);


		if (typeof handler !== "function") {
			throw new Error("Session handler is required!");
		}


		let inst_client = await instance.inst();


		return Promise.resolve()
		.then(()=>handler(inst_client))
		.finally(()=>inst_client.release());
	}
	public static async transaction(handler:ScopeHandler<postgres.PoolClient>):Promise<void> {
		const instance = RUNTIME.sess_inst;
		if ( !instance ) throw new Error(`PGFactory hasn't initialized yet!`);


		let inst_client = await instance.inst();
		
		await inst_client.query('BEGIN;')
			.then(()=>handler(inst_client))
			.then(()=>inst_client.query('COMMIT;'))
			.catch(async(e)=>{
				await inst_client.query('ROLLBACK')
				return Promise.reject(e);
			})
			.finally(()=>inst_client.release());
		return;
	}
	public static async query<ReturnType extends postgres.QueryResultRow=any, ValueType=any>(text:string, values?:ValueType[]):Promise<postgres.QueryResult<ReturnType>> {
		const instance = RUNTIME.sess_inst;
		if ( !instance ) throw new Error(`PGFactory hasn't initialized yet!`);


		let inst_client = await instance.inst();
		return Promise.resolve().then(()=>{
			if ( typeof values === undefined ) {
				return inst_client.query<ReturnType>(text);
			}

			return inst_client.query<ReturnType>({text, values});
		})
		.finally(()=>inst_client.release());
	}
	public static async insert<InsertType extends {[key:string]:any} = {[key:string]:any}>(table_name:string, data:InsertType):Promise<any> {
		const instance = RUNTIME.sess_inst;
		if ( !instance ) throw new Error(`PGFactory hasn't initialized yet!`);

		let inst_client = await instance.inst();


		return Promise.resolve().then(()=>{
			const escaped_table = PostgresHelper.column_escape(table_name)
			const escaped_columns:string[] = [], value_anchors:string[] = [];
			let count = 1;
			for(const column of Object.keys(data)) {
				escaped_columns.push(PostgresHelper.column_escape(column));
				value_anchors.push(`$${count++}`);
			}

			return inst_client.query({text:`INSERT INTO ${escaped_table} (${escaped_columns.join(', ')}) VALUES (${value_anchors.join(', ')})`, values:Object.values(data)});
		})
		.finally(()=>inst_client.release());
	}

	public static async cursor<ReturnType=any, ValueType=any>(text:string, handler:CursorHandler<ReturnType>):Promise<void>
	public static async cursor<ReturnType=any, ValueType=any>(text:string, values:ValueType[], handler:CursorHandler<ReturnType>):Promise<void>;
	public static async cursor<ReturnType=any, ValueType=any>(text:string, values:ValueType[]|CursorHandler, handler?:CursorHandler<ReturnType>):Promise<void> {
		const instance = RUNTIME.sess_inst;
		if ( !instance ) throw new Error(`PGFactory hasn't initialized yet!`);

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


		let inst_client = await instance.inst();
		return Promise.resolve().then(async()=>{
			const cursor = inst_client.query(new Cursor<ReturnType>(text, _values));
			await _handler!(cursor);
			await cursor.close();
		})
		.finally(()=>inst_client.release());
	}

	public static async init(init_info:PostgresSessionInitOptions) {
		const instance = new PostgreSession();
		await instance.init(init_info);
		
		RUNTIME.sess_inst = instance;
	}

	public static async release() {
		await RUNTIME.sess_inst?.release();
	}
}