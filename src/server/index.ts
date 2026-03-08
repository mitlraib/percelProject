import server from "./app.config.js";
const port = Number(process.env.PORT) || 2567;

// defineServer מחזיר אובייקט שיש לו listen בפועל (בגרסאות החדשות)
// אבל כדי לא להניח, נעשה בדיקה:
const anyServer = server as any;

if (typeof anyServer.listen !== "function") {
  throw new Error("server.listen is not a function. Check Colyseus version/API.");
}

anyServer.listen(port);
console.log(`Colyseus server listening on ws://localhost:${port}`);