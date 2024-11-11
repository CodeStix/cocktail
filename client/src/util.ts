export const SERVER_URL = "http://192.168.0.55:8000";

export const fetcher = (str: string) => fetch(str).then((e) => e.json());
