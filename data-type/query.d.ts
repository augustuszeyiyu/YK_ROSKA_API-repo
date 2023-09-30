
declare type TypeDBInfo = {
	client: import('mongodb').MongoClient|null,
	db:     import('mongodb').Db|null,
};

declare type Collection = import('mongodb').Document;
declare type QueryCondition     = {[field:string]:any};
declare type UpdateFilter    = {[field:string]:any};
declare type QueryProjection = {[field:string]:number};
declare type QueryOption = {
    multiple?:  boolean, 
    upsert?:    boolean
	projection?:QueryProjection,
};
declare type UpdateOperator = {
    query?: QueryCondition,
    update_op?: object,
    dbOptions?: QueryOption
} | [
    query?: QueryCondition,
    update_op?: object,
    dbOptions?: QueryOption
]
declare type HuntPage = {    
    records: object|null,
    meta: {
        page: number,
        page_size: number,
        total_pages: number,
        total_records:number
    }
};