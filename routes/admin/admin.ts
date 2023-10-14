import {FastifyInstance} from "fastify";
import {ErrorCode} from "/lib/error-code.js";



export = async function(fastify:FastifyInstance) {
	/* Force login */
	fastify.addHook<{Reply:APIErrorResponse}>('preHandler', async(req, res)=>{
		// TODO: Wait for JCloudYu to add admin_level check in index script
		const {is_login, token} = req.session;
		if ( is_login === false || token === undefined || token.role < 3 ) {
			return res.status(401).send({
				scope:req.routerPath,
				code:ErrorCode.UNAUTHORIZED,
				msg: "You're not authorized to access this resource!"
			});
		}
	});



	fastify.register((await import('./users.js')).default);
    fastify.register((await import('./group-serials.js')).default);
	fastify.register((await import('./group-groups.js')).default);
}
