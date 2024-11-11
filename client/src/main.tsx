import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import "./index.css";
import "@radix-ui/themes/styles.css";
import App from "./App.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme accentColor="gray" radius="large" appearance="dark">
            <BrowserRouter>
                <Routes>
                    <Route path="/" Component={App} />
                </Routes>
            </BrowserRouter>
        </Theme>
    </StrictMode>
);
