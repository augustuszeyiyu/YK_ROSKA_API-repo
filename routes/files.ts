import fs from 'fs';
import util from 'util';
import { pipeline } from 'stream';
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';


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

		fastify.post('/upload', async (req, res) => {
            const data = await req.file();
            if (!data) {
                return res.status(400).send({ error: 'No file uploaded' });
            }

            // Access the properties of the uploaded file
            const {
                file, 
                fields,      
                fieldname,
                filename,
                encoding,
                mimetype,
            } = data;

            // To accumulate the file in memory (Be careful, this loads the entire file into memory)
            // const fileBuffer = await data.toBuffer(); // Buffer

            // or

            // Use 'util.promisify' to turn 'pipeline' into a promise
            const pumpPromise = util.promisify(pipeline);

            // Pipe the uploaded file to a write stream to save it to disk
            await pumpPromise(file, fs.createWriteStream(filename));
          
            // Respond with the file path
            res.status(200).send({});
          });          
	}
};
