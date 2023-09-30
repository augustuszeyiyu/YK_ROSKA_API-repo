// Dependencies: gulp, gulp-run, clipargs

const fs	= require('fs');
const path	= require('path');
const gulp	= require("gulp");
const run	= require('gulp-run');


const RUNTIME = {
	args: require('clipargs').variable('env', '--env', '-E').parse(process.argv.slice(2)),
	env_name: '',
	config_name: '',
	config_path: ''
};

async function resolve_env() {
	const config_name = RUNTIME.config_name = `config-${RUNTIME.env_name}`;
	const conf_path = RUNTIME.config_path = path.resolve(__dirname, config_name + '.ts');
	if ( !fs.existsSync(conf_path) ) {
		console.error(`\u001b[31mConfig file \u001b[93m'${config_name}.ts'\u001b[31m does not exist!\u001b[39m`);
		throw new Error(`Config file '${config_name}.ts' not found!`);
	}
}
function clean() { return run('rm -rf ./_dist').exec(); }
function build() { return run('tsc').exec(); }
async function copyres() { 
	//return run('copyfiles ./updates/**/* ./_dist').exec();
}
const copyconf = gulp.series(
	function build_config() { return run(`tsc --esModuleInterop --outDir ./__build ${RUNTIME.config_path}`).exec() },
	function move_config() { return run(`mv ./__build/${RUNTIME.config_name}.js ./_dist/config.js`).exec() },
	function clean_build() { return run('rm -rf ./__build').exec() },
);



exports.default = exports.build = function(...args) {
	RUNTIME.env_name = RUNTIME.args.env||'';
	console.log(`\u001b[32mStart building env: \u001b[93m${RUNTIME.env_name}\u001b[39m`);
	
	return gulp.series(resolve_env, clean, build, copyres, copyconf)(...args);
};
exports.clean = clean;