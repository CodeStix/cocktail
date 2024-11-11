import express from "express";
import { ClientMessage, Drink, ServerMessage } from "cocktail-shared";
import cors from "cors";
import ws from "ws";
import { WebSocket } from "ws";
import chalk from "chalk";
import { PinMode, PullUpDownMode, pinMode, pullUpDnControl } from "tinker-gpio";
import { CocktailMachine } from ".";
import i2c from "i2c-bus";
import fs from "fs";
import { OutputFunction, getFunctionForRelayIdx, getRelayIdxForFunction, setRelayFunction } from "./output";

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

async function sendAllGpioMessage(sender: WebSocket, values: boolean[]) {
    sendMessage(sender, {
        type: "all-gpio",
        values: values.map((value, idx) => ({
            value: value,
            function: OutputFunction[getFunctionForRelayIdx(idx)],
        })),
    });
}

async function handleSocketMessage(sender: WebSocket, message: ServerMessage) {
    console.log("Received", message);
    switch (message.type) {
        case "get-drinks": {
            sendMessage(sender, {
                type: "drinks",
                drinks: DRINKS,
            });
            break;
        }
        case "get-all-gpio": {
            sendAllGpioMessage(sender, await machine.relays.getAllGpio());
            break;
        }
        case "set-gpio": {
            await machine.relays.setGpio(message.index, message.value);
            break;
        }
        case "get-all-gpio-functions": {
            sendMessage(sender, {
                type: "all-gpio-functions",
                values: Object.keys(OutputFunction).filter((e) => isNaN(Number(e))),
            });
            break;
        }
        case "set-gpio-function": {
            setRelayFunction(OutputFunction[message.function as keyof typeof OutputFunction], message.index);
            sendAllGpioMessage(sender, await machine.relays.getAllGpio());
            break;
        }
        default: {
            console.warn(chalk.yellow("Unhandled message"), message);
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

    machine.relays.on("set", (values: boolean[]) => {
        socketServer.clients.forEach((c) => {
            sendAllGpioMessage(c, values);
        });
    });

    console.timeEnd(chalk.green("Start setup"));
}

main();
