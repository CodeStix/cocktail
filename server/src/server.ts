import express from "express";
import { ClientMessage, Drink, ServerMessage } from "cocktail-shared";
import cors from "cors";
import ws from "ws";
import { WebSocket } from "ws";
import chalk from "chalk";
import { PinMode, PullUpDownMode, pinMode, pullUpDnControl } from "tinker-gpio";
import { CocktailMachine } from ".";
import i2c from "i2c-bus";

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

let machine: CocktailMachine;

const app = express();
const port = 8000;

// app.get("/", cors(), (req, res) => {
//     res.json({});
// });

// app.get("/drinks", cors(), (req, res) => {
//     res.json({
//         drinks: DRINKS,
//     });
// });

function sendMessage(to: WebSocket, message: ClientMessage) {
    to.send(JSON.stringify(message));
}

async function handleSocketMessage(sender: WebSocket, message: ServerMessage) {
    switch (message.type) {
        case "get-drinks": {
            sendMessage(sender, {
                type: "drinks",
                drinks: DRINKS,
            });
            break;
        }
        case "get-all-gpio": {
            sendMessage(sender, {
                type: "all-gpio",
                relay: await machine.relay.getAllGpio(),
                relay24v: await machine.relay24v.getAllGpio(),
            });
            break;
        }
        case "set-all-gpio": {
            if (message.relay !== undefined) {
                await machine.relay.setAllGpio(message.relay);
            }
            if (message.relay24v !== undefined) {
                await machine.relay24v.setAllGpio(message.relay24v);
            }
            break;
        }
    }
}

async function main() {
    console.time(chalk.green("Start setup"));

    let bus = await i2c.openPromisified(6);
    machine = new CocktailMachine(bus);
    await machine.initialize();

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

    socketServer.on("connection", (ws, req) => {
        console.log("New connection", req.socket.remoteAddress);

        ws.on("message", async (data, _) => {
            try {
                const message = JSON.parse(data.toString()) as ServerMessage;
                await handleSocketMessage(ws, message);
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

    machine.relay.on("set", (gpio: number) => {
        socketServer.clients.forEach((c) => {
            sendMessage(c, { type: "all-gpio", relay: gpio });
        });
    });

    machine.relay24v.on("set", (gpio: number) => {
        socketServer.clients.forEach((c) => {
            sendMessage(c, { type: "all-gpio", relay24v: gpio });
        });
    });

    console.timeEnd(chalk.green("Start setup"));
}

main();
