import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("public");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        "." + (rel.endsWith("/") ? rel + "index.html" : rel),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(Number(process.env.PORT) || 4173, "0.0.0.0", () =>
    console.log(
      "Gesture Mask Studio: http://localhost:" +
        (Number(process.env.PORT) || 4173),
    ),
  );
