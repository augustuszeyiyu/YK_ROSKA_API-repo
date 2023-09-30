/**
 *	Author: cheny
 *	Create: 2021-10-29
**/
import TrimId = require('trimid');




export class File {
	public id:string = "";
	public uid: uniqid = "";  	// 上傳者 user id
	public name: string = ""; 	// 原始檔案名稱，沒有的話使用 id 當作檔案名稱
	public size: number = 0;  	// bytes
	public ext: string = "";  	// 副檔名，沒有的話空字串
	public type: string = ""; 	// mime type 前半段
	public mime: string = ""; 	// mime type
	public path: string = "";  	// 儲存路徑
	public create_time:number = 0;

	constructor() {
		this.id = TrimId.NEW.toString(32);
	}

	public static create():File { return new File; }
	public static insert_required(data:File) {
		return {
			id: data.id,
			uid: data.uid,
			name: data.name,
			size: data.size,
			ext: data.ext,
			type: data.type,
			mime: data.mime,
			path: data.path
		}
	}
}
