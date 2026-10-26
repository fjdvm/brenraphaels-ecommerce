ALTER TABLE "customer_notifications" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
-- CREOMS writes Staff Messages directly using its restricted writer role.
-- Run as the migration owner so that role needs no outbox privileges.
CREATE FUNCTION public.record_customer_ticket_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.sender = 'staff' THEN
    INSERT INTO public.customer_notifications
      (idempotency_key, order_id, customer_id, type, title, body, link)
    SELECT 'ticket.reply:' || NEW.id, t.order_id, t.customer_id, 'ticket.reply',
      'New reply on Ticket TKT-' || t.id,
      'Staff replied to your Ticket: ' || t.subject,
      '/support/' || t.id
    FROM public.tickets t WHERE t.id = NEW.ticket_id
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER customer_ticket_reply_notification
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.record_customer_ticket_reply();
