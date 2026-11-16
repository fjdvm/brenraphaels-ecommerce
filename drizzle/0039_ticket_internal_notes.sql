ALTER TABLE "ticket_messages" ADD COLUMN "internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD COLUMN "author_name" text;--> statement-breakpoint
-- An Internal note is Staff-only: it never notifies the Customer.
CREATE OR REPLACE FUNCTION public.record_customer_ticket_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.sender = 'staff' AND NOT NEW.internal THEN
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
