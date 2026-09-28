import { initBotId } from "botid/client/core";
import { installFeedbackConsoleCapture } from "@/lib/feedback/client-environment";

installFeedbackConsoleCapture();
initBotId({
  protect: [
    { path: "/signup", method: "POST" },
    { path: "/forgot-password", method: "POST" },
    { path: "/signin", method: "POST" },
    { path: "/verify-email", method: "POST" },
  ],
});
