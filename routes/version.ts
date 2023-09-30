import payload = require('/package.json');
import { FastifyInstance } 	from "fastify";



export = async function(fastify: FastifyInstance) {
	/** /api/version **/
	{
		const schema = {
			description: '當前 api 的的版本號',
			summary: 'Get version from package.json',
			response: {
				200: {
					description: 'Successful response',
					type: 'object',
					properties: {
						version: { type: 'string' }
					},
					example: {
						version: '0.6.1'
					}
				}
			},
		};

		fastify.get('/version', {schema}, (req, res)=>{
			res.status(200).send({version:payload.version});
		});
	}
};
