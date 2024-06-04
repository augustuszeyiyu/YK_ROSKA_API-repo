import fs from 'node:fs';
import path from 'node:path';
import TrimId from 'trimid';
import * as ExcelJS from 'exceljs';
import { PGDelegate } from 'pgdelegate';
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { BaseError, FileError } from '/lib/error';
import { RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { MAX_FILE_SIZE_BYTES } from '/lib/constants';

import Config from '/config.default.js';

export = async function(fastify: FastifyInstance) {
	/** /api/file/upload **/
	{
		const schema = {
			description: '上傳檔案，請用 postman 測試',
			summary: '上傳檔案，請用 postman 測試',
            consumes: ['multipart/form-data'],
            params: {
                type: 'object',
                properties: {
                    uid: { type: 'string' },
                },
                required: ['uid'],
            },
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
		fastify.post<{Params:{uid:User['uid']}}>('/file/upload/:uid', {schema}, async (req, res) => {

          
            const {uid} = req.params;

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


            
            res.status(200).send({url:`${Config.serve_at.admin}/public/${newFilename}`});
        });
	}
    /** /api/file/bid-opening-record **/
    {
        const schema = {
			description: '產開標紀錄 excel 表',
			summary: '產開標紀錄 excel 表',
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
		fastify.post<{Body:{sid:RoskaSerials['sid']}}>('/file/bid-opening-record', {schema}, async (req, res) => {
            const {uid} = req.session.token!;
            console.log(req);
            
            const {sid} = req.body;

            const {rows:report_info} = await Postgres.query(`
                SELECT 
                    TO_CHAR(ROW_NUMBER() OVER (ORDER BY m.mid), 'FM00') AS line_number,
                    TO_CHAR(EXTRACT(YEAR FROM m.win_time) - 1911, 'FM000') || '.' || TO_CHAR(win_time, 'MM.DD') AS taiwan_date,
                    u.name, m.*, member_count, cycles, basic_unit_amount, frequency
                FROM roska_members m
                INNER JOIN users u ON m.uid = u.uid
                LEFT join roska_serials s ON m.sid = s.sid
                WHERE m.sid=$1 AND m.mid <> m.sid||'-00';`, [sid]);
 

            const {rows:group_info} = await Postgres.query(`
                SELECT 
                    TO_CHAR(ROW_NUMBER() OVER (ORDER BY gid), 'FM00') AS group_number, *
                FROM roska_groups
                WHERE sid = $1 AND gid <> sid||'-t00' AND mid <> '';`, [sid]);
 

            const workbook = new ExcelJS.Workbook();

            for (const gelm of group_info) {
                const current_gid = Number(gelm.group_number);
                const worksheet = workbook.addWorksheet(`開標紀錄-${sid}-${gelm.group_number}`);

                worksheet.eachRow
                worksheet.columns = [
                    { header: '組別', key: 'sid', width: 20 },
                    { header: '標會期', key: 'group_number', width: 20 },
                    { header: '會首', key: 'line_number', width: 20 },
                    { header: '姓名', key: 'name', width: 20},                    
                    { header: '活匯款', key: 'live_pay', width: 30 },
                    { header: '死會款', key: 'die_pay', width: 30 },
                    { header: '得標日期', key: 'taiwan_date', width: 20 },
                    { header: '得標會期', key: 'win_gid', width: 20 },
                    { header: '得標紀錄', key: 'transition', width: 30 },
                ];

                
                const data:any[] = [];
                for (const elm of report_info) {                    
                    const gid_string = elm.gid.substring(elm.gid.length - 2);
                    const gid_number = Number.isNaN(gid_string) === false? Number(gid_string): 0;
                    // console.log({gid_number, current_gid}, gid_number < current_gid, elm.gid, Number(gelm.group_number), elm.basic_unit_amount);
                    
                    let live_pay = 0, die_pay = 0, taiwan_date = '', win_gid = '', transition = '';
                    if (gid_number === current_gid) {
                        live_pay = 0;
                        taiwan_date = elm.taiwan_date;
                        win_gid = `第 ${gid_number} 標`;
                        transition = elm.transition === 1? '轉讓': '全收';
                    }
                    else
                    if (gid_number === 0)  {
                        live_pay = Number(elm.basic_unit_amount) - Number(gelm.bid_amount);
                    }
                    else                    
                    if (gid_number < current_gid) {
                        die_pay = elm.basic_unit_amount;
                        taiwan_date = elm.taiwan_date;
                        win_gid = `第 ${gid_number} 標`;
                        transition = elm.transition === 1? '轉讓': '全收';
                    }
                    else {
                        live_pay = Number(elm.basic_unit_amount) - Number(gelm.bid_amount);
                    }

                    // console.log({gid_number, current_gid}, gid_number < current_gid, {live_pay, die_pay});
                    
            

                    data.push({
                        sid: sid,
                        group_number: gelm.group_number,
                        line_number: elm.line_number,
                        name: elm.name,
                        live_pay, die_pay,
                        taiwan_date,
                        win_gid,
                        transition
                    });
                }
                // console.log(data);                
                worksheet.addRows(data);
            }
            

            // check if file exists or not
            const uploadDir = Config.storage_root;
            const newFilename = `開標紀錄-${sid}.xlsx`;
            const newFilePath = path.resolve(uploadDir, newFilename);

            await Postgres.query(`
                DELETE FROM files
                WHERE file_path = $1
            `, [newFilePath]);



            // NOTE: Save the workbook to a file
            await workbook.xlsx.writeFile(newFilePath);
            console.log('Excel file created successfully.');


            const insert_data = {
                fid: TrimId.NEW.toString(32),
                uid,
                file_path: newFilePath,
                file_name: newFilename,
                encoding: 'OpenXML format',
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
            const sql = PGDelegate.format(`
                INSERT INTO files(fid, uid, file_path, file_name, encoding, mimetype)
                VALUES ({fid}, {uid}, {file_path}, {file_name}, {encoding}, {mimetype})
            `, insert_data);
            await Postgres.query(sql);



            res.status(200).send({url:`${Config.serve_at.admin}/public/${newFilename}`});
        });
    }
};
