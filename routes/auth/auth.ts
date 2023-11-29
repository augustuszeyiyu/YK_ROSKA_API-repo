import {FastifyInstance} from "fastify";
import {ErrorCode} from "/lib/error-code.js";
import { BaseError } from "/lib/error.js";



export = async function(fastify:FastifyInstance) {
	fastify.register(async(fastify)=>{
		fastify.register((await import('./auth-login-session.js')).default);
	});


	fastify.register(async(fastify)=>{

		/* Force login */
		fastify.addHook<{Reply:APIErrorResponse}>('preHandler', async(req, res)=>{

			if ( req.session.is_login === false ) {
				return res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
			}
		});



		fastify.register((await import('./auth-password.js')).default);
	});
	
}
