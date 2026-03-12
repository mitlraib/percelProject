  import {defineServer, defineRoom, monitor, playground, createRouter, createEndpoint,} from "colyseus";
  import type { Request, Response, NextFunction } from "express";
  import { MyRoom } from "./rooms/MyRoom.js";
import { DuoRoom } from "./rooms/DuoRoom.js";
  

  const server = defineServer({
    rooms: {
      my_room: defineRoom(MyRoom),
      duo_room: defineRoom(DuoRoom), 

    },

    routes: createRouter({
      api_hello: createEndpoint("/api/hello", { method: "GET" }, async () => {
        return { message: "Hello World" };
      }),
    }),

    express: (app) => {
      // מאפשרים גישה מהדומיין של הקליינט (Render) – CORS פשוט לכל המקורות
      app.use((req: Request, res: Response, next: NextFunction) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header(
          "Access-Control-Allow-Headers",
          "Origin, X-Requested-With, Content-Type, Accept"
        );
        res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        if (req.method === "OPTIONS") {
          res.sendStatus(200);
          return;
        }
        next();
      });
      app.get("/hi", (req: Request, res: Response) => {
        res.send("It's time to kick ass and chew bubblegum!");
      });

      app.use("/colyseus", monitor());

      if (process.env.NODE_ENV !== "production") {
        app.use("/", playground());
      }
    },
  });

  export default server;