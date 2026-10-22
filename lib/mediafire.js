import axios from 'axios';
import * as cheerio from 'cheerio';

export async function mediafire(url) {
    if (!url) {
        throw new Error('URL MediaFire wajib diisi');
    }

    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 30000
        });

        const $ = cheerio.load(res.data);

        const downloadUrl =
            $('#downloadButton').attr('href') ||
            $('a#downloadButton').attr('href') ||
            $('a[href*="download"]').first().attr('href') ||
            null;

        const fileName =
            $('.filename').first().text().trim() ||
            $('div.fileinfolist li:nth-child(1) span').first().text().trim() ||
            $('meta[property="og:title"]').attr('content')?.trim() ||
            'Unknown File';

        const fileSize =
            $('a.inputlike span').first().text().trim() ||
            $('.filetype').first().text().trim() ||
            $('div.fileinfo').first().text().trim() ||
            'Unknown Size';

        if (!downloadUrl) {
            throw new Error('Link download langsung tidak ditemukan.');
        }

        return {
            fileName,
            fileSize,
            downloadUrl
        };
    } catch (err) {
        if (err.response) {
            throw new Error(
                `MediaFire Error (${err.response.status}): ${
                    err.response.statusText || 'Request gagal'
                }`
            );
        }

        throw new Error(`MediaFire Error: ${err.message}`);
    }
}
