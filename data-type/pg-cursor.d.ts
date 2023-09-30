declare module "pg-cursor" {
	import {Connection} from "pg";

	interface CursorQueryConfig<T = any> {
		rowMode?: string;
		types?: (any)=>T;
	}

	class Cursor<ResultType = any> {
		constructor(text:string, values:any[], config?:CursorQueryConfig);
		submit(connection:Connection):void;
		close():Promise<void>;
		read(row_count:number):Promise<ResultType[]>;
	}
	export = Cursor;
}