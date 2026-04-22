/**
 * @file LocalizationAPI.js
 *
 * 本地化相关 API 请求封装（精简版）：
 * 仅提供 `getJson`、`postJson` 两个方法。
 */
import axios from "axios";

/** 本地化服务 API 根路径（按需替换为实际服务地址）。 */
export const LOCALIZATION_API_BASE_URL = "http://127.0.0.1:5500";

/**
 * 统一 JSON 请求封装，返回结构与 `API.js` 保持一致。
 * @param {{ url: string, method?: string, data?: unknown, header?: Record<string, string> }} options
 * @returns {Promise<{ statusCode: number, data: unknown, ok: boolean, response: import("axios").AxiosResponse }>}
 */
const requestJson = (options) =>
  new Promise((resolve, reject) => {
    const { url, method = "GET", data } = options;

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.header || {}),
    };

    axios({
      url,
      method,
      data: method === "GET" ? undefined : data,
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
        resolve({
          statusCode,
          data: parsed,
          ok: statusCode >= 200 && statusCode < 300,
          response: res,
        });
      })
      .catch((err) => {
        reject(err);
      });
  });

/** GET JSON */
export const getJson = (path) =>
  requestJson({
    url: `${LOCALIZATION_API_BASE_URL}${path}`,
    method: "GET",
  });

/** POST JSON */
export const postJson = (path, data) =>
  requestJson({
    url: `${LOCALIZATION_API_BASE_URL}${path}`,
    method: "POST",
    data,
  });

