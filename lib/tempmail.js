import http from 'node:http';
import https from 'node:https';

const DOMAIN = 'akunlama.com';
const PROVIDER_BASE_URL = (
    process.env.TEMPMAIL_PROVIDER_URL ||
    `https://${DOMAIN}`
).replace(/\/+$/, '');

const REQUEST_TIMEOUT = 15000;
const MAX_REDIRECTS = 5;

function request(url, options = {}, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        let parsed;

        try {
            parsed = new URL(url);
        } catch {
            return reject(new Error('URL tidak valid.'));
        }

        const client = parsed.protocol === 'https:' ? https : http;

        const headers = {
            Accept: '*/*',
            'User-Agent': 'Mozilla/5.0',
            ...(options.headers || {})
        };

        const req = client.request(
            parsed,
            {
                method: options.method || 'GET',
                headers,
                timeout: options.timeout || REQUEST_TIMEOUT
            },
            res => {
                const chunks = [];

                res.on('data', chunk => {
                    chunks.push(chunk);
                });

                res.on('end', async () => {
                    const body = Buffer.concat(chunks).toString('utf8');
                    const statusCode = res.statusCode || 0;
                    const location = res.headers.location;

                    if (location && statusCode >= 300 && statusCode < 400) {
                        if (redirectCount >= MAX_REDIRECTS) {
                            return reject(new Error('Terlalu banyak redirect.'));
                        }

                        let redirectUrl;

                        try {
                            redirectUrl = new URL(location, parsed).toString();
                        } catch {
                            return reject(new Error('URL redirect provider tidak valid.'));
                        }

                        try {
                            const result = await request(
                                redirectUrl,
                                options,
                                redirectCount + 1
                            );
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }

                        return;
                    }

                    resolve({
                        statusCode,
                        headers: res.headers,
                        body,
                        url: parsed.toString()
                    });
                });
            }
        );

        req.on('timeout', () => {
            req.destroy(new Error('Request ke provider timeout.'));
        });

        req.on('error', error => {
            reject(error);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeUsername(input) {
    let value = String(input || '').trim();
    value = value.replace(new RegExp(`@${escapeRegExp(DOMAIN)}$`, 'i'), '');
    return value.trim();
}

export function getEmail(username) {
    const clean = normalizeUsername(username);
    if (!clean) return '';
    return `${clean}@${DOMAIN}`;
}

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateUsername(length = 10) {
    const first = [
        'zero', 'dark', 'blue', 'red', 'wolf',
        'ghost', 'neo', 'cyber', 'cloud', 'rey',
        'nova', 'pixel', 'rapid', 'shadow', 'night',
        'apex', 'blaze', 'frost', 'vortex', 'stellar',
        'omega', 'zenith', 'phantom', 'hyper', 'matrix',
        'quantum', 'silent', 'cortex', 'vector', 'titan',
        'pulse', 'neon', 'echo', 'turbo', 'flux',
        'sigma', 'alpha', 'beta', 'delta', 'prime',
        'astro', 'sonic', 'orbit', 'solar', 'lunar'
    ];

    const second = [
        'whale', 'tiger', 'fox', 'lion', 'bird',
        'storm', 'byte', 'code', 'mail', 'dev',
        'star', 'wave', 'fire', 'moon', 'tech',
        'hawk', 'viper', 'raven', 'dragon', 'knight',
        'blade', 'core', 'net', 'link', 'node',
        'flux', 'sync', 'beam', 'shield', 'spark',
        'flash', 'glitch', 'stream', 'comet', 'nexus',
        'matrix', 'pilot', 'runner', 'hacker', 'ghost'
    ];

    let username = `${randomItem(first)}_${randomItem(second)}`;

    while (username.length < length) {
        username += randomNumber(0, 9);
    }

    return username.slice(0, Math.max(length, 1)).toLowerCase();
}

export function generateManualUsername(input) {
    return normalizeUsername(input);
}

function decodeHtml(value) {
    return String(value || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
}

function stripHtml(value) {
    return decodeHtml(
        String(value || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<[^>]*>/g, '')
    )
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function parseMessageHtml(html, email, messageId) {
    const body = String(html || '');
    const text = stripHtml(body);
    const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const subject = titleMatch ? stripHtml(titleMatch[1]) : 'Pesan masuk';

    return {
        id: messageId,
        messageId,
        uid: messageId,
        subject,
        sender: null,
        from: null,
        recipient: email,
        to: email,
        preview: text.slice(0, 300),
        text,
        html: body,
        timestamp: null,
        time: null,
        read_at: null,
        email
    };
}

export async function providerInbox(username) {
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) {
        throw new Error('Username wajib diisi.');
    }

    const email = getEmail(cleanUsername);
    const url = `${PROVIDER_BASE_URL}/api/list?recipient=` + encodeURIComponent(email);

    const response = await request(url, {
        timeout: REQUEST_TIMEOUT,
        headers: { Accept: 'application/json' }
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`Provider mengembalikan HTTP ${response.statusCode}.`);
    }

    let data;
    try {
        data = JSON.parse(response.body);
    } catch {
        throw new Error('Response provider bukan JSON yang valid.');
    }

    if (!Array.isArray(data)) {
        throw new Error('Format response inbox provider tidak valid.');
    }

    const messages = data
        .map(item => {
            const headers = item?.message?.headers || {};
            const storage = item?.storage || {};
            const key = storage.key || item.id || null;
            const region = storage.region || 'us';

            return {
                id: key,
                messageId: key,
                uid: key,
                subject: headers.subject || 'Pesan masuk',
                sender: headers.from || null,
                from: headers.from || null,
                recipient: headers.to || email,
                to: headers.to || email,
                preview: item.preview || '',
                timestamp: item.timestamp || null,
                time: item.timestamp || null,
                read_at: item.read_at || null,
                region,
                storage: { key, region },
                email,
                url: key
                    ? new URL(
                        `/inbox/${encodeURIComponent(email)}/message/${encodeURIComponent(region)}/${encodeURIComponent(key)}`,
                        PROVIDER_BASE_URL
                    ).toString()
                    : null
            };
        })
        .filter(message => Boolean(message.id));

    return {
        username: cleanUsername,
        email,
        messages: Array.from(new Map(messages.map(m => [m.id, m])).values()),
        count: messages.length,
        statusCode: response.statusCode,
        url: response.url
    };
}

export async function providerMessage(username, messageId, region = 'us') {
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) throw new Error('Username wajib diisi.');
    if (!messageId) throw new Error('Message ID wajib diisi.');

    const email = getEmail(cleanUsername);
    const cleanRegion = String(region || 'us').trim() || 'us';

    const keyUrl = `${PROVIDER_BASE_URL}/api/getKey?region=` + encodeURIComponent(cleanRegion) + `&key=` + encodeURIComponent(messageId);
    const htmlUrl = `${PROVIDER_BASE_URL}/api/getHtml?region=` + encodeURIComponent(cleanRegion) + `&key=` + encodeURIComponent(messageId);

    const [keyResponse, htmlResponse] = await Promise.all([
        request(keyUrl, { timeout: REQUEST_TIMEOUT, headers: { Accept: 'application/json' } }),
        request(htmlUrl, { timeout: REQUEST_TIMEOUT, headers: { Accept: 'text/html,text/plain,*/*' } })
    ]);

    if (keyResponse.statusCode < 200 || keyResponse.statusCode >= 300) {
        throw new Error(`Provider getKey mengembalikan HTTP ${keyResponse.statusCode}.`);
    }

    if (htmlResponse.statusCode < 200 || htmlResponse.statusCode >= 300) {
        throw new Error(`Provider getHtml mengembalikan HTTP ${htmlResponse.statusCode}.`);
    }

    let keyData = null;
    try {
        keyData = JSON.parse(keyResponse.body);
    } catch {
        keyData = null;
    }

    const keyMessage = keyData?.message || {};
    const keyHeaders = keyMessage?.headers || keyData?.headers || {};

    const parsed = parseMessageHtml(htmlResponse.body, email, messageId);

    const subject = keyHeaders.subject || keyData?.subject || parsed.subject || 'Pesan masuk';
    const sender = keyHeaders.from || keyData?.from || null;
    const recipient = keyHeaders.to || keyData?.to || email;

    const message = {
        ...parsed,
        subject,
        sender,
        from: sender,
        recipient,
        to: recipient,
        region: cleanRegion,
        storage: { key: messageId, region: cleanRegion },
        providerData: keyData,
        html: htmlResponse.body,
        text: stripHtml(htmlResponse.body)
    };

    return {
        username: cleanUsername,
        email,
        found: true,
        message,
        statusCode: htmlResponse.statusCode,
        url: `${PROVIDER_BASE_URL}/inbox/` + encodeURIComponent(email) + `/message/` + encodeURIComponent(cleanRegion) + `/` + encodeURIComponent(messageId)
    };
}

export async function getInbox(username) {
    return providerInbox(username);
}

export async function getMessage(username, messageId, region = 'us') {
    return providerMessage(username, messageId, region);
}

export async function createUsername(requestedUsername) {
    const username = requestedUsername ? generateManualUsername(requestedUsername) : generateUsername();
    if (!username) {
        throw new Error('Username tidak valid.');
    }
    return {
        username,
        email: getEmail(username)
    };
}

export async function createTempEmail(requestedUsername) {
    return createUsername(requestedUsername);
}

export async function isUsernameAvailable(username) {
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) return false;

    try {
        const inbox = await providerInbox(cleanUsername);
        return {
            available: true,
            username: cleanUsername,
            email: getEmail(cleanUsername),
            inbox: inbox.messages
        };
    } catch {
        return {
            available: true,
            username: cleanUsername,
            email: getEmail(cleanUsername),
            inbox: []
        };
    }
}

export async function proxyProvider(query = {}) {
    const username = query.username || query.mailbox || query.recipient;
    const id = query.id || query.messageId || query.uid;
    const region = query.region || 'us';

    if (id) {
        return providerMessage(username, id, region);
    }
    return providerInbox(username);
}

export default {
    providerInbox,
    providerMessage,
    getInbox,
    getMessage,
    createUsername,
    createTempEmail,
    isUsernameAvailable,
    proxyProvider,
    normalizeUsername,
    getEmail
};
