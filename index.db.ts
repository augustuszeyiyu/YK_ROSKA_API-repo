import fs from "fs";
import path from "path";
import reroot from 'reroot';
import $ from "shared-storage";

import Config from '/config.default.js';
import PostgreFactory from "/data-source/postgres.js";
import {IDataAccessor, SysVarControl} from "/lib/sysvar.js";



export default async function() {
	console.log("Init Postgres connection...");
	{
		if ( Config.postgres.ssl?.ca ) {
			const content = fs.readFileSync(path.resolve(reroot.project_root, Config.postgres.ssl.ca)).toString();
			Config.postgres.ssl.ca = content;
		}
		if ( Config.postgres.ssl?.key ) {
			const content = fs.readFileSync(path.resolve(reroot.project_root, Config.postgres.ssl.key)).toString();
			Config.postgres.ssl.key = content;
		}
		if ( Config.postgres.ssl?.cert ) {
			const content = fs.readFileSync(path.resolve(reroot.project_root, Config.postgres.ssl.cert)).toString();
			Config.postgres.ssl.cert = content;
		}

		await PostgreFactory.init(Config.postgres);
	}

	console.log("Init sysvar system...");
	{
		// Move out
		const Accessor:IDataAccessor = {
			async get<DataType=any>(key:string):Promise<DataType> {
				const {rows:[result]} = await PostgreFactory.query<{value:DataType}>(`SELECT value FROM sysvar WHERE key = $1;`, [key]);
				return result.value;
			},
			async set<DataType=any>(key:string, value:DataType):Promise<void> {
				await PostgreFactory.query(
					`INSERT INTO sysvar (key, value) VALUES ($1, $2)
						ON CONFLICT (key) DO UPDATE SET value = $2;
					`,
					[key, JSON.stringify(value)]
				);
			},
			async del(key:string):Promise<void> {
				await PostgreFactory.query(`DELETE FROM sysvar WHERE key = $1;`, [key]);
			}
		}

		$.sysvar = new SysVarControl(Accessor);
	}
}
