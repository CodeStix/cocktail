export const SERVER_URL = "";
export const SERVER_WS_URL = "ws://192.168.0.55:8000/socket";

export const fetcher = (str: string) => fetch(str).then((e) => e.json());

export async function fetchJson<T = unknown>(relativeUrl: string, method: string, body?: any): Promise<T> {
    let res;
    if (body) {
        res = await fetch(SERVER_URL + relativeUrl, {
            method: method,
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json",
            },
        });
    } else {
        res = await fetch(SERVER_URL + relativeUrl, {
            method: method,
        });
    }

    if (!res.ok) {
        console.error("Failed request " + method + " " + relativeUrl, body);
        throw new Error("Request failed " + method + " " + relativeUrl);
    }

    return await res.json();
}
