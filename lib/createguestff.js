import axios from 'axios';
import crypto from 'crypto';

export async function createFreeFireGuest(count = 1) {
    let countInput = parseInt(count) || 1;
    let maxCount = Math.min(Math.max(countInput, 1), 10); // Batasi maksimal 10 akun per eksekusi

    const app_id = 100067;
    const secret = '2ee44819e9b4598845141067b281621874d0d5d7af9d8f7e00c1e54715b7d1e3';
    const host = 'https://100067.connect.garena.com';
    const ua = 'GarenaMSDK/4.0.42(NEO G12 ;Android 17;in;ID;app 1.130.1 2019121040;)';

    let accountsData = [];

    for (let i = 0; i < maxCount; i++) {
        const password = crypto.randomBytes(32).toString('hex').toUpperCase();
        const regBody = { app_id, client_type: 2, password, source: 2 };
        const sig = crypto.createHmac('sha256', secret).update(JSON.stringify(regBody)).digest('hex');

        const regRes = await axios.post(`${host}/api/v2/oauth/guest:register`, regBody, {
            headers: { 
                'User-Agent': ua, 
                'Content-Type': 'application/json; charset=utf-8', 
                'Authorization': `Signature ${sig}` 
            },
            validateStatus: () => true
        });

        if (regRes.data.code !== 0 || !regRes.data.data?.uid) {
            throw new Error(regRes.data.error || 'Gagal register akun guest Free Fire.');
        }

        const uid = regRes.data.data.uid;
        const grantRes = await axios.post(`${host}/api/v2/oauth/guest/token:grant`, {
            client_id: app_id,
            client_secret: secret,
            client_type: 2,
            password,
            response_type: 'token',
            uid
        }, {
            headers: { 
                'User-Agent': ua, 
                'Content-Type': 'application/json; charset=utf-8' 
            },
            validateStatus: () => true
        });

        if (grantRes.data.code !== 0 || !grantRes.data.data?.access_token) {
            throw new Error(grantRes.data.error || 'Gagal mengambil token guest Free Fire.');
        }

        accountsData.push({
            index: i + 1,
            uid,
            password,
            open_id: grantRes.data.data.open_id,
            access_token: grantRes.data.data.access_token
        });
    }

    return {
        total: accountsData.length,
        accounts: accountsData
    };
}
