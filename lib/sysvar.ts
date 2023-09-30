export interface IDataAccessor {
	get<DataType=any>(key:string):Promise<DataType>;
	set<DataType=any>(key:string, value:DataType):Promise<void>;
	del(key:string):Promise<void>;
}

export class SysVarControl {
	private _accessor:IDataAccessor;
	constructor(accessor:IDataAccessor){
		this._accessor = accessor;
	}

	async get_var<DataType=any>(key:string):Promise<DataType> {
		return await this._accessor.get<DataType>(key);
	}

	async set_var<DataType=any>(key:string, value:DataType):Promise<void> {
		await this._accessor.set<DataType>(key, value);
		return;
	}

	async del_var(key:string):Promise<void> {
		await this._accessor.del(key);
		return;
	}
}
