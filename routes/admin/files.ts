import fs from 'fs';
import path from 'path';
import * as ExcelJS from 'exceljs';
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { BaseError } from '/lib/error';
import TrimId from 'trimid';
import { PGDelegate } from 'pgdelegate';

import Config from '/config.default.js';
import { RoskaSerials } from '/data-type/groups';

export = async function(fastify: FastifyInstance) {
	/** /api/file/upload **/
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
		fastify.post('/file/upload', {schema}, async (req, res) => {
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
    /** /api/file/excel **/
    {
        const schema = {
			description: '產 excel 表',
			summary: '產 excel 表',
            body: {
                type: 'object',
                properties: {
                    sid: { type: 'string'},
                },
                required: ['sid'],
            },
            security: [{ bearerAuth: [] }],
		};

        //@ts-ignore
		fastify.post<{Body:{sid:RoskaSerials['sid']}}>('/file/excel', {schema}, async (req, res) => {
            const {uid} = req.session.token!;

            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('「「工作表1」預估」');

            worksheet.eachRow
            // Add data to the worksheet
            worksheet.columns = [
                { header: '', key: 'pay', width: 20 },
                { header: '', key: 'gid', width: 20},
                { header: '編號', key: 'no', width: 20 },
                { header: '會組編號', key: 'sid', width: 30 },
                { header: '姓名', key: 'name', width: 30 },
                { header: '死活會', key: 'live_die', width: 30 },
                { header: '死活會', key: 'live_die', width: 30 },
            ];

            const data = [
                { name: 'John Doe', age: 30, country: 'USA' },
                { name: 'Jane Doe', age: 25, country: 'Canada' },
                { name: 'Bob Smith', age: 40, country: 'UK' },
            ];

            worksheet.addRows(data);

            // Save the workbook to a file
            await workbook.xlsx.writeFile('example.xlsx');

            console.log('Excel file created successfully.');


            res.status(200).send({});
        });
    }
};
