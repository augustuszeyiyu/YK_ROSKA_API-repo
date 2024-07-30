import fs from 'node:fs';
import path from 'node:path';
import TrimId from 'trimid';
import * as ExcelJS from 'exceljs';
import { PGDelegate } from 'pgdelegate';
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { BaseError, FileError } from '/lib/error';
import { MAX_FILE_SIZE_BYTES } from '/lib/constants';

import Config from '/config.default.js';
import { RoskaGroups, RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';




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
            if ( req.session.is_login === false ) {
				return res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
			}

            const {uid} = req.session.token!;


            const data = await req.file();
            
            
            if (!data) {
                return res.errorHandler(FileError.NO_UPLOAD_FILE);
            }


            // Check file size
            const contentLength = req.headers['content-length'];
            const fileSizeBytes = contentLength ? parseInt(contentLength, 10) : 0;

            if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
                return res.errorHandler(FileError.MAXIMUM_UPLOAD_SIZE_EXCEEDED);
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
           
            
            

            const insert_data = {
                fid,
                uid,
                file_path: path.resolve(uploadDir, newFilename),
                file_name: newFilename,
                encoding,
                mimetype
            }


            const uploadFile = () => new Promise( (resolve, reject) => {
                const writeStream = fs.createWriteStream(newFilePath);
                file.pipe(writeStream);

                writeStream.on('error', (err) => {
                    console.error('Error writing file:', err);
                    reject(err);
                });

                writeStream.on('close', () => {
                    console.log('WriteStream close.');
                    resolve(true);
                });

                writeStream.on('finish', () => {
                    console.log('File saved successfully.');
                    resolve(true);
                });
            });


            const upload_result = await uploadFile().catch((e:Error)=>e);
            if (upload_result instanceof Error) {
                return res.errorHandler(BaseError.UNEXPECTED_SERVER_ERROR, [upload_result]);
            }
            

            const sql = PGDelegate.format(`
                INSERT INTO files(fid, uid, file_path, file_name, encoding, mimetype)
                VALUES ({fid}, {uid}, {file_path}, {file_name}, {encoding}, {mimetype})
            `, insert_data);

            await Postgres.query(sql);


            
            res.status(200).send({url:`${Config.serve_at.url}/public/${newFilename}`});
        });
	}
    /** GET　/api/file/member-pay-record **/
    {
        const schema = {
			description: '會員開標付款紀錄表',
			summary: '會員開標付款紀錄表',
            params: {
                type: 'object',
                properties: {},
            },
            security: [{ bearerAuth: [] }],
		};

		fastify.get<{Params:{uid:RoskaMembers['uid']}}>('/file/member-pay-record', {schema}, async (req, res) => {
            const {uid} = req.session.token!;

            const {rows:[user_name]} = await Postgres.query<{name:User['name']}>(`SELECT name FROM users WHERE uid = $1`, [uid]);

            const {rows:user_transition_info} = await Postgres.query<{
                sid:RoskaMembers['sid'], 
                mid:RoskaMembers['mid'],
                basic_unit_amount: RoskaSerials['basic_unit_amount'],
                cycles:RoskaSerials['cycles'],
                transition:RoskaMembers['transition'], 
                transit_to:RoskaMembers['transit_to'],
                total: number,
                group_info: (Partial<RoskaGroups>&{date:string})[],
            }>(`
                SELECT DISTINCT 
                m.sid, 
                m.mid,
                s.basic_unit_amount,
                s.cycles,
                s.bid_start_time,
                m.transition,
                m.transit_to,
                COALESCE(
                    (
                        SELECT
                            jsonb_agg( jsonb_build_object(
                                'gid', rg.gid, 
                                'bid_start_time', rg.bid_start_time,
                                'date', extract(year from rg.bid_start_time)-1911||'-'||extract(month from rg.bid_start_time),
                                'win_amount', (CASE 
                                    WHEN rg.gid = m.gid THEN rg.win_amount
                                    WHEN m.gid = ''     THEN -(s.basic_unit_amount - rg.bid_amount)
                                    WHEN rg.gid < m.gid THEN -(s.basic_unit_amount - rg.bid_amount)
                                    ELSE -s.basic_unit_amount END)
                            ) ORDER BY rg.gid, rg.sid)
                        FROM 
                            roska_groups rg
                        WHERE 
                            rg.sid = m.sid AND 
                            rg.mid <> ''
                    ), '[]'::jsonb) AS group_info
                FROM 
                    roska_members m
                INNER JOIN 
                    roska_serials s ON m.sid=s.sid
                WHERE 
                    m.mid IN (SELECT mid FROM roska_members WHERE uid = $1)
                ORDER BY 
                    m.sid;`, [uid]);


            
            // Initialize Excel workbook and worksheet
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`會員開標付款紀錄表-${user_name.name}`);
        
            // Define columns
            const columns = [
                { header: '會員編號', key: 'mid', width: 20 },
                { header: '姓名', key: 'name', width: 20 },
                { header: '起會日', key: 'bid_start_time', width: 10 },
            ];

            const data_list: any[] = [];
            for (const elm of user_transition_info) {
                const data = {
                    mid: elm.mid,
                    name: user_name.name,
                    bid_start_time: elm.group_info[0]?.date // Ensure group_info[0] exists
                };

                for (const glm of elm.group_info) {
                    const find = columns.find(elm => elm.key === `_${glm.date}`);
                    if (!find) {
                        columns.push({ header: `${glm.date}`, key: `_${glm.date}`, width: 10 });
                    }
                    data[`_${glm.date}`] = glm.win_amount;
                }
                
                console.log(data, columns);
                data_list.push(data);                
            }

            worksheet.columns = columns;
            worksheet.addRows(data_list);

            // Check if file exists or not
            const uploadDir = Config.storage_root;
            const newFilename = `user-payment-report-${uid}.xlsx`;
            const newFilePath = path.resolve(uploadDir, newFilename);

            // Delete existing file if it exists
            await Postgres.query(`DELETE FROM files WHERE file_path = $1`, [newFilePath]);

            // Save the workbook to a file
            await workbook.xlsx.writeFile(newFilePath);
            console.log('Excel file created successfully.');

            // Insert file record into database
            const insert_data = {
                fid: TrimId.NEW.toString(32),
                uid,
                file_path: newFilePath,
                file_name: newFilename,
                encoding: 'OpenXML format',
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };

            const sql = PGDelegate.format(`
                INSERT INTO files (fid, uid, file_path, file_name, encoding, mimetype)
                VALUES ({fid}, {uid}, {file_path}, {file_name}, {encoding}, {mimetype})
            `, insert_data);

            await Postgres.query(sql);

            res.status(200).send({ url: `${Config.serve_at.admin}/public/${encodeURIComponent(newFilename)}` });
        });
    }
};
