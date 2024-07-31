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
                mimetype,
                url: `${Config.serve_at.url}/public/${newFilename}`
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
                INSERT INTO files(fid, uid, file_path, file_name, encoding, mimetype, url)
                VALUES ({fid}, {uid}, {file_path}, {file_name}, {encoding}, {mimetype}, {url})
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

            const {rows:[USER]} = await Postgres.query<User>(`SELECT * FROM users WHERE uid = $1`, [uid]);

            const {rows:user_transition_info} = await Postgres.query<{
                sid:RoskaMembers['sid'], 
                mid:RoskaMembers['mid'],
                basic_unit_amount: RoskaSerials['basic_unit_amount'],
                cycles:RoskaSerials['cycles'],
                transition:RoskaMembers['transition'], 
                transit_to:RoskaMembers['transit_to'],
                total: number,
                group_info: (Partial<RoskaGroups>&{session:Number, date:string})[],
            }>(`
                SELECT DISTINCT 
                m.mid,
                m.uid,
                m.sid, 
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
                                'session', CAST(Right(rg.gid, 2) AS INTEGER),
                                'bid_start_time', rg.bid_start_time,
                                'date', extract(year from rg.bid_start_time)-1911||'-'||extract(month from rg.bid_start_time),
                                'win_amount', (CASE 
                                    WHEN rg.gid = m.gid THEN rg.win_amount
                                    WHEN m.gid = ''     THEN -(s.basic_unit_amount - rg.bid_amount)
                                    WHEN rg.gid < m.gid THEN -(s.basic_unit_amount - rg.bid_amount)
                                    ELSE (CASE WHEN m.transition = 1 THEN 0 ELSE -s.basic_unit_amount END) END)
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


            console.log(user_transition_info);
            
            // Initialize Excel workbook and worksheet
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`會員開標付款紀錄表-${USER.name}`);
        
            // Define columns
            const columns = [
                { header: '會員編號', key: 'mid', width: 20 },
                { header: '姓名', key: 'name', width: 20 },
                { header: '起會日', key: 'bid_start_time', width: 20 },
            ];

            const data_list: any[] = [];
            let   win = 0;

            for (let uindex = 0; uindex < user_transition_info.length; uindex++) {
                const elm = user_transition_info[uindex];
        
                const data = {
                    mid: elm.mid,
                    name: `${USER.name} ${(uindex+1).toString().padStart(4, '0')}`,
                    bid_start_time: elm.group_info[0]?.date // Ensure group_info[0] exists
                };

                let isTransition = false;
                for (let index = 0; index < elm.group_info.length; index++) {

                    const glm = elm.group_info[index];
                    const find = columns.find(elm => elm.key === `_${glm.date}`);
                    
                    if (!find) {
                        columns.push({ header: `${glm.date}`, key: `_${glm.date}`, width: 15 });
                    }
                    

                    if (Number(glm.win_amount) > 0) {
                        ++win;
                        data[`_${glm.date}`] = elm.transition === 1? `轉讓 ${glm.win_amount}`: `${glm.win_amount}`;
                        isTransition = true;
                    }
                    else {
                        data[`_${glm.date}`] = glm.win_amount;
                    }
                }
                
                // console.log(data, columns);
                data_list.push(data);                
            }

            data_list.push({
                mid:    `總會數：${user_transition_info.length}`,
                name:   `得標：${win}`,
                bid_start_time:     `活會數：${user_transition_info.length-win}`,
                [columns[4].key]:   ``
            })
            worksheet.columns = columns;
            worksheet.addRows(data_list);


            // NOTE: Add borders to the header row
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.border = {
                    top: { style: 'thick' },
                    left: { style: 'thick' },
                    bottom: { style: 'thick' },
                    right: { style: 'thick' }
                },
                cell.font = { bold: true };
            });
            // NOTE: Add borders to the entire worksheet
            worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });
            const footerRow = worksheet.lastRow;
            if (footerRow) {
                footerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thick' },
                        left: { style: 'thick' },
                        bottom: { style: 'thick' },
                        right: { style: 'thick' }
                    };
                    cell.font = { bold: true };
                });
            }

            // Check if file exists or not
            const uploadDir = Config.storage_root;
            const newFilename = `user-payment-report-${USER.contact_mobile_number}.xlsx`;
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
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                url: `${Config.serve_at.admin}/public/${encodeURIComponent(newFilename)}`
            };

            const sql = PGDelegate.format(`
                INSERT INTO files (fid, uid, file_path, file_name, encoding, mimetype, url)
                VALUES ({fid}, {uid}, {file_path}, {file_name}, {encoding}, {mimetype}, {url})
            `, insert_data);

            await Postgres.query(sql);

            const url = `${Config.serve_at.admin}/public/${encodeURIComponent(newFilename)}`;
            console.log(url, uploadDir, path.resolve(uploadDir, newFilename));
            

            // NOTE: Serve the file for download
            res.status(200).send({url});
        });
    }
};
