import "extes";
import fs from "fs";
import path from "path";



// Type to the configurable fiels
export interface ConfigFormat {
	show_log?:boolean; swagger_active?:boolean;
	serve_at?: { host:string; port:number; url:string; };
	postgres?: {
		uri:string;
		max?:number;
		ssl?:{rejectUnauthorized?:boolean;ca?:string;key?:string;cert?:string;};
	};
	secret?: {
		session:Buffer;
	};
	cookie: {
		domain: string,
		cookie_session_id: string,
	}
	storage_root: '/tmp',	
};

// The default values
const config:Required<ConfigFormat> = {
	show_log:true, swagger_active:true,
	serve_at: { host:'localhost', port:33688, url:'https://www.roska-ya.net'},
	postgres: { 
		uri:'postgres://roska:036688231@172.30.2.161/yk5_roska', 
		max: 15
	},
	secret: {
		session: Buffer.alloc(0),
	},
	cookie: {
		domain: '',
		cookie_session_id: '',
	},
	storage_root: '/tmp',	
};
export default config;









// #region [ Overwrites default configurations ]
{
	const GLOBAL_PATHS = (process.env['DYNCONF_SEARCH_PATHS']||'').split(',').map(v=>v.trim()).filter((v)=>v.trim()!=='');
	const CONFIG_PATHS:string[] = [ './config.js', ...GLOBAL_PATHS ];
	for(const candidate of CONFIG_PATHS) {
		const script_path = path.resolve(__dirname, candidate)
		try {
			fs.accessSync(script_path, fs.constants.F_OK|fs.constants.R_OK);
		}
		catch(e:any) {
			const error:NodeJS.ErrnoException = e;
			if ( error.code === 'ENOENT' ) {
				console.log(`No configuration file found at ${script_path}! Skipping...`);
				continue;
			}
			throw e;
		}

		// Modify following line if absolute path has be rewritten!
		const overwritten = require('file://' + script_path);
		if ( Array.isArray(overwritten) || Object(overwritten) !== overwritten ) {
			console.error(`File "${script_path}" contains none-object configurations! Skipping...`);
			continue;
		}

		// @ts-ignore
		(Object.merge||Object.assign)(config, overwritten);
	}
}
// #endregion
