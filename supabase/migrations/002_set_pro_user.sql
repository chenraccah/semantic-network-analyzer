-- Set chenraccah@gmail.com to pro tier
INSERT INTO user_profiles (id, tier, analyses_today, analyses_reset_date, chat_messages_month, chat_reset_date)
SELECT id, 'pro', 0, CURRENT_DATE, 0, DATE_TRUNC('month', CURRENT_DATE)::DATE
FROM auth.users
WHERE email = 'chenraccah@gmail.com'
ON CONFLICT (id) DO UPDATE SET tier = 'pro';
