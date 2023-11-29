import fs from 'fs';
import path from 'path';
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { BaseError } from '/lib/error';
import TrimId from 'trimid';
import { PGDelegate } from 'pgdelegate';

import Config from '/config.default.js';

export = async function(fastify: FastifyInstance) {
	/** /api/version **/
	{
		const schema = {
			description: '上傳檔案，請用 postman 測試',
			summary: '上傳檔案，請用 postman 測試',
            consumes: ['multipart/form-data'],
            formData: {
                type: 'object',
                properties: {
                    file: { type: 'string', format: 'binary' },
                },
                required: ['file'],
            },
            security: [{ bearerAuth: [] }],
		};

        //@ts-ignore
		fastify.post('/upload', {schema}, async (req, res) => {            
            if ( req.session.is_login === false ) {
				return res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
			}

            const {uid} = req.session.token!;


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

            console.log({ fieldname, filename, encoding, mimetype });

            

            const uploadDir = Config.storage_root;

            // Ensure the directory exists, create it if necessary
            if (fs.existsSync(uploadDir) === false) {
                fs.mkdirSync(uploadDir);
            }


            const fid = TrimId.NEW.toString(32);
            const newFilename = `${fid}-${filename}`;
            const newFilePath = path.resolve(uploadDir, newFilename);
            const writeStream = fs.createWriteStream(`${newFilePath}`);
            
            
            const insert_data = {
                fid,
                uid,
                file_path: path.resolve(uploadDir, newFilename),
                file_name: newFilename,
                encoding,
                mimetype
            }



            file.pipe(writeStream);


            // Handle events on the write stream (optional)
            writeStream.on('error', (err) => {
                console.error('Error writing file:', err);
                return res.errorHandler(BaseError.UNEXPECTED_SERVER_ERROR);
            });

            writeStream.on('finish', () => {
                console.log('File saved successfully');
            });

            
            const sql = PGDelegate.format(`
                INSERT INTO files(fid, uid, file_path, file_name, encoding, mimetype)
                VALUES ({fid}, {uid}, {file_path}, {file_name}, {encoding}, {mimetype})
            `, insert_data);

            await Postgres.query(sql);


            
            res.status(200).send({url:`${Config.serve_at.url}/public/${newFilename}`});
        });
	}
};
