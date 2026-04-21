import axios from "axios";

/** 默认 API 根（与 paper_app `API_BASE_URL` 用法一致，可用 `updateApiBaseUrl` 切换）。 */
export const API_BASE_URL = "http://106.53.14.250:3000/api";
export const API_ORIGIN = new URL(API_BASE_URL).origin;

/** 由 initialActions 创建动作组时的默认名称。 */
export const DEFAULT_UPLOAD_GROUP_NAME = "Magos 本地示例动作组";

/**
 * 统一 JSON 请求（对齐 paper_app `requestJson`：打日志、合并鉴权头；返回与原先 fetch 版一致的结构）。
 * @param {{ url: string, method?: string, data?: unknown, header?: Record<string, string> }} options
 * @returns {Promise<{ statusCode: number, data: unknown, ok: boolean, response: import("axios").AxiosResponse }>}
 */
export const requestJson = (options) =>
  new Promise((resolve, reject) => {
    const { url, method = "GET", data } = options;

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      // ...authHeader,
      ...(options.header || {}),
    };

    axios({
      url,
      method,
      data:
        method === "GET" ? undefined : data,
      headers,
      timeout: 15000,
      validateStatus: () => true,
      transformResponse: [
        (raw) => {
          if (raw == null || raw === "") return null;
          if (typeof raw !== "string") return raw;
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        },
      ],
    })
      .then((res) => {
        const statusCode = res.status;
        const parsed = res.data;
        console.log("[api] response", {
          url,
          statusCode,
          data: parsed,
        });
        resolve({
          statusCode,
          data: parsed,
          ok: statusCode >= 200 && statusCode < 300,
          response: res,
        });
      })
      .catch((err) => {
        console.log("[api] error", { url, err });
        reject(err);
      });
  });

export const postJson = (path, data) =>
  requestJson({
    url: `${API_BASE_URL}${path}`,
    method: "POST",
    data,
  });

export const getJson = (path) =>
  requestJson({
    url: `${API_BASE_URL}${path}`,
    method: "GET",
  });

export const putJson = (path, data) =>
  requestJson({
    url: `${API_BASE_URL}${path}`,
    method: "PUT",
    data,
  });

export const deleteJson = (path, data) =>
  requestJson({
    url: `${API_BASE_URL}${path}`,
    method: "DELETE",
    data,
  });

export const patchJson = (path, data) =>
  requestJson({
    url: `${API_BASE_URL}${path}`,
    method: "PATCH",
    data,
  });
