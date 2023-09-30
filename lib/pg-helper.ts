export default class PGHelper {
	static buildUpdateMap(field_list:string[], from_index:number=1):{columns:string[], spreads:string[], index:number} {
		const columns:string[] = [];
		const spreads:string[] = [];
		for(const field_name of field_list) {
			if (field_name.indexOf('"') >= 0) throw new Error("Character \" is not allowed in column names");
			columns.push(`"${field_name}"`);
			spreads.push(`$${from_index++}`);
		}
	
		return {columns, spreads, index:from_index};
	}
};