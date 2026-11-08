// Loads the official YouTube IFrame Player API once, so we can read the current
// time of the video, pause it, and jump back to a moment ("rewind").
let apiPromise = null;

export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => {
        apiPromise = null;
        reject(new Error("YouTube could not be loaded"));
      };
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}
