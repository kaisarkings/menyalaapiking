
// api/getcontact.js
// GET /api/getcontact?number=6281234567890

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({
      success: false,
      message: "Gunakan HTTP GET."
    });
  }

  const rawNumber = req.query?.number;

  if (typeof rawNumber !== "string" || !rawNumber.trim()) {
    return res.status(400).json({
      success: false,
      message: "Parameter number wajib diisi."
    });
  }

  if (!/^[+()\-\s\d.]+$/.test(rawNumber)) {
    return res.status(400).json({
      success: false,
      message: "Format nomor tidak valid."
    });
  }

  const number = rawNumber.replace(/\D/g, "");

  if (number.length < 8 || number.length > 15) {
    return res.status(400).json({
      success: false,
      message: "Nomor harus terdiri dari 8-15 digit."
    });
  }

  const providerUrl = process.env.PHONE_LOOKUP_API_URL;
  const providerKey = process.env.PHONE_LOOKUP_API_KEY;

  if (!providerUrl) {
    return res.status(503).json({
      success: false,
      message: "Provider lookup belum dikonfigurasi."
    });
  }

  if (!providerUrl.includes("{number}")) {
    return res.status(500).json({
      success: false,
      message: "URL provider harus memiliki {number}."
    });
  }

  try {
    const url = providerUrl.replace(
      "{number}",
      encodeURIComponent(number)
    );

    const headers = {
      Accept: "application/json"
    };

    if (providerKey) {
      headers.Authorization = `Bearer ${providerKey}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15000)
    });

    const contentType =
      response.headers.get("content-type") || "";

    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: "Provider lookup gagal.",
        providerStatus: response.status
      });
    }

    return res.status(200).json({
      success: true,
      number,
      data
    });

  } catch (error) {
    return res.status(
      error.name === "TimeoutError" ? 504 : 502
    ).json({
      success: false,
      message: "Provider lookup tidak dapat dihubungi."
    });
  }
}

