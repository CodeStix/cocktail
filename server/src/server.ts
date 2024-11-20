import express from "express";
import { ClientMessage, ServerMessage, Ingredient, DispenseSequence, recipeToDispenseSequence, Recipe } from "cocktail-shared";
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
    createRecipe,
    decrementIngredientRemainingAmount,
    deleteIngredient,
    deleteRecipe,
    getAllOutputs,
    getIngredient,
    getIngredients,
    getOutputById,
    getRecipe,
    getRecipes,
    insertDefaultOutputsIfNone,
    updateIngredient,
    updateOutput,
    updateRecipe,
} from "./db";
import { json } from "body-parser";
import multer from "multer";
import path from "path";
import sharp from "sharp";
import { execSync, spawn } from "child_process";
import exitHook from "async-exit-hook";

let machine: CocktailMachine;

const app = express();
const port = 8000;

const PUBLIC_FOLDER_PATH = path.join(__dirname, "..", "public");
const UPLOADS_FOLDER_PATH = path.join(PUBLIC_FOLDER_PATH, "uploads");

function reopenChromium() {
    // Kill all previous instances if any
    try {
        execSync("killall chromium-bin", {});
    } catch {}
    // chromium --kiosk --force-device-scale-factor=1.5 http://192.168.0.55:8000/
    spawn("chromium", ["--kiosk", "--force-device-scale-factor=1.5", "http://localhost:8000/"], {
        detached: true,
        env: {
            ...process.env,
            DISPLAY: ":0",
        },
    });
}

const upload = multer({
    dest: UPLOADS_FOLDER_PATH,
});

app.use(cors());

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

app.get("/api/recipes", json(), async (req, res) => {
    res.json(await getRecipes(req.query.all === "1"));
});

app.get("/api/recipes/:id", json(), async (req, res) => {
    res.json(await getRecipe(parseInt(req.params.id)));
});

app.patch("/api/recipes/:id", json(), async (req, res) => {
    res.json(await updateRecipe(parseInt(req.params.id), req.body));
});

app.post("/api/recipes/:id/dispense", json(), async (req, res) => {
    const id = parseInt(req.params.id);

    const recipe = await getRecipe(id);
    if (!recipe) {
        res.status(404).end();
        return;
    }

    const body = req.body as {
        // holdToDispense?: boolean;
        recipeOverride?: Partial<Recipe>;
    };

    const adjRecipe: Recipe = {
        ...recipe,
        ...body.recipeOverride,
    };

    const limitPartMl = adjRecipe.holdToDispense ? 50 : undefined;
    const dispenseSequence = recipeToDispenseSequence(adjRecipe, limitPartMl);

    console.log("data.dispenseSequence", dispenseSequence);

    machine.executeCommand({
        type: "prepare-dispense",
        dispenseSequence: dispenseSequence,
        holdToDispense: adjRecipe.holdToDispense,
    });
    res.json({});
});

app.delete("/api/recipes/:id/dispense", json(), async (req, res) => {
    machine.executeCommand({
        type: "stop-dispense",
    });
    res.json({});
});

app.post("/api/recipes", json(), async (req, res) => {
    res.json(await createRecipe());
});

app.delete("/api/recipes/:id", json(), async (req, res) => {
    await deleteRecipe(parseInt(req.params.id));
    res.json({});
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

app.get("/api/ingredients/:id", json(), async (req, res) => {
    res.json(await getIngredient(parseInt(req.params.id)));
});

app.post("/api/ingredients", json(), async (req, res) => {
    res.json(await createIngredient());
});

app.patch("/api/ingredients/:id", json(), async (req, res) => {
    res.json(await updateIngredient(parseInt(req.params.id), req.body));
});

app.delete("/api/ingredients/:id", json(), async (req, res) => {
    res.json({ deleted: await deleteIngredient(parseInt(req.params.id)) });
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
    const filePath = req.file!.path;

    const ext = path.extname(req.file!.originalname);
    const targetFilePath = filePath + ext;

    await sharp(filePath).resize(200).toFile(targetFilePath);

    fs.renameSync(filePath, filePath + "-original" + ext);

    console.log("Uploaded to", targetFilePath);
    res.json({ url: "/uploads/" + req.file!.filename + ext });
});

app.post("/api/clean", json(), async (req, res) => {
    machine.executeCommand({
        type: "full-clean",
        thoroughly: typeof req.body.thoroughly === "boolean" ? req.body.thoroughly : true,
    });
    res.json({});
});

app.post("/api/restart", json(), async (req, res) => {
    reopenChromium();
    res.json({});
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
        // case "get-drinks": {
        //     sendMessage(sender, {
        //         type: "drinks",
        //         drinks: DRINKS,
        //     });
        //     break;
        // }
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
    machine = new CocktailMachine(bus, getIngredient, getAllOutputs);
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

    machine.on("dispense-progress", (data: { progress?: number; status: "dispensing" | "done" | "waiting" }) => {
        socketServer.clients.forEach(async (c) => {
            sendMessage(c, {
                type: "dispense-progress",
                status: data.status,
                progress: data.progress,
            });
        });
    });

    machine.on("state-change", async (data: { from: string; to: string }) => {
        socketServer.clients.forEach(async (c) => {
            sendMessage(c, {
                type: "state-change",
                from: data.from,
                to: data.to,
            });
        });

        if (data.to === "AFTER_DISPENSE") {
            const sequence = machine.getDispenseSequence();
            console.log("Update in database", sequence);

            for (const part of sequence) {
                for (const ingr of part.ingredients) {
                    console.log("Decrement", ingr.ingredientId, ingr.startingMl - ingr.remainingMl);
                    await decrementIngredientRemainingAmount(ingr.ingredientId, ingr.startingMl - ingr.remainingMl);
                }
            }
        }
    });

    machine.on("pressure-measurement", (pressure: number) => {
        socketServer.clients.forEach(async (c) => {
            sendMessage(c, {
                type: "pressure-measurement",
                pressure: pressure,
            });
        });
    });

    await insertDefaultOutputsIfNone();

    console.timeEnd(chalk.green("Start setup"));

    reopenChromium();
}

exitHook.uncaughtExceptionHandler((err, callback) => {
    console.log("Uncaught exception", err);
    machine.relays
        .clearAll()
        .catch(() => console.error("Could not clear relays on exit"))
        .then(() => console.log("Cleared all relays on exit"))
        .finally(callback);
});

exitHook.unhandledRejectionHandler((err, callback) => {
    console.log("Uncaught rejection", err);
    machine.relays
        .clearAll()
        .catch(() => console.error("Could not clear relays on exit"))
        .then(() => console.log("Cleared all relays on exit"))
        .finally(callback);
});

exitHook((callback) => {
    console.log("Exit handler");
    machine.relays
        .clearAll()
        .catch(() => console.error("Could not clear relays on exit"))
        .then(() => console.log("Cleared all relays on exit"))
        .finally(callback);
});

main();
