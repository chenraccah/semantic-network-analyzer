-- Set user to pro tier by ID
INSERT INTO user_profiles (id, tier, analyses_today, analyses_reset_date, chat_messages_month, chat_reset_date)
VALUES ('5173e569-9526-4457-96ac-7ebf4e451a00', 'pro', 0, CURRENT_DATE, 0, DATE_TRUNC('month', CURRENT_DATE)::DATE)
ON CONFLICT (id) DO UPDATE SET tier = 'pro';
