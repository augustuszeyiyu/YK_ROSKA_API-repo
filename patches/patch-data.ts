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
    
    const cycles      = 24;
    const handle_fee  = 250;
    const trasfer_fee = 300;
    const Interest    = 1000;
    const filePath = path.resolve(__dirname, '../../patches/', '41-50.csv');
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

       
        const csvData_obj:{[k in any]:any} = {};
        for (const elm of csvData) {
            if (csvData_obj[elm.sid] === undefined) {
                csvData_obj[elm.sid] = [];
            }
            
            csvData_obj[elm.sid].push(elm);
        }
        // console.log(csvData_obj);

        const insert_list:string[] = [];

        for (const sid in csvData_obj) {

            const names:string[] = [];
            for (const {name} of csvData_obj[sid]) {    
                names.push(name);
            }
            
            console.log({sid, cycles, names});
            
            const {rows:groups} = await Postgres.query(`
                SELECT * FROM roska_groups WHERE sid = $1;
            `, [sid]);
    
            const count_members_sql = PGDelegate.format(`SELECT COUNT(*) FROM roska_members WHERE sid = {sid};`, {sid});
            const {rows:[count_members]} = await Postgres.query(count_members_sql);
            console.log(count_members_sql, count_members);
            
    
            const {rows:users} = await Postgres.query(`
                SELECT DISTINCT name, uid FROM users WHERE name=any($1);
            `, [names]);
            console.log(users);
            
    
            if (Number(count_members.count) > 1) {           
    
                for (const elm of csvData_obj[sid]) {
                    if (elm.m.trim() === '00') continue;
    
                    for (const user of users) {
                        const bid_time = elm.bid_date.split('.');
                        const year = 1911 + Number(bid_time[0]);
                        const month = bid_time[1];
                        const day = bid_time[2];
                        const format_date  = formatDate(new Date(`${year}-${month}-${day}`));
    
                        if (elm.name === user.name) {
                            const win_amount = cal_win_amount(elm.base, elm.bid_amount, Number(elm.t), elm.transition);
    
                            if (win_amount !== undefined && win_amount > 0) {                        
                                const sql = PGDelegate.format(`
                                    INSERT INTO roska_members (mid, uid, sid, gid, win_amount, win_time, transition, transit_to, transit_gid)
                                    VALUES ({mid}, {uid}, {sid}, {gid}, {win_amount}, {win_time}, {transition}, {transit_to}, {transit_gid})
                                    ON CONFLICT (mid, uid, sid) 
                                    DO UPDATE
                                    SET uid={uid}, gid={gid}, win_time={win_time}, win_amount={win_amount}, transition={transition}, transit_to={transit_to}, transit_gid={transit_gid};
                                `,{
                                    mid: `${sid}-${elm.m.trim()}`,
                                    uid: user.uid,
                                    sid,
                                    gid: elm.t !== ''? `${sid}-t${elm.t.padStart(2, '0')}`: ``, 
                                    win_amount,
                                    win_time: elm.bid_date !== ''? format_date: null,
                                    transition: elm.transition !== ''? elm.transition: '0',
                                    transit_to: elm.transition === '1'? users[0].uid: '',
                                    transit_gid: elm.transition === '1'? `${sid}-t00`: '', 
                                });
                                console.log(sql);
                                insert_list.push(sql);
    
                                if (elm.t !== undefined) {
                                    const sql2 = PGDelegate.format(`
                                    UPDATE roska_groups 
                                    SET uid={uid}, mid={mid}, bid_amount={bid_amount}, win_time={win_time}, win_amount={win_amount}
                                    WHERE sid={sid} AND gid={gid};
                                    `,{
                                        mid: `${sid}-${elm.m.trim()}`,
                                        sid,
                                        uid: user.uid,
                                        gid: `${sid}-t${elm.t.padStart(2, '0')}`,
                                        bid_amount: elm.bid_amount !== ''? elm.bid_amount: 0,
                                        win_time: elm.bid_date !== ''? format_date: null,
                                        win_amount
                                    });
                                    console.log(sql2);
                                    insert_list.push(sql2);
                                }                               
                                break;
                            }
                        }
                    }
                }
            }
            else 
            if (Number(count_members.count) === 1) {
                for (const elm of csvData_obj[sid]) {
                    if (elm.m.trim() === '00') continue;
    
                    for (const user of users) {
                        const bid_time = elm.bid_date.split('.');
                        const year = 1911 + Number(bid_time[0]);
                        const month = bid_time[1];
                        const day = bid_time[2];
                        const format_date  = formatDate(new Date(`${year}-${month}-${day}`));
    
                        if (elm.name === user.name) {
                            const win_amount = cal_win_amount(elm.base, elm.bid_amount, Number(elm.t), elm.transition);
                            
        
                            const sql = PGDelegate.format(`
                                INSERT INTO roska_members (mid, uid, sid, gid, win_amount, win_time, transition, transit_to, transit_gid)
                                VALUES ({mid}, {uid}, {sid}, {gid}, {win_amount}, {win_time}, {transition}, {transit_to}, {transit_gid})
                                ON CONFLICT (mid, uid, sid) 
                                DO UPDATE
                                SET uid={uid}, gid={gid}, win_time={win_time}, win_amount={win_amount}, transition={transition}, transit_to={transit_to}, transit_gid={transit_gid};
                            `,{
                                mid: `${sid}-${elm.m.trim()}`,
                                uid: user.uid,
                                sid,
                                gid: elm.t !== ''? `${sid}-t${elm.t.padStart(2, '0')}`: ``, 
                                win_amount,
                                win_time: elm.bid_date !== '' && elm.t !== ''? format_date: null,
                                transition: elm.transition !== ''? elm.transition: '0',
                                transit_to: elm.transition === '1'? users[0].uid: '',
                                transit_gid: elm.transition === '1'? `${sid}-t00`: '', 
                            });
                            console.log(sql);                            
                            insert_list.push(sql);
        
                            if (elm.t !== '') {
                                const sql2 = PGDelegate.format(`
                                UPDATE roska_groups 
                                SET uid={uid}, mid={mid}, bid_amount={bid_amount}, win_time={win_time}, win_amount={win_amount}
                                WHERE sid={sid} AND gid={gid};
                                `,{
                                    mid: `${sid}-${elm.m.trim()}`,
                                    sid,
                                    uid: user.uid,
                                    gid: `${sid}-t${elm.t.padStart(2, '0')}`,
                                    bid_amount: elm.bid_amount !== ''? elm.bid_amount: 0,
                                    win_time: elm.bid_date !== ''? format_date: null,
                                    win_amount
                                });
                                console.log(sql2);
                                insert_list.push(sql2);
                            }
                            
                            break;
                        }
                    }
                }
            } // end if


            console.log('insert_list count:', insert_list.length);
            await Postgres.query(insert_list.join('\n'));
        }
    })
    .on('error', (err) => {
        // Handle any errors that occur during CSV parsing
        console.error('Error while parsing CSV:', err);
    });



    
    function cal_win_amount(base:number, bid_amount:number, T:number, trasfer:string) {
        const remain = cycles - T;

        if (T >= 20)  trasfer = '0';

        switch (trasfer) {
            case '': {
                return 0;
            }
            case '0': {
                if (T < 20) {
                    return (base * T) + ((base - bid_amount) * remain) - (handle_fee * T);
                }
                else {
                    return (base * T) + ((base - bid_amount) * remain) - (handle_fee * T) - (base * remain);
                }                
            }
            case '1': {
                return (base-handle_fee)*T + Interest -trasfer_fee;
            }
        }
    }
    function formatDate(date:Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = '18';
        const minutes = '30';
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const timezoneOffset = date.getTimezoneOffset();
        const offsetHours = Math.abs(Math.floor(timezoneOffset / 60)).toString().padStart(2, '0');
        const offsetMinutes = (Math.abs(timezoneOffset) % 60).toString().padStart(2, '0');
        const offsetSign = timezoneOffset > 0 ? '-' : '+';

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
    }
})().catch(e=>Promise.resolve(e));