import { api } from "./api";

// Passkeys (WebAuthn): the browser asks the device (fingerprint, face, PIN) for a signature; the server only keeps the public key.
export const b64e = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const b64d = (s) => { let t = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; return Uint8Array.from(atob(t), (c) => c.charCodeAt(0)).buffer; };
// a passkey belongs to a domain name: on an IP address (10.x.x.x) the browser refuses ("This is an invalid domain")
export const onIpAddress = () => typeof window !== "undefined" && (/^\d{1,3}(\.\d{1,3}){3}$/.test(window.location.hostname) || window.location.hostname.includes(":"));
export const passkeysSupported = () => typeof window !== "undefined" && !!window.PublicKeyCredential && !!window.isSecureContext && !!navigator.credentials && !onIpAddress();

// Log in with a passkey of this device (or a phone nearby). Returns the answer of the server ({token, user}).
export async function loginWithPasskey() {
  const { state, options } = await api("/auth/passkey/login/options/", { method: "POST", body: {} });
  const cred = await navigator.credentials.get({ publicKey: { ...options, challenge: b64d(options.challenge), allowCredentials: [] } });
  return api("/auth/passkey/login/", { method: "POST", body: { state, id: cred.id, response: {
    clientDataJSON: b64e(cred.response.clientDataJSON), authenticatorData: b64e(cred.response.authenticatorData), signature: b64e(cred.response.signature),
  } } });
}

// Add a passkey to the account of the person who is logged in.
export async function addPasskey(name) {
  const { state, options } = await api("/auth/passkey/register/options/", { method: "POST", body: {} });
  const cred = await navigator.credentials.create({ publicKey: {
    ...options, challenge: b64d(options.challenge), user: { ...options.user, id: b64d(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((c) => ({ type: c.type, id: b64d(c.id) })),
  } });
  return api("/auth/passkey/register/", { method: "POST", body: { state, id: cred.id, name, transports: cred.response.getTransports ? cred.response.getTransports() : [], response: {
    clientDataJSON: b64e(cred.response.clientDataJSON), attestationObject: b64e(cred.response.attestationObject),
  } } });
}
