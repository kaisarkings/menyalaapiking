import axios from 'axios';
import crypto from 'crypto';

const key = 'AIzaSyDtG1AU22ErnQD60AzBAcaknySiz9_CEq0';
const idt = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty';
const vfy = 'https://us-central1-alight-creative.cloudfunctions.net/verifyPurchase';

const dip = () => `${crypto.randomInt(1, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`;

const sp = h => ({
  ...h,
  'x-forwarded-for': dip(),
  'x-real-ip': dip(),
  'client-ip': dip()
});

const h1 = {
  'content-type': 'application/json',
  'x-android-package': 'com.alightcreative.motion',
  'x-android-cert': 'ECA6BF91B8715A6F810ED0BBFC65B6CD578F52A8',
  'user-agent': 'dalvik/2.1.0 (linux; u; android 15; 23127pn0cc build/bp1a.250505.005)'
};

const h2 = {
  'content-type': 'application/json; charset=utf-8',
  'user-agent': 'okhttp/3.12.1',
  'accept-encoding': 'gzip'
};

const bad = e => {
  const d = e.response?.data;
  return d ? (typeof d === 'object' ? JSON.stringify(d) : String(d)) : e.message;
};

class SimpleQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.next();
    });
  }
  next() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;
    const { fn, resolve, reject } = this.queue.shift();
    this.running++;
    fn().then(res => { this.running--; resolve(res); this.next(); })
      .catch(err => { this.running--; reject(err); this.next(); });
  }
}

const apiQueue = new SimpleQueue(1);

function code(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/&amp;/g, '&');
  try { s = decodeURIComponent(s); } catch {}
  try {
    const u = new URL(s);
    let c = u.searchParams.get('oobCode');
    if (!c) {
      const n = u.searchParams.get('link') || u.searchParams.get('q') || u.searchParams.get('url');
      if (n) { try { c = new URL(n).searchParams.get('oobCode'); } catch {} }
    }
    if (c) return c.replace(/[^a-zA-Z0-9_-]/g, '');
  } catch {}
  const m = s.match(/oobCode=([a-zA-Z0-9_-]+)/i);
  if (m) return m[1];
  const t = raw.trim();
  if (/^[a-zA-Z0-9_-]{10,}$/.test(t) && !t.includes('://')) return t;
  return null;
}

export async function sendMagicLink(email) {
  return apiQueue.add(async () => {
    try {
      await axios.post(`${idt}/getOobConfirmationCode?key=${key}`, {
        requestType: 6,
        email: email,
        androidInstallApp: true,
        canHandleCodeInApp: true,
        continueUrl: 'https://alightcreative.com?ui_sid=0366624874&ui_sd=0',
        iosBundleId: 'com.alightcreative.motion',
        androidPackageName: 'com.alightcreative.motion',
        androidMinimumVersion: '585',
        clientType: 'CLIENT_TYPE_ANDROID'
      }, { headers: sp(h1) });
      return { success: true, email, message: "Magic link berhasil dikirim ke email." };
    } catch (e) { 
      throw new Error(bad(e)); 
    }
  });
}

export async function verifyAndActivate(email, rawLink) {
  return apiQueue.add(async () => {
    const c = code(rawLink);
    if (!c) throw new Error('OobCode / Magic Link tidak valid!');
    try {
      const a = await axios.post(`${idt}/emailLinkSignin?key=${key}`, {
        email: email, oobCode: c, clientType: 'CLIENT_TYPE_ANDROID'
      }, { headers: sp(h1) });
      
      const idToken = a.data?.idToken;
      if (!idToken) throw new Error('Gagal mendapatkan idToken dari Firebase.');

      const o = 'kaisarkings-' + crypto.randomBytes(6).toString('hex');
      const b = {
        data: {
          productId: 'am.full.sub.annual.19q4',
          token: 'mmgaobamlahbbeccfplmbkbb.AO-J1OzqG0or_GJJIx-ms8GrTm-jaglCRfhQSRPUZKpl2YspYS-oN7_94uv8RC5vQbvd_Ios2pPDStZ2n7F0hLE3FiOU7HS3R6Fquulv5xLXFECSv4ctElw',
          skuType: 'subs',
          orderId: o
        }
      };
      const headersReq = {
        ...h2,
        authorization: 'Bearer ' + idToken,
        'firebase-instance-id-token': 'cSDnCyp3T-uwp07z3tL86T:APA91bFkmvvsHw5nnqa1SBFci-99DRsKClLiETdRrVcJjS5yBx1v_FbCb1d8WhBuea_zmwnYBktyTIzcRhN4b6uNOUur9wPc0gKXmJDoZic0LhNq5V2s0xI'
      };

      const r = await axios.post(vfy, b, { headers: sp(headersReq) });
      return { success: true, email, subscription: "Annual 1 Tahun", orderId: o, response: r.data };
    } catch (e) { 
      throw new Error(bad(e)); 
    }
  });
}
