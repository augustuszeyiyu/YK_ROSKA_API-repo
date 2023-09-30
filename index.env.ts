import fsp from "fs/promises";
import path from "path";
import Ajv from "ajv";
import {Version} from "updator";
import EJSTmpl from "ejstmpl";
import reroot from 'reroot';
import $ from "shared-storage";

import Config from '/config.default.js';
import {Decrypt} from '/lib/crypt_decrypt.js';
import ProjectInfo from "/package.json";


export default async function() {
	EJSTmpl.search_root = `${reroot.project_root}/tmpl`;



	// Init ajv and other helper functions
	$.ajv = new Ajv();
	$.tmpl = (tmpl_path, tmpl_data)=>EJSTmpl.init(tmpl_path).render(tmpl_data);




	console.log('Initialize image files directory...');
	$.STORAGE_ROOT = path.resolve(reroot.project_root, Config.storage_root);

	// Prepare storage directories
	{
		await fsp.mkdir(`${$.STORAGE_ROOT}/upload_cache`, {recursive:true});
		await fsp.mkdir(`${$.STORAGE_ROOT}/files`, {recursive:true});
	}



	

	// Version compare
	console.log("Checking system version...");
	{
		const version_str = await $.sysvar.get_var<string>('version');
		if ( version_str === undefined ) {
			console.error("\u001b[91mThe system has not been initialized yet!\nPlease run update to initialize the system!\u001b[39m");
			return false;
		}

		console.log(version_str||'0.0.0', ProjectInfo.version);
		const compare = Version.compare(version_str||'0.0.0', ProjectInfo.version);
		if ( compare < 0 ) {
			console.error("\u001b[91mCurrent system version is behind source code version!\nPlease update the system first!\u001b[39m");
			return false;
		}

		if ( compare > 0 ) {
			console.error("\u001b[93mThe source code version is behind current system version!\nPlease update source code version in package.json!\u001b[39m");
		}
	}
}