const serverless = require("serverless-http");
const app = require("../../src/app");

// Membungkus aplikasi Express agar bisa dijalankan oleh Netlify
module.exports.handler = serverless(app, {
  binary: [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/*",
  ],
});
