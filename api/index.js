import { mediafire } from '../lib/mediafire.js';
import { scrapeTikTok } from '../lib/tiktok.js';
import { findAmPreset, searchAmPreset } from '../lib/amfinder.js';
import tempmail from '../lib/tempmail.js';
import { createFreeFireGuest } from '../lib/createguestff.js';
import { mediaDownloader } from '../lib/aiodownload.js';
import { sendMagicLink, verifyAndActivate } from '../lib/aligmotion.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const path = req.url || '';
    const queryParams = req.query || {};
    const body = req.body || {};
    const params = { ...queryParams, ...body };
    const urlParam = params.url || params.link;
    const timestamp = new Date().toISOString();

    try {
        if (path.includes('/tools/amgen')) {
            const action = String(params.action || '').toLowerCase();
            const email = params.email;
            const targetLink = params.link || params.url;

            if (action === 'sendlink') {
                if (!email) {
                    return res.status(400).json({
                        status: false,
                        creator: 'Kaisarkings',
                        message: "Parameter 'email' wajib diisi.",
                        timestamp
                    });
                }

                const result = await sendMagicLink(email);

                return res.status(200).json({
                    status: true,
                    creator: 'Kaisarkings',
                    message: 'Success',
                    result,
                    timestamp
                });
            }

            if (action === 'veriflink') {
                if (!email || !targetLink) {
                    return res.status(400).json({
                        status: false,
                        creator: 'Kaisarkings',
                        message: "Parameter 'email' dan 'link' wajib diisi.",
                        timestamp
                    });
                }

                const result = await verifyAndActivate(email, targetLink);

                return res.status(200).json({
                    status: true,
                    creator: 'Kaisarkings',
                    message: 'Success',
                    result,
                    timestamp
                });
            }

            return res.status(200).json({
                status: true,
                creator: 'Kaisarkings',
                message: 'AMGen API Active',
                timestamp
            });
        }

        if (path.includes('/download/aio')) {
            if (!urlParam) {
                return res.status(400).json({
                    status: false,
                    creator: 'Kaisarkings',
                    message: "Parameter 'url' wajib.",
                    timestamp
                });
            }

            const result = await mediaDownloader(urlParam);

            return res.status(200).json({
                status: true,
                creator: 'Kaisarkings',
                message: 'Success',
                result,
                timestamp
            });
        }

        if (path.includes('/tools/ffguest')) {
            const count = parseInt(params.count || 1, 10);

            if (!Number.isInteger(count) || count < 1 || count > 10) {
                return res.status(400).json({
                    status: false,
                    creator: 'Kaisarkings',
                    message: "Parameter 'count' harus antara 1 sampai 10.",
                    timestamp
                });
            }

            const result = await createFreeFireGuest(count);

            return res.status(200).json({
                status: true,
                creator: 'Kaisarkings',
                message: 'Success',
                result,
                timestamp
            });
        }

        if (path.includes('/tools/tempmail')) {
            const action = String(params.action || '').toLowerCase();

            if (action === 'create') {
                const data = await tempmail.createTempEmail(params.username);

                return res.status(200).json({
                    status: true,
                    creator: 'Kaisarkings',
                    message: 'Success',
                    result: data,
                    timestamp
                });
            }

            if (action === 'inbox') {
                const data = await tempmail.getInbox(params.username);

                return res.status(200).json({
                    status: true,
                    creator: 'Kaisarkings',
                    message: 'Success',
                    result: data,
                    timestamp
                });
            }

            if (action === 'message') {
                const data = await tempmail.getMessage(params.username, params.id);

                return res.status(200).json({
                    status: true,
                    creator: 'Kaisarkings',
                    message: 'Success',
                    result: data,
                    timestamp
                });
            }

            return res.status(200).json({
                status: true,
                creator: 'Kaisarkings',
                message: 'Tempmail API Active',
                timestamp
            });
        }

        if (path.includes('/download/tiktok')) {
            if (!urlParam) {
                return res.status(400).json({
                    status: false,
                    creator: 'Kaisarkings',
                    message: "Parameter 'url' wajib.",
                    timestamp
                });
            }

            const result = await scrapeTikTok(urlParam);

            return res.status(200).json({
                status: true,
                creator: 'Kaisarkings',
                message: 'Success',
                result,
                timestamp
            });
        }

        if (path.includes('/download/mediafire')) {
            if (!urlParam) {
                return res.status(400).json({
                    status: false,
                    creator: 'Kaisarkings',
                    message: "Parameter 'url' wajib.",
                    timestamp
                });
            }

            const result = await mediafire(urlParam);

            return res.status(200).json({
                status: true,
                creator: 'Kaisarkings',
                message: 'Success',
                result,
                timestamp
            });
        }

        if (path.includes('/tools/amfinder')) {
            const action = String(params.action || '').toLowerCase();
            const keyword = String(params.query || params.q || '').trim();

            // Pencarian video TikTok berdasarkan kata kunci.
            if (action === 'search' || keyword) {
                if (!keyword) {
                    return res.status(400).json({
                        status: false,
                        creator: 'Kaisarkings',
                        message: "Parameter 'query' wajib diisi untuk pencarian.",
                        timestamp
                    });
                }

                const result = await searchAmPreset(keyword);

                return res.status(200).json({
                    status: true,
                    creator: 'Kaisarkings',
                    message: 'Success',
                    mode: 'search',
                    result,
                    timestamp
                });
            }

            // Pemindaian preset dari URL video TikTok.
            if (action === 'find' || urlParam) {
                if (!urlParam) {
                    return res.status(400).json({
                        status: false,
                        creator: 'Kaisarkings',
                        message: "Parameter 'url' wajib diisi untuk scan preset.",
                        timestamp
                    });
                }

                const result = await findAmPreset(urlParam);

                return res.status(200).json({
                    status: true,
                    creator: 'Kaisarkings',
                    message: 'Success',
                    mode: 'find',
                    result,
                    timestamp
                });
            }

            return res.status(400).json({
                status: false,
                creator: 'Kaisarkings',
                message: "Isi parameter 'query' untuk mencari video atau 'url' untuk scan preset.",
                usage: {
                    search: '/tools/amfinder?query=alight%20motion',
                    find: '/tools/amfinder?url=https%3A%2F%2Fwww.tiktok.com%2F%40username%2Fvideo%2F123456789'
                },
                timestamp
            });
        }

        return res.status(200).json({
            status: true,
            creator: 'Kaisarkings',
            message: 'Kaisar API is active!',
            endpoints: {
                amgen: '/tools/amgen?action=sendlink&email=... / veriflink&email=...&link=...',
                aio: '/download/aio?url=<target_url>',
                tiktok: '/download/tiktok?url=<tiktok_url>',
                mediafire: '/download/mediafire?url=<mediafire_url>',
                amfinder: {
                    search: '/tools/amfinder?query=<keyword>',
                    find: '/tools/amfinder?url=<tiktok_url_for_preset>'
                },
                tempmail: '/tools/tempmail?action=create / inbox / message',
                ffguest: '/tools/ffguest?count=1 (max 10)'
            },
            creator: 'Kaisarkings',
            timestamp
        });

    } catch (err) {
        return res.status(400).json({
            status: false,
            creator: 'Kaisarkings',
            message: err.message || 'Terjadi kesalahan.',
            timestamp
        });
    }
}
