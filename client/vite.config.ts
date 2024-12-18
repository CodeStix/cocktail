import { defineConfig, ProxyOptions } from "vite";
import react from "@vitejs/plugin-react-swc";

const proxyConfig: ProxyOptions = {
    target: "http://192.168.0.55:8000",
    changeOrigin: true,
    secure: false,
    ws: true,
    configure: (proxy, _options) => {
        proxy.on("error", (err, _req, _res) => {
            console.log("Proxy error", err);
        });
        proxy.on("proxyReq", (_proxyReq, req, _res) => {
            console.log("Sending Request to the Target:", req.method, req.url);
        });
        proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log("Received Response from the Target:", proxyRes.statusCode, req.url);
        });
    },
};

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            "/uploads": proxyConfig,
            "/api": proxyConfig,
            "/socket": proxyConfig,
        },
    },
});
