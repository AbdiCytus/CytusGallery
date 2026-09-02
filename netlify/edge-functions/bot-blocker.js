export default async (request, context) => {
  const userAgent = request.headers.get("user-agent") || "";
  
  // Daftar nama bot yang akan diblokir dari Edge CDN
  const blockedAgents = [
    "python-requests", "curl", "wget", "scrapy", "postman",
    "googlebot", "bingbot", "yandex", "petalbot", "ahrefs",
    "semrush", "bot", "spider", "crawl", "slurp", "meta-externalagent"
  ];

  const isBot = blockedAgents.some((bot) => userAgent.toLowerCase().includes(bot));

  if (isBot || userAgent.trim() === "") {
    console.log(`[EDGE BLOCKED] User-Agent: ${userAgent || "N/A"}`);
    return new Response("Akses ditolak dari CDN. Bot/Scraper terdeteksi.", {
      status: 403,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // Jika aman, biarkan request diteruskan ke Serverless Function
  return context.next();
};
