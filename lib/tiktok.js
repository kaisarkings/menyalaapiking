import axios from 'axios';
import * as cheerio from 'cheerio';

function formatNumber(value) {
    const number = Number(value) || 0;
    return number.toLocaleString("id-ID");
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
}

async function tiktokv1(url) {
    try {
        const response = await axios.post("https://www.tikwm.com/api/", {}, {
            params: { url, count: 12, cursor: 0, web: 1, hd: 1 },
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Origin: "https://www.tikwm.com",
                Referer: "https://www.tikwm.com/",
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/116.0.0.0 Mobile Safari/537.36",
                "X-Requested-With": "XMLHttpRequest"
            },
            timeout: 30000
        });

        const res = response?.data?.data;
        if (!res) return { status: false, msg: "Data TikTok tidak ditemukan." };

        const data = [];
        if (Number(res.duration) === 0 && Array.isArray(res.images) && res.images.length) {
            for (const image of res.images) {
                if (!image) continue;
                data.push({ type: "photo", url: image });
            }
        } else {
            const wm = res.wmplay ? `https://www.tikwm.com${res.wmplay}` : null;
            const nowm = res.play ? `https://www.tikwm.com${res.play}` : null;
            const hd = res.hdplay ? `https://www.tikwm.com${res.hdplay}` : null;

            if (wm) data.push({ type: "watermark", url: wm });
            if (nowm) data.push({ type: "nowatermark", url: nowm });
            if (hd) data.push({ type: "nowatermark_hd", url: hd });
        }

        const music = res.music_info || {};
        const author = res.author || {};

        return {
            status: true,
            title: res.title || "-",
            taken_at: formatDate(res.create_time),
            region: res.region || "-",
            id: res.id || "-",
            duration: `${Number(res.duration) || 0} Detik`,
            cover: res.cover ? `https://www.tikwm.com${res.cover}` : null,
            data,
            music_info: {
                id: music.id || null,
                title: music.title || "-",
                author: music.author || "-",
                album: music.album || null,
                url: res.music ? `https://www.tikwm.com${res.music}` : music.play || null
            },
            stats: {
                views: formatNumber(res.play_count),
                likes: formatNumber(res.digg_count),
                comment: formatNumber(res.comment_count),
                share: formatNumber(res.share_count),
                download: formatNumber(res.download_count)
            },
            author: {
                id: author.id || null,
                fullname: author.unique_id || "-",
                nickname: author.nickname || "-",
                avatar: author.avatar ? `https://www.tikwm.com${author.avatar}` : null
            }
        };
    } catch (error) {
        return { status: false, msg: error?.message || "TikWM error" };
    }
}

async function tiktokv2(url) {
    try {
        const response = await axios.post("https://savetik.co/api/ajaxSearch", new URLSearchParams({ q: url, lang: "id" }).toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest",
                origin: "https://savetik.co",
                referer: "https://savetik.co/id1"
            },
            timeout: 30000
        });

        const html = response?.data?.data;
        if (!html) throw new Error("Response SaveTik kosong.");

        const $ = cheerio.load(html);
        const mp4 = $('.dl-action a:contains("MP4")').not(':contains("HD")').first().attr("href") || null;
        const mp4Hd = $('.dl-action a:contains("HD")').first().attr("href") || null;
        const mp3 = $('.dl-action a:contains("MP3")').first().attr("href") || null;
        const foto = $('.photo-list a[href*="snapcdn"]').map((_, el) => $(el).attr("href")).get().filter(Boolean);

        return { status: true, title: $("h3").first().text().trim() || null, mp4, mp4_hd: mp4Hd, mp3, foto };
    } catch (error) {
        return { status: false, msg: error?.message || "SaveTik error" };
    }
}

function getAudioUrl(data) {
    return data?.music_info?.url || data?.audio || data?.mp3 || null;
}

function getVideoUrl(data) {
    if (Array.isArray(data?.data)) {
        return data.data.find(i => i?.type === "nowatermark_hd" && i?.url)?.url ||
               data.data.find(i => i?.type === "nowatermark" && i?.url)?.url ||
               data.data.find(i => i?.type === "watermark" && i?.url)?.url || null;
    }
    return data?.mp4_hd || data?.mp4 || null;
}

function getPhotos(data) {
    if (Array.isArray(data?.data)) {
        const photos = data.data.filter(i => i?.type === "photo" && i?.url).map(i => i.url);
        if (photos.length) return photos;
    }
    return Array.isArray(data?.foto) ? data.foto.filter(Boolean) : [];
}

export async function scrapeTikTok(url) {
    const targetUrl = String(url || "").trim();
    if (!targetUrl || !targetUrl.includes("tiktok.com")) {
        throw new Error("URL TikTok wajib diisi dengan benar.");
    }

    let data = await tiktokv1(targetUrl);
    if (!data?.status) {
        data = await tiktokv2(targetUrl);
    }

    if (!data?.status) {
        throw new Error(data?.msg || "Gagal mengambil media TikTok.");
    }

    const photos = getPhotos(data);
    const videoUrl = getVideoUrl(data);
    const audioUrl = getAudioUrl(data);

    return {
        type: photos.length ? "image" : "video",
        title: data.title || "-",
        author: data?.author || {},
        stats: data?.stats || {},
        duration: data?.duration || "-",
        video_url: videoUrl,
        photos: photos,
        audio_url: audioUrl
    };
}
