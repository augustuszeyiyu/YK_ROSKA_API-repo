import http from 'http';
import https from 'https';


export async function Decrypt(url:string, secret:string):Promise<{data:string}> {
    if (!secret) throw new Error('Environment Variable SECRET does not exit!');

    const encrypt_secret = JSON.stringify({data:secret});

    return new Promise(async(resolve, reject) => {
        const querystring = new URL(url);        
        const options = {
            hostname: querystring.hostname,
            port: querystring.protocol === 'https:'?443 : Number(querystring.port),
            method: 'POST',
            path: querystring.pathname,
            headers: {
              'Content-Type': 'application/json',
            }
        }
        const req = (querystring.protocol === 'https:'? https:http).request(options, res => {
            const status_code = res.statusCode!
            const chunks:Buffer[] = [];

            
            res
            .on('data', (chunk)=>chunks.push(chunk))
            .on('end', ()=>{
                
                if (status_code !== 200) {
                    const error:{scope?:string; code?:string; detail?:any}&Error = new Error(`Error Status: ${status_code}.`);
                    error.scope = 'internal';
                    error.code = 'Invalid response content!';
                    reject(error);
                }


                const raw = Buffer.concat(chunks);
				let json_data:any, utf8_data:string|undefined;                
				try { 
                    utf8_data = raw.toString('utf8');
                    json_data = JSON.parse(utf8_data);                        
                    
                    if ( !json_data ) {
                        const error:{scope?:string; code?:string; detail?:any}&Error = new Error('SECRET is incorrect. Please Check again.');
                        error.scope = 'internal';
                        error.code = 'Invalid response content!';
                        reject(error);
                    }
                    resolve(json_data);
                } catch(e) {
                    const error:{scope?:string; code?:string; detail?:any}&Error = new Error('SECRET is incorrect. Please Check again.');
                    error.scope = 'internal';
                    error.code = 'Invalid response content!';
                    reject(error);
                }                 
            });
        });
        req.on('error', (e) => {
            const error:{scope?:string; code?:string; detail?:any}&Error = new Error(e.message);
            error.scope = 'internal';
            error.code = 'Invalid response content!';
            reject(error);
        });
        req.write(encrypt_secret);
        req.end();
    });
}