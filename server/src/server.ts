import express from "express";
import { ClientMessage, Drink, ServerMessage } from "cocktail-shared";
import cors from "cors";
import ws from "ws";
import { WebSocket } from "ws";

const DRINKS: Drink[] = [
    {
        id: 0,
        name: "Mojito",
        themeColor: "green",
        description: "A well known and refreshing cocktail.",
        imageUrl: "public/cocktails/1.jpg",
    },
    {
        id: 1,
        name: "Sex on the beach",
        themeColor: "orange",
        description: "Very sweet and tasty.",
        imageUrl: "public/cocktails/2.jpg",
    },
    {
        id: 2,
        name: "Mai Tai",
        themeColor: "blue",
        description: "I don't know whats in it",
        imageUrl: "public/cocktails/3.jpg",
    },
];

// app.get("/", cors(), (req, res) => {
//     res.json({});
// });

// app.get("/drinks", cors(), (req, res) => {
//     res.json({
//         drinks: DRINKS,
//     });
// });

const app = express();
const port = 8000;

const server = app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});

const socketServer = new WebSocket.Server({
    noServer: true,
    path: "/socket",
});

server.on("upgrade", (request, socket, head) => {
    socketServer.handleUpgrade(request, socket, head, (websocket) => {
        socketServer.emit("connection", websocket, request);
    });
});

function sendMessage(to: WebSocket, message: ClientMessage) {
    to.send(JSON.stringify(message));
}

function handleSocketMessage(sender: WebSocket, message: ServerMessage) {
    switch (message.type) {
        case "get-drinks": {
            sendMessage(sender, {
                type: "drinks",
                drinks: DRINKS,
            });
            break;
        }
    }
}

socketServer.on("connection", (ws, req) => {
    console.log("New connection", req.socket.remoteAddress);

    ws.on("message", (data, _) => {
        try {
            const message = JSON.parse(data.toString()) as ServerMessage;
            handleSocketMessage(ws, message);
        } catch (ex) {
            console.error("Could not handle message from " + req.socket.remoteAddress, ex);
        }
    });

    ws.on("close", (code, reason) => {
        console.log("Connection closed", code, reason.toString());
    });

    ws.on("error", (...args) => {
        console.log("Connection error", req.socket.remoteAddress, args);
    });
});
