/**
 *	Author: cheny
 *	Create: 2021-08-10
**/
import 'extes';
import fs from 'fs';
import path from 'path';
import fastify, { FastifyError } from "fastify";

import reroot from 'reroot';
const include = reroot.safe_require(require)
reroot.root_path = `${reroot.root_path}/_dist`;

// Make system shutdown on receiving unexpected errors
import phook from 'phook';
phook.configure({durations:{UNHANDLED_ERROR:100}});

import $ from "shared-storage";
import PostgreFactory from "/data-source/postgres.js";
import BWT from '/lib/web-token.js';

// Load configuration file ASAP
import payload = require('/package.json');
import Config from '/config.default.js';






Promise.chain(async()=>{
	console.log('Config', Config);
	// Check if the required secrets are set
	console.log("Checking configurations...");
	

	{
		// Connnect to postgresql
		await (await import('./index.db.js')).default();
	}



	console.log("Initializing api handlers...");
	const api_reg_map:string[] = [];
	const fastify_inst = fastify({
		logger: Config.show_log
	});


	

	await fastify_inst.register(require('@fastify/swagger'), {
		openapi: {
			info: {
				title: 'YK5 ROSKA swagger',
				description: 'Testing YK5 ROSKA swagger API',
				version: payload.version
			},
			externalDocs: {
				url: 'https://hackmd.io/41FuL6-NQoiRBaZ7MwXrVA',	description: 'Find more info in hackmd'
			},
			servers: [{url: `http://139.59.117.209`, description: "beta server"},
					  {url: `http://${Config.serve_at.host}:${Config.serve_at.port}`,	description: "Localhost server"}
					],
			components: {
				securitySchemes: {
					cookieAuth: {
						type: 'apiKey',
						in: 'cookie',
						name: Config.cookie.cookie_session_id,
					}
				},
			}
		}
	});

	await fastify_inst.register(require('@fastify/swagger-ui'), {
	  routePrefix: '/documentation',
	  uiConfig: {
		docExpansion: 'full',
		deepLinking: false
	  },
	  uiHooks: {
		onRequest: function (request, reply, next) { next() },
		preHandler: function (request, reply, next) { next() }
	  },
	  staticCSP: true,
	  transformStaticCSP: (header) => header,
	//   transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
	  transformSpecification: (swaggerObject, req, reply) => {
		swaggerObject.host = req.hostname
		return swaggerObject
	  },
	  transformSpecificationClone: true
	})

	fastify_inst
	.addHook('onRoute', async(route)=>{
		const prefix = route.prefix[route.prefix.length-1] === '/' ? route.prefix.substring(0, route.prefix.length-1) : route.prefix;
		const path = route.routePath[0] === '/' ? route.routePath : '/' + route.routePath;
		api_reg_map.push(`${route.method} ${prefix}${path}`);
	})
	.register((await import('@fastify/cookie')).default)

	// application/x-www-form-urlencoded
	.register((await import('@fastify/formbody')).default)

	// multipart/form-data
	.register((await import('@fastify/multipart')).default)
	
	.register((await import('@fastify/static')).default, {root:`/home/cheny/upload_cache`, prefix:'/file', decorateReply:true})

	.register(async(fastify, opts)=>{
		
		fastify.decorateReply('errorHandler', function(error_info:any, detail?:any) {
			return this.status(error_info.status === undefined? 400: error_info.status).send({
				code: error_info.code,
				scope: this.request.routerPath,
				msg: error_info.msg,
				detail: detail
			});
		});



		fastify
		.addHook('preHandler', async(req, reply)=>{
			// reply.header('Access-Control-Allow-Origin', '*');
		})
		.addHook('preHandler', async(req)=>{
			// req.time_milli = Date.now();
			// req.time = Math.floor(req.time_milli/1000);
		})
		.addHook('preHandler', async(req, reply) => {
			req.session = { source:'unkown', is_login:false };


			let auth_source:LoginSession['source'], raw_token:string;
			const auth = (req.headers['authorization']||'').trim();
			if ( auth ) {
				if ( auth.substring(0, 7) !== "Bearer " ) return;
				
				auth_source = 'auth';
				raw_token = auth.substring(7).trim();
			}
			else {
				auth_source = 'cookie';
				raw_token = (req.cookies[Config.cookie.cookie_session_id]||'').trim();
			}


			
			const parsed_token = BWT.ParseBWT<RoscaSessToken>(raw_token, Config.secret.session);
			if ( !parsed_token ) return;

			let is_valid_token = parsed_token.exp >= Date.unix();
			if ( !is_valid_token ) return;


			// @ts-ignore
			const [{rows:[user_info]}, {rows:[session_info]}]:[QueryResult<Pick<User, 'id'|'role'>>, QueryResult<Pick<LoginSession,'id'>>] = await PostgreFactory.query(`
				SELECT uid, role FROM users WHERE uid = '${parsed_token.uid}' AND revoked = false;
				SELECT id, role FROM login_sessions WHERE id = '${parsed_token.tid}' AND uid = '${parsed_token.uid}' AND revoked = false;
			`);

			if ( !user_info || !session_info ) return;

			
			
			req.session.source = auth_source;
			req.session.is_login = true;
			req.session.token = parsed_token;
			req.session.raw_token = raw_token;
			req.session.admin_level = user_info.admin_level;
		})
		.addHook('onError', async(req, reply, error)=>{
			console.log(error);
		});





		fastify
		.register((await import('/routes/register.js')).default,					{prefix:'/'})
		.register((await import('/routes/users.js')).default,						{prefix:'/'})
		.register((await import('/routes/groups.js')).default,						{prefix:'/'})
		.register((await import('/routes/auth/auth-login-session.js')).default,		{prefix:'/auth'})

		.register((await import('/routes/version.js')).default,						{prefix:'/'})
	}, {prefix:'/api'})
	.get('/*', async(req, res)=>{
		res.status(404).type('text/plain').send('');
	})
	.setErrorHandler(function(error:FastifyError&{validationContext:string}, req, res) {
		// if ( error.code === undefined ) {
		// 	if ( error.validation ) {
		// 		const is_body_error = error.validationContext === 'body';
		// 		const error_details:string[] = error.validation.map(e=>`${e.dataPath||'payload'} ${e.message!}`);
		// 		res.status(400).send({
		// 			code: is_body_error ? ErrorCode.INVALID_REQUEST_PAYLOAD : ErrorCode.INVALID_REQUEST_QUERY,
		// 			scope: req.routerPath,
		// 			msg: is_body_error ? "Request payload is invalid" : "Request query is invalid",
		// 			detail: error_details
		// 		});
		// 		return;
		// 	}

		// 	res.status(500).send({
		// 		code: ErrorCode.UNKOWN_ERROR,
		// 		scope: req.routerPath,
		// 		msg: "Unexpected error has been occurred!",
		// 		detail: [{code:error.code, message:error.message}]
		// 	});
		// 	return;
		// }



		// // Fastify errors (https://www.fastify.io/docs/latest/Reference/Errors/)
		// switch(error.code) {
		// 	case "FST_ERR_CTP_EMPTY_TYPE":
		// 		res.status(400).send({
		// 			code: ErrorCode.INVALID_REQUEST_MIME,
		// 			scope: req.routerPath,
		// 			msg: "Payload type must be provided"
		// 		});
		// 		break;

		// 	case "FST_ERR_CTP_INVALID_TYPE":
		// 		res.status(400).send({
		// 			code: ErrorCode.INVALID_REQUEST_MIME,
		// 			scope: req.routerPath,
		// 			msg: "Payload type is not supported"
		// 		});
		// 		break;

		// 	case "FST_ERR_CTP_EMPTY_JSON_BODY":
		// 		res.status(400).send({
		// 			code: ErrorCode.INVALID_REQUEST_PAYLOAD,
		// 			scope: req.routerPath,
		// 			msg: "Request payload cannot be parsed as json"
		// 		});
		// 		break;
			
		// 	default:
		// 		this.log.error(error);
		// 		console.log(error);
		// 		res.status(500).send({
		// 			code: ErrorCode.UNKOWN_ERROR,
		// 			scope: req.routerPath,
		// 			msg: "Unexpected error has been occurred",
		// 			detail: error.code
		// 		});
		// 		break;
		// }
	});


	console.log("Starting server...");
	fastify_inst.listen({port:Config.serve_at.port, host:Config.serve_at.host}, (err, address) => {
		console.error(err, address);
	});
	
	console.log(`Server listening at http://${Config.serve_at.host}:${Config.serve_at.port}`);
});
