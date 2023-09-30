import $ from "shared-storage";

export default async function() {
	$.promise = (handler)=>new Promise((resolve, reject)=>handler((error, data)=>error?reject(error):resolve(data)));
}