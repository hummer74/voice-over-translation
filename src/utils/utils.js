import { localizationProvider } from "../localization/localizationProvider.js";
import debug from "./debug.js";

const userlang = navigator.language || navigator.userLanguage;
export const lang = userlang?.substr(0, 2)?.toLowerCase() ?? "en";

function secsToStrTime(secs) {
  const minutes = Math.floor(secs / 60);
  const seconds = Math.floor(secs % 60);
  if (minutes >= 60) {
    return localizationProvider.get("translationTakeMoreThanHour");
  } else if (minutes === 1 || (minutes === 0 && seconds > 0)) {
    return localizationProvider.get("translationTakeAboutMinute");
  } else if (minutes !== 11 && minutes % 10 === 1) {
    return localizationProvider
      .get("translationTakeApproximatelyMinute2")
      .replace("{0}", minutes);
  } else if (
    ![12, 13, 14].includes(minutes) &&
    [2, 3, 4].includes(minutes % 10)
  ) {
    return localizationProvider
      .get("translationTakeApproximatelyMinute")
      .replace("{0}", minutes);
  }

  return localizationProvider
    .get("translationTakeApproximatelyMinutes")
    .replace("{0}", minutes);
}

function langTo6391(lang) {
  // convert lang to ISO 639-1
  return lang.toLowerCase().split(/[_;-]/)[0].trim();
}

function isPiPAvailable() {
  return (
    "pictureInPictureEnabled" in document && document.pictureInPictureEnabled
  );
}

function initHls() {
  return typeof Hls != "undefined" && Hls?.isSupported()
    ? new Hls({
        debug: DEBUG_MODE, // turn it on manually if necessary
        lowLatencyMode: true,
        backBufferLength: 90,
      })
    : undefined;
}

function initAudioContext() {
  const audioContext = window.AudioContext || window.webkitAudioContext;
  return audioContext ? new audioContext() : undefined;
}

const deletefilter = [
  /(?:https?|ftp):\/\/\S+/g,
  /https?:\/\/\S+|www\.\S+/gm,
  /\b\S+\.\S+/gm,
  /#[^\s#]+/g,
  /Auto-generated by YouTube/g,
  /Provided to YouTube by/g,
  /Released on/g,
  /0x[a-fA-F0-9]{40}/g,
  /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/g,
  /4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}/g,
  /Paypal/g,
];

const combinedRegex = new RegExp(
  deletefilter.map((regex) => regex.source).join("|"),
);

function cleanText(title, description) {
  const cleanedDescription = description
    ? description
        .split("\n")
        .filter((line) => !combinedRegex.test(line))
        .join(" ")
    : "";

  const fullText = `${title} ${cleanedDescription}`.slice(0, 450);
  return fullText.replace(/[^\p{L}\s]+|\s+/gu, " ").trim();
}

async function GM_fetch(url, opts = {}) {
  const { timeout = 15000, ...fetchOptions } = opts;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    if (url.includes("api.browser.yandex.ru")) {
      throw new Error("Preventing yandex cors");
    }

    const response = await fetch(url, {
      signal: controller.signal,
      ...fetchOptions,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    // Если fetch завершился ошибкой, используем GM_xmlhttpRequest
    // https://greasyfork.org/ru/scripts/421384-gm-fetch/code
    debug.log("GM_fetch preventing cors by GM_xmlhttpRequest", err.message);
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      GM_xmlhttpRequest({
        method: fetchOptions.method || "GET",
        url: url,
        responseType: "blob",
        ...fetchOptions,
        data: fetchOptions.body,
        timeout: timeout,
        onload: (resp) => {
          // chrome \n and ":", firefox \r\n and ": " (Only in GM_xmlhttpRequest)
          // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/getAllResponseHeaders#examples
          const headers = Object.fromEntries(
            resp.responseHeaders
              .trim()
              .split(/\r?\n/)
              .map((line) => line.split(/: (.+)/))
              .filter(([key]) => key && /^[\w-]+$/.test(key)),
          );

          resolve(
            new Response(resp.response, {
              status: resp.status,
              headers: headers,
            }),
          );
        },
        ontimeout: () => reject(new Error("Timeout")),
        onerror: (error) => reject(error),
        onabort: () => reject(new Error("AbortError")),
      });
    });
  }
}

export {
  secsToStrTime,
  langTo6391,
  isPiPAvailable,
  initHls,
  initAudioContext,
  cleanText,
  GM_fetch,
};
