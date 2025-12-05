const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const USER_HASH = process.env.REACT_APP_USER_HASH;

export const apiHeaders = {
  "Content-Type": "application/json",
  "x-user-hash": USER_HASH,  // REQUIRED BY BACKEND
};

export async function apiGet(path) {
  return fetch(`${BACKEND_URL}${path}`, {
    headers: apiHeaders
  });
}

export async function apiPost(path, body) {
  return fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify(body)
  });
}

export async function apiDelete(path) {
  return fetch(`${BACKEND_URL}${path}`, {
    method: "DELETE",
    headers: apiHeaders
  });
}

export async function apiPut(path, body) {
  return fetch(`${BACKEND_URL}${path}`, {
    method: "PUT",
    headers: apiHeaders,
    body: JSON.stringify(body)
  });
}
