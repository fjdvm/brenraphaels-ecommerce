import { careersSession } from "./auth";
import { createGatewayInbox, type Gateway } from "../notifications/gateway-inbox";

async function applicantInbox(gateway: Gateway) {
  const applicant = await careersSession();
  if (!applicant) throw new Error("Please sign in to read your Notifications.");
  const callerKey = gateway.callerKey ?? process.env.CAREERS_API_GATEWAY_CALLER_KEY;
  // Never fall back to the storefront Caller: Careers is a separate App.
  if (!callerKey) throw new Error("CAREERS_API_GATEWAY_CALLER_KEY must be set.");
  return { userId: applicant.userId, inbox: createGatewayInbox("careers", { ...gateway, callerKey }) };
}

/** Stored Notifications for the signed-in Applicant, newest first. No recipient id is accepted from the browser. */
export async function listApplicantInbox(gateway: Gateway = {}) {
  const { userId, inbox } = await applicantInbox(gateway);
  return inbox.listInbox(userId);
}

export async function unreadApplicantInboxCount(gateway: Gateway = {}) {
  const { userId, inbox } = await applicantInbox(gateway);
  return inbox.unreadInboxCount(userId);
}

export async function markApplicantInboxRead(id: string, gateway: Gateway = {}) {
  const { userId, inbox } = await applicantInbox(gateway);
  return inbox.markInboxRead(userId, id);
}

export async function markAllApplicantInboxRead(gateway: Gateway = {}) {
  const { userId, inbox } = await applicantInbox(gateway);
  return inbox.markAllInboxRead(userId);
}
