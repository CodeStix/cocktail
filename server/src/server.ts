import express from "express";
import { ClientMessage, Drink, ServerMessage, Ingredient } from "cocktail-shared";
import cors from "cors";
import ws from "ws";
import { WebSocket } from "ws";
import chalk from "chalk";
import { PinMode, PullUpDownMode, pinMode, pullUpDnControl } from "tinker-gpio";
import { CocktailMachine } from ".";
import i2c from "i2c-bus";
import fs from "fs";
import {
    createIngredient,
    deleteIngredient,
    getAllOutputs,
    getIngredients,
    getOutputById,
    insertDefaultOutputsIfNone,
    updateIngredient,
    updateOutput,
} from "./db";
import { json } from "body-parser";
import multer from "multer";
import path from "path";

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

const PUBLIC_FOLDER_PATH = path.join(__dirname, "..", "public");
const UPLOADS_FOLDER_PATH = path.join(PUBLIC_FOLDER_PATH, "upload");

// chromium --kiosk --force-device-scale-factor=1.5 http://192.168.0.55:8000/

const upload = multer({
    dest: UPLOADS_FOLDER_PATH,
});

app.use(cors());

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

app.get("/api/drinks", cors(), (req, res) => {
    res.json({
        drinks: DRINKS,
    });
});

async function getOutputsWithState() {
    const outputs = await getAllOutputs();
    for (const output of outputs) {
        output.enabled = await machine.relays.getGpio(output.index);
    }
    return outputs;
}

app.get("/api/outputs", json(), async (req, res) => {
    res.json(await getOutputsWithState());
});

app.post("/api/outputs/:id/enabled", json(), async (req, res) => {
    const id = parseInt(req.params.id);
    const enabled = req.body.enabled;
    await machine.relays.setGpio((await getOutputById(id)).index, enabled);
    res.json({});
});

app.patch("/api/outputs/:id", json(), async (req, res) => {
    res.json(await updateOutput(parseInt(req.params.id), req.body));
});

app.get("/api/ingredients", json(), async (req, res) => {
    res.json(await getIngredients());
});

app.post("/api/ingredients", json(), async (req, res) => {
    res.json(await createIngredient());
});

app.patch("/api/ingredients/:id", json(), async (req, res) => {
    res.json(await updateIngredient(parseInt(req.params.id), req.body));
});

app.delete("/api/ingredients/:id", json(), async (req, res) => {
    await deleteIngredient(parseInt(req.params.id));
    res.json({});
});

app.post("/api/upload", upload.single("file"), (req, res) => {
    const filePath = req.file!.path;
    const ext = path.extname(req.file!.originalname);
    fs.renameSync(filePath, filePath + ext);
    console.log("Uploaded to", filePath);
    res.json({ url: "/uploads/" + req.file!.filename + ext });
});

app.use(express.static(PUBLIC_FOLDER_PATH));

function sendMessage(to: WebSocket, message: ClientMessage) {
    to.send(JSON.stringify(message));
}

// async function sendAllGpioMessage(sender: WebSocket, values: boolean[]) {
//     sendMessage(sender, {
//         type: "all-gpio",
//         values: values.map((value, idx) => ({
//             value: value,
//             function: OutputFunction[getFunctionForRelayIdx(idx)],
//         })),
//     });
// }

// async function sendAllOutputsMessage(sender: WebSocket) {
//     const outputs = await getAllOutputs();
//     for (const output of outputs) {
//         output.enabled = await machine.relays.getGpio(output.index);
//     }
//     sendMessage(sender, {
//         type: "all-outputs",
//         outputs,
//     });
// }

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
        // case "get-all-outputs": {
        //     await sendAllOutputsMessage(sender);
        //     break;
        // }
        // case "set-output-enabled": {
        //     await machine.relays.setGpio((await getOutputById(message.id)).index, message.enabled);
        //     break;
        // }
        // case "update-output": {
        //     await updateOutput(message.id, { index: message.index, name: message.name });
        //     await sendAllOutputsMessage(sender);
        //     break;
        // }
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
        socketServer.clients.forEach(async (c) => {
            sendMessage(c, {
                type: "all-outputs",
                outputs: await getOutputsWithState(),
            });
        });
    });

    await insertDefaultOutputsIfNone();

    console.timeEnd(chalk.green("Start setup"));
}

main();
