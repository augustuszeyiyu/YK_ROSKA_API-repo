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
import { cal_win_amount } from "/lib/cal-win-amount";
import { SysVar } from "/data-type/sysvar";
import { RoskaMembers, RoskaSerials } from "/data-type/groups";



(async()=>{
    await (await import('/index.db.js')).default();    
    
    const cycles      = 24;
    const handle_fee  = 250;
    const trasfer_fee = 300;
    const Interest    = 1000;
    const filePath = path.resolve(__dirname, '../../patches/', '1-10.csv');
    console.log(filePath);
    

    // NOTE: query handling_fee, transition_fee, interest_bonus
    const {rows:sysvar} = await Postgres.query<SysVar>(`SELECT * FROM sysvar WHERE key in ('handling_fee', 'interest_bonus', 'transition_fee') ORDER BY key ASC;`);            
    const handling_fee = Number(sysvar[0].value);
    const interest_bonus = Number(sysvar[1].value);
    const transition_fee = Number(sysvar[2].value);


    const {rows: members} = await Postgres.query<RoskaMembers&RoskaSerials>(`
        select *
        from roska_members m
        INNER JOIN roska_serials s ON m.sid = s.sid
        where RIGHT(gid, 2) >= '20'
        ORDER BY mid;
    `);

    const sql_list:string[] = [];
    for (const member of members) {
        console.log(member.mid, member.transition, member.transit_to);
        
        const {T, A, transition} = cal_win_amount(handling_fee, interest_bonus, transition_fee, member.cycles!, member.basic_unit_amount!, 1000, member.gid, member.transition);
        console.log({T, A, transition});
        
        const sql = PGDelegate.format(`
            UPDATE roska_members 
            SET win_amount = {A}, transition = {transition}, transit_to = ''
            WHERE mid = {mid} AND gid = {gid};
        `, {
            mid: member.mid,
            gid: member.gid,
            A,
            transition
        });

        sql_list.push(sql);
    }
    
    console.log(sql_list);
    await Postgres.query(sql_list.join('\n '));

    
    
})().catch(e=>Promise.resolve(e));