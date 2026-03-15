const apiFromEnv = import.meta.env.VITE_API_URL;
const wsFromEnv = import.meta.env.VITE_WS_URL;

const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000`;
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const defaultWsBase = `${wsProtocol}//${window.location.hostname}:8000`;

export const API_BASE_URL = (apiFromEnv || defaultApiBase).replace(/\/$/, "");
export const WS_BASE_URL = (wsFromEnv || defaultWsBase).replace(/\/$/, "");
