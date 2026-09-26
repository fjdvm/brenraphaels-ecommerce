/** Asks every YouTube embed under `root` to pause; embeds opt in with `enablejsapi=1`. */
export function pauseYouTubeVideos(root: ParentNode) {
  const command = JSON.stringify({
    event: "command",
    func: "pauseVideo",
    args: [],
  });
  root
    .querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube-nocookie.com"]')
    .forEach((frame) => {
      frame.contentWindow?.postMessage(
        command,
        "https://www.youtube-nocookie.com",
      );
    });
}
