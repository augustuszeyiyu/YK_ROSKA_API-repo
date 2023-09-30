import payload = require('/package.json');
import { FastifyInstance, FastifyReply, FastifyRequest } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoscaGroups, RoscaMembers } from '/data-type/groups';
import { User } from '/data-type/users';
import { MAX_NUMBER } from 'updator/_dist/version';
import { PGDelegate } from 'pgdelegate';


export = async function(fastify: FastifyInstance) {
	/** 建立組團編號 **/
	{
		const schema = {
			description: '產組團編號',
			summary: '產組團編號',
            body: {},
		};

		fastify.post('/group', {schema}, async (req, res)=>{
            const {uid}:{uid:User['uid']} = req.session.token!;

            const {rows:[row]} = await Postgres.query<RoscaGroups>(`SELECT gid FROM roska_groups ORDER BY gid DESC;`);
            
            let gid = generateNextId(row.gid);
            if (gid === undefined)  gid = generateNextId('YA0000');
            
            await Postgres.query(`INSERT INTO roska_groups(gid, max_member) VALUES ($1, $2) RETURNING *;`, [gid, MAX_NUMBER]);

            const sql_list:string[] = [];
            for (let index = 1; index <= MAX_NUMBER; index++) {
                const number_string = index.toString().padStart(2, '0');
                sql_list.push(PGDelegate.format(`INSERT INTO roska_members(mid, gid) VALUES ({mid}, {gid});`, {mid:`${gid}-${number_string}`, gid}));
            }
            
            await Postgres.query(sql_list.join(', '));
            
			res.status(200).send({gid});
		});


        function generateNextId(last_group_id:string) {
            let  currentPrefix = last_group_id.substring(1,2);
            let  currentNumber = Number(last_group_id.substring(2, last_group_id.length));

            // Get the current date in YYMMDD format
            const today = new Date();
            const year = today.getFullYear() % 100;
            const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Ensure 2 digits for month
            const day = today.getDate().toString().padStart(2, '0'); // Ensure 2 digits for day
            const yymmdd = `${year}${month}${day}`;
            console.log(yymmdd);
            
            
            
            // Increment the number and handle prefix changes
            currentNumber++;
            if (currentNumber > 9999) {
                currentNumber = 1; // Reset the number to '1'
                currentPrefix = String.fromCharCode(currentPrefix.charCodeAt(0) + 1); // Increment the prefix character
            }
            

            // Create the ID by combining the prefix, number, and date
            const id = `Y${currentPrefix}${currentNumber.toString().padStart(4, '0')}-${yymmdd}`;


            return id;
        }
	}

    {
        const schema = {
			description: '加入改團，新增會員入團',
			summary: '加入改團，新增會員入團',
            params: {
                description: '加入改團，新增會員入團',
                type: 'object',
				properties: {
                    gid: { type: 'string' }
                },
            },
		};

        fastify.post<{Params:{gid:RoscaGroups['gid']}}>('/group/member/:gid', {schema}, async (req, res)=>{
            const {uid}:{uid:User['uid']} = req.session.token!;

            const {gid} = req.params;
            
            const {rows:[row]} = await Postgres.query(`SELECT mid FROM roska_members WHERE gid=$1 AND join_time=0 ORDER BY mid ASC LIMIT 1;`, [gid]);
            await Postgres.query<RoscaMembers>(`UPDATE roska_members SET uid=$1, joing_time=$2 WHERE mid=$3 AND gid=$4 RETURNING *;`, [uid, Date.unix(), gid, row.mid]);

            
			res.status(200).send({gid});
		});
    }

    {
        const schema = {
			description: '搜尋該團下的成員',
			summary: '搜尋該團下的成員',
            params: {
                description: '搜尋該團下的成員',
                type: 'object',
				properties: {
                    gid: { type: 'string' }
                },
            },
		};

        fastify.get<{Params:{gid:RoscaGroups['gid']}}>('/group:/gid', {schema}, async (req, res)=>{

            const {gid} = req.params;

            const {rows} = await Postgres.query(
                `SELECT m.mid, m.gid, u.uid, u.contact_mobile_number, u.address
                FROM roska_groups g
                INNER JOIN roska_members m ON g.gid=m=gid
                LEFT JOIN users u ON m.uid=u.uid
                WHERE g.gid=$1
                ORDER BY m.mid ASC;`,[gid]);

            return res.status(200).send(rows);
        });
    }

};
