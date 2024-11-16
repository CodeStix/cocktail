import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import "./index.css";
import "@radix-ui/themes/styles.css";
import { RecipesPage } from "./RecipesPage.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DebugPage } from "./DebugPage.tsx";
import { Layout } from "./components/Layout.tsx";
import { InventoryPage } from "./InventoryPage.tsx";
import { EditRecipePage } from "./EditRecipePage.tsx";
import { EditRecipesPage } from "./EditRecipesPage.tsx";
import { EditIngredientPage } from "./EditIngredient.tsx";
import "react-simple-keyboard/build/css/index.css";

// Copy to server using
// scp -r dist/* linaro@192.168.0.55:~/cocktail/cocktail2/server/public

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme accentColor="gray" radius="medium" appearance="dark" scaling="110%">
            <BrowserRouter>
                <Layout>
                    <Routes>
                        <Route path="/" Component={RecipesPage} />
                        <Route path="/debug" Component={DebugPage} />
                        <Route path="/inventory" Component={InventoryPage} />
                        <Route path="/recipe" Component={EditRecipesPage} />
                        <Route path="/recipe/:id" Component={EditRecipePage} />
                        <Route path="/ingredients/:id" Component={EditIngredientPage} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </Theme>
    </StrictMode>
);
