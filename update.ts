/**
 *	Author: JCloudYu
 *	Create: 2021/03/25
**/
import "extes";
import $ from "shared-storage";
import {Updator} from 'updator';
import fsp = require("fs/promises");
import reroot = require("reroot");
reroot.root_path = `${reroot.root_path}/_dist`;

import phook from "phook";
phook.configure({durations:{UNHANDLED_ERROR:100}});


import Config from "/config.default.js";
Object.merge(Config, reroot.safe_require(require)('/config.js'));

import PostgreFactory from "/data-source/postgres.js";







Promise.chain(async()=>{
	const ARGS = process.argv.slice(2);
	await (await import('./index.init.js')).default();
	await (await import('./index.db.js')).default();
	

	

	const updator = Updator.init({
		script_exts: ['sql', 'js'],
		update_handler: {
			get_version: ()=>$.sysvar.get_var<string>('version').then((v)=>v===undefined?null:v),
			set_version: (v:string)=>$.sysvar.set_var<string>('version', v).then(()=>undefined),
			handle_update: async(type, {path:script_path, name:script_name}, prev_version)=>{
				if ( type === 'sql' ) {
					const sql_content = await fsp.readFile(script_path, {encoding:'utf8'});
					await PostgreFactory.zone(async(client)=>{
						await client.query({text:'BEGIN;'});
						const result = await client.query({text:sql_content}).catch(e=>e);
						if ( result instanceof Error ) {
							await client.query({text:'ROLLBACK;'});
							throw result;
						}
	
						await client.query({text:'COMMIT;'});
					});
				}
				else
				if ( type === 'js' ) {
					const update_task:(prev:string|null)=>void = require('file://' + script_path);
					if ( typeof update_task === "function" ) {
						return update_task(prev_version);
					}
				}
			}
		},
		source_dir: `${reroot.project_root}/updates`,
	});


	updator.on('updating', (_, version)=>console.log(`Updating to ${version}`));
	updator.on('update-end', (_)=>console.log("All updated!"));
	await updator.update(ARGS[0]);
	
	


	await PostgreFactory.release();
	process.exit(0);
});