"use client";

import { Image as ImageIcon, Loader2, SendHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";

import { connectLive } from "./live-socket";
import { sendMessage } from "@/app/(site)/(protected)/support/actions";
import {
  formatClock,
  formatDayAndClock,
} from "@/lib/notifications/relative-time";
import type { TicketMessage } from "@/lib/support/tickets";
import type { ConnectLive, LiveConnection } from "@/lib/support/live";
import { validateTicketAttachment } from "@/lib/support/ticket-attachment";
import { ticketMessageInput } from "@/lib/support/ticket-message";
import { cn } from "@/lib/utils";

type OptimisticMessage = TicketMessage & {
  pending?: boolean;
  previewUrl?: string;
};

const quickReplies = [
  "Thank you!",
  "When will it be ready?",
  "Can I change to pickup?",
];

const reconnectMilliseconds = 3_000;

/**
 * Renders a Ticket's thread, appends Customer Messages before the server responds, and shows Staff replies
 * and Messages sent from the Customer's other tabs live. The saved thread is the source of truth: live
 * Messages are matched to it by id, and a relay that fails loses nothing.
 */
export function TicketThread({
  ticketId,
  createdAt,
  completed = false,
  messages: savedMessages,
  connect = connectLive,
}: {
  ticketId: number;
  createdAt: Date;
  completed?: boolean;
  messages: TicketMessage[];
  connect?: ConnectLive;
}) {
  const router = useRouter();
  const [liveMessages, setLiveMessages] = useState<TicketMessage[]>([]);
  const messages = useMemo(() => {
    const savedIds = new Set(savedMessages.map((saved) => saved.id));
    return [
      ...savedMessages,
      ...liveMessages
        .filter((live) => !savedIds.has(live.id))
        .sort((a, b) => a.id - b.id),
    ];
  }, [savedMessages, liveMessages]);

  const line = useRef<LiveConnection | null>(null);
  const refresh = useRef(router.refresh);
  useEffect(() => {
    refresh.current = router.refresh;
  });

  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let wasDown = false;

    const open = () => {
      line.current = connect(ticketId, {
        // Anything relayed while the line was down is gone, so a reconnect reloads the saved thread.
        onOpen: () => {
          if (wasDown) refresh.current();
          wasDown = false;
        },
        onEvent: (event) => {
          if (event.type !== "message") return;
          const id = Number(event.id);
          if (!Number.isInteger(id)) return;
          const live: TicketMessage = {
            id,
            sender: event.from.role === "Staff" ? "staff" : "customer",
            body: event.text,
            attachmentPathname: null,
            fileId: null,
            createdAt: new Date(event.sentAt),
          };
          setLiveMessages((current) =>
            current.some((existing) => existing.id === live.id)
              ? current
              : [...current, live],
          );
          // The header status and the Close/Reopen control come from the saved Ticket.
          refresh.current();
        },
        onClose: () => {
          line.current = null;
          wasDown = true;
          if (!stopped) retry = setTimeout(open, reconnectMilliseconds);
        },
      });
    };

    open();
    return () => {
      stopped = true;
      clearTimeout(retry);
      line.current?.close();
      line.current = null;
    };
  }, [ticketId, connect]);

  const formRef = useRef<HTMLFormElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string>();
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<{ file: File; url: string }>();
  const image = picked?.file;
  const imagePreview = picked?.url;
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  // The preview address is made when the file is picked, not in an effect, so it survives Strict Mode remounts.
  const setImage = (file: File | undefined) =>
    setPicked((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return file ? { file, url: URL.createObjectURL(file) } : undefined;
    });
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<
    OptimisticMessage[],
    OptimisticMessage
  >(messages, (currentMessages, optimisticMessage) => [
    ...currentMessages,
    optimisticMessage,
  ]);

  // Keep the newest Message in view as the thread grows.
  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [optimisticMessages.length]);

  async function submit(formData: FormData) {
    // One Message at a time: a second click or Enter while one is on its way does nothing.
    if (sendingRef.current) return;
    const parsed = ticketMessageInput.safeParse({ body: formData.get("body") });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message);
      return;
    }

    const attachment = formData.get("attachment");
    const hasAttachment =
      attachment instanceof File &&
      (attachment.size > 0 || attachment.name !== "");
    if (hasAttachment) {
      try {
        validateTicketAttachment(attachment);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "We couldn't use that image.",
        );
        return;
      }
    }

    setMessage(undefined);
    sendingRef.current = true;
    setSending(true);
    addOptimisticMessage({
      id: -Date.now(),
      sender: "customer",
      body: parsed.data.body,
      attachmentPathname: null,
      fileId: null,
      createdAt: new Date(),
      pending: true,
      previewUrl: hasAttachment ? imagePreview : undefined,
    });
    let state: Awaited<ReturnType<typeof sendMessage>>;
    try {
      state = await sendMessage(ticketId, {}, formData);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
    if (state.message) setMessage(state.message);
    const fieldError =
      state.fieldErrors?.body?.[0] ?? state.fieldErrors?.attachment?.[0];
    if (fieldError) setMessage(fieldError);
    // Keep the Customer's text in the form when the server rejected the Message.
    if (state.sent) {
      // Saved first; a line that is down loses nothing, the Staff member sees it on reload.
      try {
        if (state.messageId !== undefined)
          line.current?.send({
            type: "message",
            id: String(state.messageId),
            text: parsed.data.body,
          });
      } catch (error) {
        console.error("Message saved but could not be relayed live", error);
      }
      formRef.current?.reset();
      setDraft("");
      setImage(undefined);
    }
  }

  const firstStaffId = optimisticMessages.find(
    (entry) => entry.sender === "staff",
  )?.id;

  return (
    <>
      <div
        className="max-h-[60vh] min-h-0 flex-1 overflow-y-auto bg-background lg:max-h-none"
        ref={threadRef}
      >
        <ol
          aria-label="Message thread"
          className="flex min-h-full flex-col justify-end gap-[18px] px-5 py-7 sm:px-8"
        >
          <li className="flex justify-center">
            <p className="rounded-full bg-surface-soft px-3.5 py-1.5 text-xs tracking-[0.35px] text-muted">
              Ticket opened · {formatDayAndClock(createdAt)}
            </p>
          </li>
          {optimisticMessages.map((threadMessage) => {
            const mine = threadMessage.sender === "customer";
            return (
              <Fragment key={threadMessage.id}>
                {threadMessage.id === firstStaffId ? (
                  <li className="flex justify-center">
                    <p className="rounded-full bg-surface-soft px-3.5 py-1.5 text-xs tracking-[0.35px] text-muted">
                      Customer Care joined the conversation
                    </p>
                  </li>
                ) : null}
                <li
                  className={cn(
                    "flex gap-3",
                    mine ? "justify-end" : "items-end",
                    threadMessage.pending && "opacity-60",
                  )}
                >
                  {mine ? null : (
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lavender text-[13px] font-medium tracking-[0.35px] text-primary"
                    >
                      CC
                    </span>
                  )}
                  <div
                    className={cn(
                      "flex min-w-0 max-w-[560px] flex-col gap-1.5",
                      mine ? "items-end" : "items-start",
                    )}
                  >
                    {mine ? null : (
                      <p className="flex items-center gap-2 text-[13px] font-medium leading-[1.4] tracking-[0.35px] text-ink">
                        Customer Care
                        <span className="rounded-full bg-primary px-3 py-1 text-xs text-white">
                          Staff
                        </span>
                      </p>
                    )}
                    <div
                      className={cn(
                        "whitespace-pre-wrap break-words px-[18px] py-3 text-base leading-[1.6] tracking-[0.35px]",
                        mine
                          ? "rounded-[20px] rounded-br-[6px] bg-primary text-white"
                          : "rounded-[20px] rounded-bl-[6px] border border-line bg-white text-ink",
                      )}
                    >
                      {threadMessage.body}
                      {threadMessage.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local preview of the file being sent
                        <img
                          alt="Being sent with this Message"
                          className="mt-2 max-h-80 rounded-[20px]"
                          src={threadMessage.previewUrl}
                        />
                      ) : threadMessage.attachmentPathname ||
                        threadMessage.fileId ? (
                        // eslint-disable-next-line @next/next/no-img-element -- streamed from an authenticated route, not optimizable
                        <img
                          alt="Attached to this Message"
                          className="mt-2 max-h-80 rounded-[20px]"
                          src={`/api/support/attachments/${threadMessage.id}`}
                        />
                      ) : null}
                    </div>
                    <time
                      className="text-xs tracking-[0.35px] text-muted"
                      dateTime={threadMessage.createdAt.toISOString()}
                    >
                      {formatClock(threadMessage.createdAt)}
                    </time>
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>
      {completed ? (
        <div className="flex shrink-0 flex-col gap-2 border-t border-line bg-white px-6 py-5">
          <p className="text-sm tracking-[0.35px] text-ink">
            This Ticket is completed, so it can&apos;t be reopened or replied
            to.
          </p>
          <Link
            className="w-fit text-sm font-medium text-primary hover:underline"
            href="/support/new"
          >
            Need more help? Open a new Ticket
          </Link>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-2.5 border-t border-line bg-white px-6 pb-5 pt-4">
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                className="rounded-full border border-line px-3.5 py-1.5 text-xs tracking-[0.35px] text-primary transition-colors hover:bg-lavender-soft"
                key={reply}
                onClick={() => setDraft(reply)}
                type="button"
              >
                {reply}
              </button>
            ))}
          </div>
          <form action={submit} className="flex flex-col gap-2.5" ref={formRef}>
            <div className="flex flex-col gap-2 rounded-[28px] bg-surface-soft p-2">
              {image && imagePreview ? (
                <div className="flex px-1 pt-1">
                  <div className="relative size-16">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file */}
                    <img
                      alt={`Selected image: ${image.name}`}
                      className={cn(
                        "size-16 rounded-xl object-cover",
                        sending && "opacity-50",
                      )}
                      src={imagePreview}
                    />
                    {sending ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Loader2
                          aria-hidden
                          className="size-5 animate-spin text-primary"
                        />
                      </span>
                    ) : (
                      <button
                        aria-label={`Remove ${image.name}`}
                        className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-white text-ink shadow"
                        onClick={() => {
                          setImage(undefined);
                          if (picker.current) picker.current.value = "";
                        }}
                        type="button"
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <label
                  className={cn(
                    "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-primary transition-colors hover:bg-lavender-soft focus-within:ring-2 focus-within:ring-ring",
                    sending && "pointer-events-none opacity-50",
                  )}
                  htmlFor="ticket-reply-attachment"
                  title="Attach an image (JPEG or PNG up to 5 MB)"
                >
                  <ImageIcon
                    aria-hidden
                    className="size-[18px]"
                    strokeWidth={1.5}
                  />
                  <span className="sr-only">
                    Attach an image (JPEG or PNG up to 5 MB)
                  </span>
                </label>
                <input
                  accept="image/jpeg,image/png"
                  className="sr-only"
                  disabled={sending}
                  id="ticket-reply-attachment"
                  name="attachment"
                  onChange={(event) => {
                    // Cancelling the file dialog sends no file; keep the one already picked.
                    const file = event.target.files?.[0];
                    if (file) setImage(file);
                  }}
                  ref={picker}
                  type="file"
                />
                <label className="min-w-0 flex-1" htmlFor="ticket-reply">
                  <span className="sr-only">Write a message</span>
                  <textarea
                    className="block max-h-32 min-h-[26px] w-full resize-none bg-transparent px-1 py-0.5 text-base leading-[1.6] tracking-[0.35px] text-ink outline-none placeholder:text-muted"
                    id="ticket-reply"
                    maxLength={2_000}
                    name="body"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        formRef.current?.requestSubmit();
                      }
                    }}
                    placeholder="Write a message…"
                    required
                    rows={1}
                    value={draft}
                  />
                </label>
                <button
                  aria-label={sending ? "Sending message" : "Send message"}
                  aria-busy={sending}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={sending}
                  type="submit"
                >
                  {sending ? (
                    <Loader2
                      aria-hidden
                      className="size-5 animate-spin"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <SendHorizontal
                      aria-hidden
                      className="size-5"
                      strokeWidth={1.5}
                    />
                  )}
                </button>
              </div>
            </div>
            {message ? (
              <p className="px-2 text-sm text-red-700" role="alert">
                {message}
              </p>
            ) : null}
          </form>
          <p className="text-xs tracking-[0.35px] text-muted">
            Images: JPEG or PNG up to 5 MB · Our team replies Mon–Sat, 9:00am –
            6:00pm
          </p>
        </div>
      )}
    </>
  );
}
