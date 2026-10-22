import axios from 'axios';

export async function mediaDownloader(targetUrl) {
  if (!targetUrl) {
    throw new Error('URL target wajib diisi');
  }
  const endpoint = 'https://mediadownloader.web.id/api/download';
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/json',
    'Referer': 'https://mediadownloader.web.id/',
    'Origin': 'https://mediadownloader.web.id'
  };

  try {
    const response = await axios.post(endpoint, { url: targetUrl }, { headers, timeout: 30000 });
    const resData = response.data;

    if (!resData || !resData.success || !resData.result) {
      throw new Error('Respon dari server kosong atau tidak valid');
    }

    const res = resData.result;
    const mediaItems = [];

    if (Array.isArray(res.downloads)) {
      res.downloads.forEach((dl) => {
        mediaItems.push({
          label: dl.label || 'Media',
          url: dl.url,
          quality: dl.quality || 'Default',
          type: dl.type || 'media',
          ext: dl.ext || 'mp4'
        });
      });
    }

    return {
      title: res.title || res.description || 'Tanpa Judul',
      platform: res.platform || 'Unknown',
      owner: res.owner || null,
      duration: res.duration || null,
      thumbnail: res.thumbnail || null,
      totalMedia: mediaItems.length,
      medias: mediaItems
    };
  } catch (error) {
    if (error.response) {
      throw new Error(`Server Error (${error.response.status}): ${error.response.data?.message || error.response.statusText}`);
    }
    throw new Error(`AIO Downloader Error: ${error.message}`);
  }
}
