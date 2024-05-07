import $ from "shared-storage";
import fs from "node:fs";
import path from "node:path";
import csv from "csv-parser";

import reroot from 'reroot';
const include = reroot.safe_require(require)
reroot.root_path = `${reroot.root_path}/_dist`;

// Make system shutdown on receiving unexpected errors
import phook from 'phook';
phook.configure({durations:{UNHANDLED_ERROR:100}});

import Postgres from "/data-source/postgres.js";
import { PGDelegate } from "pgdelegate";


(async()=>{
    await (await import('/index.db.js')).default();

    const filePath = path.resolve(__dirname, '../../patches/', 'YA1001-220701.csv');
    console.log(filePath);
    

    // Create an empty array to store the CSV data
    const csvData:any = [];
    // Read the CSV file
    fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
        // Process each row of the CSV file
        csvData.push(row);
    })
    .on('end', async () => {
        // console.log('CSV data:', csvData);
         
        const sid = csvData[0].sid;

        const names:string[] = [];
        for (const {name} of csvData) {
            names.push(name);
        }        

        const {rows:groups} = await Postgres.query(`
            SELECT * FROM roska_groups WHERE sid = $1;
        `, [sid]);

        const {rows:[count_members]} = await Postgres.query(`
            SELECT COUNT(*) FROM roska_members WHERE sid = $1;
        `, [sid]);

        const {rows:users} = await Postgres.query(`
            SELECT DISTINCT name, uid FROM users WHERE name=any($1);
        `, [names]);


        const insert_list:string[] = [];
        if (Number(count_members.count) > 0) {           

            for (const elm of csvData) {
                for (const user of users) {
                    const bid_time = elm.bid_date.split('.');
                    const year = 1911 + Number(bid_time[0]);
                    const month = bid_time[1];
                    const day = bid_time[2];
                    const format_date  = new Date(`${year}-${month}-${day}`);
                    // console.log(format_date);

                    if (elm.name === user.name) {
                        const sql = PGDelegate.format(`
                            UPDATE roaks_members
                            SET uid={uid}, gid={gid}, bid_amount={bid_amount}, win_time={win_time}, win_amount={win_amount}
                            WHERE sid={sid} AND mid={mid}
                        `,{
                            mid: `${sid}-${elm.m.trim()}`,
                            uid: user.uid,
                            sid,
                            gid: elm.m.trim() !== '00'? `${sid}-t${elm.t}`: `${sid}-t00`, 
                            bid_amount: elm.bid_amount,
                            win_amount: Number(elm.m) === 0? elm.base * (csvData.length-1): 0,
                            win_time: elm.bid_date !== ''? format_date.toISOString(): null,
                            transition: elm.transition !== ''? elm.transition: '0',
                            transit_to: elm.transition === '1'? users[0].uid: '',
                            transit_gid: elm.transition === '1'? `${sid}-t00`: '', 
                        });
                        console.log(sql);
                        insert_list.push(sql);

                        const sql2 = PGDelegate.format(`
                            UPDATE roaks_groups 
                            SET uid={uid}, mid={mid}, bid_amount={bid_amount}, win_time={win_time}, win_amount={win_amount}
                            WHERE sid={sid} AND gid={gid};
                        `,{
                            mid: `${sid}-${elm.m.trim()}`,
                            sid,
                            uid: user.uid,
                            gid: elm.t !== ''? `${sid}-t${elm.t}`: '', 
                            bid_amount: elm.bid_amount,
                            win_time: elm.bid_date !== ''? format_date.toISOString(): null,
                            win_amount: Number(elm.m) === 0? elm.base * (csvData.length-1): 0
                        });
                        console.log(sql2);
                        insert_list.push(sql2);
                    }
                }
            }
        }
        else {
            for (const elm of csvData) {
                console.log(elm);
                
                for (const user of users) {
                    if (elm.name === user.name) {
                        const bid_time = elm.bid_date.split('.');
                        const year = 1911 + Number(bid_time[0]);
                        const month = bid_time[1];
                        const day = bid_time[2];
                        const format_date  = new Date(`${year}-${month}-${day}`);
                        // console.log(format_date);
                        
    
                        const sql = PGDelegate.format(`
                            INSERT INTO roska_members (mid, uid, sid, gid, win_amount, win_time, transition, transit_to, transit_gid)
                            VALUES ({mid}, {uid}, {sid}, {gid}, {win_amount}, {win_time}, {transition}, {transit_to}, {transit_gid});
                        `,{
                            mid: `${sid}-${elm.m.trim()}`,
                            uid: user.uid,
                            sid,
                            gid: elm.m.trim() !== '00'? `${sid}-t${elm.t}`: `${sid}-t00`, 
                            win_amount: Number(elm.m) === 0? elm.base * (csvData.length-1): 0,
                            win_time: elm.bid_date !== ''? format_date.toISOString(): null,
                            transition: elm.transition !== ''? elm.transition: '0',
                            transit_to: elm.transition === '1'? users[0].uid: '',
                            transit_gid: elm.transition === '1'? `${sid}-t00`: '', 
                        });
                        console.log(sql);
                        
                        insert_list.push(sql);
    
                        const sql2 = PGDelegate.format(`
                            UPDATE roaks_groups 
                            SET uid={uid}, mid={mid}, bid_amount={bid_amount}, win_time={win_time}, win_amount={win_amount}
                            WHERE sid={sid} AND gid={gid};
                        `,{
                            mid: `${sid}-${elm.m.trim()}`,
                            sid,
                            uid: user.uid,
                            gid: elm.t !== ''? `${sid}-t${elm.t}`: '', 
                            bid_amount: elm.bid_amount,
                            win_time: elm.bid_date !== ''? format_date.toISOString(): null,
                            win_amount: Number(elm.m) === 0? elm.base * (csvData.length-1): 0
                        });
                        console.log(sql2);
                        insert_list.push(sql2);
                    }
                }           
            }
    
        }
        
        // console.log(insert_list);
    })
    .on('error', (err) => {
        // Handle any errors that occur during CSV parsing
        console.error('Error while parsing CSV:', err);
    });    
})().catch(e=>Promise.resolve(e));