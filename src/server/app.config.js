import { defineServer, defineRoom, monitor, playground, createRouter, createEndpoint, } from "colyseus";
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
        app.get("/hi", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });
        app.use("/colyseus", monitor());
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }
    },
});
export default server;
