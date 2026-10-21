-- The database role CREOMS labels Feedback as. For the owner to run once, by hand, against the shared Neon database
-- (nothing in this repo runs it), after migration 0017. It reads Feedback, writes only its three Sentiment columns,
-- and adds to and updates the Feedback analysis run record. It cannot change the Feedback itself.
-- Replace the password placeholder before running; never commit the real one.

CREATE ROLE creoms_feedback LOGIN PASSWORD 'REPLACE_WITH_A_STRONG_PASSWORD';

REVOKE ALL ON SCHEMA public FROM creoms_feedback;
GRANT USAGE ON SCHEMA public TO creoms_feedback;

GRANT SELECT ON TABLE order_feedback TO creoms_feedback;
GRANT UPDATE (sentiment, sentiment_model, sentiment_analyzed_at) ON TABLE order_feedback TO creoms_feedback;

GRANT SELECT, INSERT, UPDATE ON TABLE feedback_analysis_runs TO creoms_feedback;
-- feedback_analysis_runs uses an identity column, so inserting needs its sequence.
GRANT USAGE, SELECT ON SEQUENCE feedback_analysis_runs_id_seq TO creoms_feedback;

-- CREOMS's pages read Sentiment and "Last analyzed" as the read-only role.
GRANT SELECT ON TABLE feedback_analysis_runs TO creoms_readonly;
