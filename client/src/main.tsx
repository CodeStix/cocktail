import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import "./index.css";
import "@radix-ui/themes/styles.css";
import { FrontPage } from "./FrontPage.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DebugPage } from "./DebugPage.tsx";
import { Layout } from "./components/Layout.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme accentColor="gray" radius="large" appearance="dark">
            <BrowserRouter>
                <Layout>
                    <Routes>
                        <Route path="/" Component={FrontPage} />
                        <Route path="/debug" Component={DebugPage} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </Theme>
    </StrictMode>
);
