import fs from 'node:fs';
import path from 'node:path';
import TrimId from 'trimid';
import * as ExcelJS from 'exceljs';
import { PGDelegate } from 'pgdelegate';
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { BaseError, FileError } from '/lib/error';
import { RoskaGroups, RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { MAX_FILE_SIZE_BYTES } from '/lib/constants';

import Config from '/config.default.js';
import { QueryResult } from 'pg';

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
    /** GET　/api/file/bid-opening-record **/
    {
        const schema = {
			description: '產開標紀錄 excel 表',
			summary: '產開標紀錄 excel 表',
            params: {
                type: 'object',
                properties: {
                    sid: { type: 'string'},
                },
                required: ['sid'],
            },
            security: [{ bearerAuth: [] }],
		};

        //@ts-ignore
		fastify.get<{Params:{sid:RoskaSerials['sid']}}>('/file/bid-opening-record/:sid', {schema}, async (req, res) => {
            const {uid} = req.session.token!;
            console.log(req);
            
            const {sid} = req.params;

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
            const newFilename = `open-bid-report-${sid}.xlsx`;
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



            res.status(200).send({url:`${Config.serve_at.admin}/public/${encodeURIComponent(newFilename)}`});
        });
    }
    /** GET /api/file/latest-bid-opening-record **/
    {
        const schema = {
			description: '產所有開標紀錄 excel 表',
			summary: '產所有開標紀錄 excel 表',
            param: {
                type: 'object',
            },
            security: [{ bearerAuth: [] }],
		};

        //@ts-ignore
		fastify.get('/file/latest-bid-opening-record', {schema}, async (req, res) => {
            const {uid} = req.session.token!;

            const filePath: string[] = [];
            let offset = 0;
            while(true) {
                const {rows:serials} = await Postgres.query<{sid:RoskaSerials['sid']}>(`
                    SELECT sid 
                    FROM roska_serials 
                    ORDER BY sid
                    LIMIT 100 offset $1;
                `, [offset]);
                console.log('serials.length', serials.length);
                

                if (serials.length === 0) break;

                offset += 100;
                const group_list:string[] = [], repost_list:string[] = [];
                for (const {sid} of serials) {

                    // NOTE: sql of membership report
                    const group_info_sql = PGDelegate.format(`                        
                    SELECT 
                        TO_CHAR(ROW_NUMBER() OVER (ORDER BY gid), 'FM00') AS group_number, *
                    FROM roska_groups
                    WHERE sid = {sid} AND gid <> sid||'-t00' AND mid <> '';`, {sid});


                    // NOTE: sql of membership report
                    const report_info_sql = PGDelegate.format(`
                    SELECT 
                        TO_CHAR(ROW_NUMBER() OVER (ORDER BY m.mid), 'FM00') AS line_number,
                        TO_CHAR(EXTRACT(YEAR FROM m.win_time) - 1911, 'FM000') || '.' || TO_CHAR(m.win_time, 'MM.DD') AS taiwan_date,
                        g.bid_amount,
                        u.name, m.*, member_count, cycles, basic_unit_amount, frequency
                    FROM roska_members m
                    INNER JOIN users u ON m.uid = u.uid
                    LEFT join roska_groups g ON m.gid = g.gid
                    LEFT join roska_serials s ON m.sid = s.sid
                    WHERE m.sid={sid} AND m.mid <> m.sid||'-00';`, {sid});

                    
                    group_list.push(group_info_sql);
                    repost_list.push(report_info_sql);
                } // end for

                
                let group_info_list:(RoskaGroups & {group_number:string})[] = [];
                //@ts-ignore
                const group_result = await Postgres.query(group_list.join('\n')) as QueryResult<RoskaGroups & {group_number:string}>[];
                for (const {rows} of group_result) {
                    group_info_list = group_info_list.concat(rows);
                }

                let report_info_list:(RoskaSerials & RoskaMembers & {line_number:string, name: User['name'], taiwan_date:string, bid_amount:string})[] = [];
                //@ts-ignore
                const report_result = await Postgres.query(repost_list.join('\n')) as QueryResult<RoskaSerials & RoskaMembers & {line_number:string, name: User['name'], taiwan_date:string, bid_amount:string}>[];
                for (const {rows} of report_result) {
                    report_info_list = report_info_list.concat(rows);
                }


                console.log({group_result:group_result.length, report_result:report_result.length});


                // NOTE: Generate excels
                const workbook = new ExcelJS.Workbook();
                for (const selm of serials) {
                    const worksheet = workbook.addWorksheet(`開標紀錄-${selm.sid}`);
                    worksheet.eachRow
                    worksheet.columns = [
                        { header: '組別', key: 'sid', width: 20 },
                        { header: '會首', key: 'line_number', width: 20 },
                        { header: '姓名', key: 'name', width: 20},
                        { header: '活匯款', key: 'live_pay', width: 30 },
                        { header: '死會款', key: 'die_pay', width: 30 },
                        { header: '得標日期', key: 'taiwan_date', width: 20 },
                        { header: '得標會期', key: 'win_gid', width: 20 },
                        { header: '得標紀錄', key: 'transition', width: 30 },
                    ];

                    
                    const data:any[] = [];
                    for (const elm of report_info_list) {
                        if (elm.sid !== selm.sid)  continue;

                        const gid_string = elm.gid.substring(elm.gid.length - 2);
                        const gid_number = Number.isNaN(gid_string) === false? Number(gid_string): 0;
                       
                        
                        let live_pay = 0, die_pay = 0, transition = '';                
                        if (gid_number > 0)  {
                            die_pay = Number(elm.basic_unit_amount);
                            transition = elm.transition === 1? '轉讓': '全收';
                        }
                        else {
                            live_pay = Number(elm.basic_unit_amount) - 1000;
                        }
                        console.log({gid_number, bit_amount:elm.bid_amount, live_pay, die_pay, transition: elm.transition});
                        
                

                        data.push({
                            sid: elm.sid,
                            line_number: elm.line_number,
                            name: elm.name,
                            live_pay, die_pay,
                            taiwan_date: elm.taiwan_date,
                            win_gid: gid_number > 0? `第 ${gid_number} 標`: '',
                            transition
                        });
                    } // end for

                    // console.log(data);
                    worksheet.addRows(data);
                    
                } // end for

                // check if file exists or not
                const uploadDir = Config.storage_root;
                const newFilename = `open-bid-report-${report_info_list[0].sid}-${report_info_list[report_info_list.length-1].sid}.xlsx`;
                const newFilePath = path.resolve(uploadDir, newFilename);
                                    

                await Postgres.query(`
                    DELETE FROM files
                    WHERE file_path = $1
                `, [newFilePath]);



                // NOTE: Save the workbook to a file
                await workbook.xlsx.writeFile(newFilePath);
                console.log('Excel file created successfully.', {newFilePath});


                const insert_data = {
                    fid: TrimId.NEW.toString(32),
                    uid,
                    file_path: newFilePath,
                    file_name: newFilename,
                    encoding: 'OpenXML format',
                    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    url: `${Config.serve_at.admin}/public/${encodeURIComponent(newFilename)}`
                }
                const sql = PGDelegate.format(`
                    INSERT INTO files(fid, uid, file_path, file_name, encoding, mimetype, url)
                    VALUES ({fid}, {uid}, {file_path}, {file_name}, {encoding}, {mimetype}, {url})
                `, insert_data);
                await Postgres.query(sql);

                filePath.push(`${Config.serve_at.admin}/public/${encodeURIComponent(newFilename)}`);

            } // end while


            res.status(200).send(filePath);
        });
    }
    /** GET　/api/admin/file/member-pay-record **/
    {
        const schema_params = {
            type: 'object',
            properties: {
                uid:{type: "string"},
            } 
        };
        const schema = {
			description: '會員開標付款紀錄表',
			summary: '會員開標付款紀錄表',
            params:schema_params,
            security: [{ bearerAuth: [] }],
		};

		fastify.get<{Params:{uid:RoskaMembers['uid']}}>('/file/member-pay-record/:uid', {schema}, async (req, res) => {
            // const {uid} = req.session.token!;
            const {uid}= req.params;
            console.log(req.params);
            console.log(uid);

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
                                    ELSE (CASE WHEN m.transition = 1 OR m.transition = 2 THEN 0 ELSE -s.basic_unit_amount END) END)
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


            // console.log(user_transition_info);
            
            // NOTE: Initialize Excel workbook and worksheet
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`會員開標付款紀錄表-${USER.name}`);
            worksheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 6 }];

        
            // NOTE: Define columns
            const columns = [
                { header: '會員編號', key: 'mid', width: 20 },
                { header: '姓名',   key: 'name', width: 20 },
                { header: '起會日', key: 'bid_start_time', width: 20 },
                { header: '全收',   key: '_take_all_amount', width: 10 },
                { header: '負債',   key: '_debt', width: 10 },
                { header: '轉讓',   key: '_transition_amount', width: 10 },
                { header: '實拿',   key: '_take_sub_amount', width: 10 },
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

                        switch (elm.transition) {
                            case 0:
                                data['_take_all_amount'] = glm.win_amount;
                                data[`_${glm.date}`] = glm.win_amount;
                                console.log(glm);

                                data['_debt'] = (24 - Number(glm.gid!.substring(15))) * 5000;
                                break;
                            case 1:
                                data['_transition_amount'] = glm.win_amount;
                                data[`_${glm.date}`] = glm.win_amount;
                                break;
                            case 2:
                                data['_take_sub_amount'] = glm.win_amount;
                                data[`_${glm.date}`] = glm.win_amount;
                                break;
                        }
                        isTransition = true;
                    }
                    else {
                        data[`_${glm.date}`] = glm.win_amount;
                    }
                }
                
                // consol_e.log(data, columns);
                data_list.push(data);
            }


            const footer = {
                mid:    `總會數：${user_transition_info.length}`,
                name:   `得標：${win}`,
                bid_start_time:     `活會數：${user_transition_info.length-win}`,
                [columns[4].key]:   ``,
            }

            // NOTE: Calculate sums for each column
            for (const col of columns) {
                if (col.key && col.key.startsWith('_')) {
                    const sum = data_list.reduce((acc, row) => acc + (row[col.key] || 0), 0 );
                    footer[col.key] = sum;
                }
            }
            data_list.push(footer);


            let payable_fees = 0;
            for (const key in footer) {
                const value = footer[key];
                if (key.startsWith('_') && ['_take_all_amount', '_transition_amount', '_take_sub_amount'].includes(key) === false) {
                    payable_fees += Number(value);
                }
            }
            // const footer_sum = {
            //     mid:    `應繳費用`,
            //     name:   payable_fees,
            // }
            // data_list.push(footer_sum);

            
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
            const footerRow = worksheet.getRow(worksheet.rowCount-1);
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
            const footerSumRow = worksheet.lastRow;
            if (footerSumRow) {
                footerSumRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
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
            // console.log(url, uploadDir, path.resolve(uploadDir, newFilename));            

            // NOTE: Serve the file for download
            res.status(200).send({url});
        });
    }

    /** GET　/api/admin/file/all-member-pay-record **/
    {
        const schema = {
			description: '全部會員開標付款紀錄表',
			summary: '全部會員開標付款紀錄表',
            params: {
                type: 'object',
                properties: {},
            },
            security: [{ bearerAuth: [] }],
		};

		fastify.get('/file/all-member-pay-record', {schema}, async (req, res) => {
            
            const {rows:user_transition_info} = await Postgres.query<{
                name: User['name'],
                sid:RoskaMembers['sid'], 
                mid:RoskaMembers['mid'],
                uid:RoskaMembers['uid'],
                basic_unit_amount: RoskaSerials['basic_unit_amount'],
                cycles:RoskaSerials['cycles'],
                transition:RoskaMembers['transition'], 
                transit_to:RoskaMembers['transit_to'],
                total: number,
                group_info: (Partial<RoskaGroups>&{session:Number, date:string})[],
            }>(`
                SELECT u.name, m.mid, m.uid, m.sid, 
                s.basic_unit_amount, s.cycles, s.bid_start_time,
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
                                    ELSE (CASE WHEN m.transition = 1 OR m.transition = 2 THEN 0 ELSE -s.basic_unit_amount END) END)
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
                    users u ON m.uid=u.uid
                INNER JOIN 
                    roska_serials s ON m.sid=s.sid				
                ORDER BY 
                    m.mid;`);


            console.log(user_transition_info);
            
            // NOTE: Initialize Excel workbook and worksheet
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`會員開標付款紀錄表`);
            worksheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 7 }];

        
            // NOTE: Define columns
            const columns = [
                { header: '會員編號', key: 'mid', width: 20 },
                { header: '姓名',   key: 'name', width: 15 },
                { header: '起會日', key: 'bid_start_time', width: 8 },
                { header: '全收',   key: '_take_all_amount', width: 12 },
                { header: '預期負債',   key: '_debt', width: 12 },
                { header: '轉讓',   key: '_transition_amount', width: 12 },
                { header: '實拿',   key: '_take_sub_amount', width: 12 },
            ];

            const data_list: any[] = [];
            let   win = 0;

            for (let uindex = 0; uindex < user_transition_info.length; uindex++) {
                const elm = user_transition_info[uindex];
        
                const data = {
                    mid: elm.mid,
                    name: `${elm.name} ${(uindex+1).toString().padStart(4, '0')}`,
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

                        switch (elm.transition) {
                            case 0:
                                data['_take_all_amount'] = glm.win_amount;
                                data[`_${glm.date}`] = glm.win_amount;

                                data['_debt'] = (24 - Number(glm.gid!.substring(15))) * 5000;
                                break;
                            case 1:
                                data['_transition_amount'] = glm.win_amount;
                                data[`_${glm.date}`] = glm.win_amount;
                                break;
                            case 2:
                                data['_take_sub_amount'] = glm.win_amount;
                                data[`_${glm.date}`] = glm.win_amount;
                                break;
                        }
                        isTransition = true;
                    }
                    else {
                        data[`_${glm.date}`] = glm.win_amount;
                    }
                }
                
                // consol_e.log(data, columns);
                data_list.push(data);
            }


            const footer = {
                mid:    `總會數：${user_transition_info.length}`,
                name:   `得標：${win}`,
                bid_start_time:     `活會數：${user_transition_info.length-win}`,
                [columns[4].key]:   ``,
            }

            // NOTE: Calculate sums for each column
            for (const col of columns) {
                if (col.key && col.key.startsWith('_')) {
                    const sum = data_list.reduce((acc, row) => acc + (row[col.key] || 0), 0 );
                    footer[col.key] = sum;
                }
            }
            data_list.push(footer);


            let payable_fees = 0;
            for (const key in footer) {
                const value = footer[key];
                if (key.startsWith('_') && ['_take_all_amount', '_transition_amount', '_take_sub_amount'].includes(key) === false) {
                    payable_fees += Number(value);
                }
            }
            const footer_sum = {
                mid:    `應繳費用`,
                name:   payable_fees,
            }
            data_list.push(footer_sum);

            
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
            const footerRow = worksheet.getRow(worksheet.rowCount-1);
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
            const footerSumRow = worksheet.lastRow;
            if (footerSumRow) {
                footerSumRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
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
            const newFilename = `user-payment-report.xlsx`;
            const newFilePath = path.resolve(uploadDir, newFilename);

            // Delete existing file if it exists
            await Postgres.query(`DELETE FROM files WHERE file_path = $1`, [newFilePath]);

            // Save the workbook to a file
            await workbook.xlsx.writeFile(newFilePath);
            console.log('Excel file created successfully.');

            // Insert file record into database
            const insert_data = {
                fid: TrimId.NEW.toString(32),
                uid: user_transition_info[0].uid,
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
            // console.log(url, uploadDir, path.resolve(uploadDir, newFilename));            

            // NOTE: Serve the file for download
            res.status(200).send({url});
        });
    }
};
