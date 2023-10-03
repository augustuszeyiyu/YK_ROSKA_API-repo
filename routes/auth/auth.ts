import {FastifyInstance} from "fastify";
import {ErrorCode} from "/lib/error-code.js";



export = async function(fastify:FastifyInstance) {
	/* Force login */
	// fastify.addHook<{Reply:APIErrorResponse}>('preHandler', async(req, res)=>{
	// 	// TODO: Wait for JCloudYu to add admin_level check in index script
	// 	if ( !req.session.is_login ) {
	// 		return res.status(401).send({
	// 			scope:req.routerPath,
	// 			code:ErrorCode.UNAUTHORIZED,
	// 			msg: "You're not authorized to access this resource!"
	// 		});
	// 	}
	// });



	fastify.register((await import('./auth-login-session.js')).default);
}
