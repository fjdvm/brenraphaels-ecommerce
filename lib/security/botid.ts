import { checkBotId } from "botid/server";

export const botIdFailureMessage = "Please try again from your browser.";

export async function hasValidBotIdCheck() {
  return !(await checkBotId()).isBot;
}
