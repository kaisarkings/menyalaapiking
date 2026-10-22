import axios from "axios";

const BASE_URL = "https://amfinder.web.id/api";
const USER_AGENT =
    "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36";

function parseSSE(text) {
    const events = [];
    let event = "message";
    let data = [];

    for (const line of text.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
            event = line.slice(6).trim();
            continue;
        }

        if (line.startsWith("data:")) {
            data.push(line.slice(5).trimStart());
            continue;
        }

        if (!line.trim()) {
            if (data.length) {
                events.push({
                    event,
                    data: data.join("\n")
                });
            }

            event = "message";
            data = [];
        }
    }

    // Tangani event terakhir tanpa baris kosong di akhir.
    if (data.length) {
        events.push({
            event,
            data: data.join("\n")
        });
    }

    return events;
}

function parseEventData(event) {
    try {
        return JSON.parse(event.data);
    } catch {
        return event.data;
    }
}

async function requestSSE(endpoint, params, timeout = 120000) {
    const response = await axios.get(`${BASE_URL}/${endpoint}`, {
        params,
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/event-stream",
            Referer: "https://amfinder.web.id/"
        },
        responseType: "text",
        timeout,
        validateStatus: status => status >= 200 && status < 300
    });

    return parseSSE(response.data);
}

/**
 * Mencari video TikTok berdasarkan kata kunci.
 *
 * @param {string} query Judul atau kata kunci preset.
 * @returns {Promise<object>} Daftar video kandidat dari AMFinder.
 */
export async function searchAmPreset(query) {
    const keyword = String(query || "").trim();

    if (!keyword) {
        throw new Error("Kata kunci pencarian wajib diisi.");
    }

    if (keyword.length > 200) {
        throw new Error("Kata kunci maksimal 200 karakter.");
    }

    try {
        const events = await requestSSE("search", {
            mode: "pick",
            q: keyword
        });

        const errorEvent = events.find(event => event.event === "error");
        if (errorEvent) {
            const errorData = parseEventData(errorEvent);
            throw new Error(
                typeof errorData === "string"
                    ? errorData
                    : errorData.message || errorData.error || "Pencarian video gagal."
            );
        }

        const candidatesEvent = events.find(
            event => event.event === "candidates"
        );

        const resultEvent = events.find(
            event => event.event === "result"
        );

        const candidatesData = candidatesEvent
            ? parseEventData(candidatesEvent)
            : null;

        const resultData = resultEvent
            ? parseEventData(resultEvent)
            : null;

        if (resultData && typeof resultData === "object" && !resultData.ok) {
            throw new Error(
                resultData.message ||
                resultData.error ||
                "Pencarian video gagal."
            );
        }

        const candidates = Array.isArray(candidatesData?.items)
            ? candidatesData.items
            : [];

        return {
            ok: resultData?.ok ?? Boolean(candidatesEvent),
            query: candidatesData?.query || resultData?.query || keyword,
            engine: candidatesData?.engine || resultData?.engine || null,
            fromCache: candidatesData?.fromCache ?? resultData?.fromCache ?? null,
            candidates,
            candidatesCount: candidates.length,
            foundCount: resultData?.foundCount ?? 0,
            elapsedMs: resultData?.elapsedMs ?? null
        };
    } catch (err) {
        throw new Error(
            err.response
                ? `AMFinder HTTP ${err.response.status}`
                : err.message || "Pencarian preset gagal."
        );
    }
}

/**
 * Memindai video TikTok untuk menemukan tautan preset.
 *
 * @param {string} url URL video TikTok.
 * @returns {Promise<object>} Hasil pemindaian preset.
 */
export async function findAmPreset(url) {
    const targetUrl = String(url || "").trim();

    let parsedUrl;

    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        throw new Error("URL TikTok tidak valid.");
    }

    if (
        !["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]
            .includes(parsedUrl.hostname) &&
        !parsedUrl.hostname.endsWith(".tiktok.com")
    ) {
        throw new Error("URL video TikTok wajib diisi.");
    }

    try {
        const events = await requestSSE("find", {
            url: targetUrl
        });

        const resultEvent = events.find(
            event => event.event === "result"
        );

        if (!resultEvent) {
            const errorEvent = events.find(
                event => event.event === "error"
            );

            const errorData = errorEvent
                ? parseEventData(errorEvent)
                : null;

            throw new Error(
                typeof errorData === "string"
                    ? errorData
                    : errorData?.message ||
                      errorData?.error ||
                      "Hasil pemindaian preset tidak ditemukan."
            );
        }

        const result = parseEventData(resultEvent);

        if (!result || typeof result !== "object") {
            throw new Error("Respons pemindaian tidak valid.");
        }

        if (!result.ok) {
            throw new Error(
                result.message ||
                result.error ||
                "Pencarian preset gagal."
            );
        }

        return result;
    } catch (err) {
        throw new Error(
            err.response
                ? `AMFinder HTTP ${err.response.status}`
                : err.message || "Pemindaian preset gagal."
        );
    }
}
