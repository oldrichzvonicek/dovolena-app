-- Triggerové funkce z 20261013010000 nemají být volatelné přes /rest/v1/rpc (Supabase security advisor: anon i authenticated).
-- Trigger se spouští i bez EXECUTE pro volajícího.
revoke execute on function public.notify_on_account_approved() from public, anon, authenticated;
revoke execute on function public.notify_on_request_withdrawn() from public, anon, authenticated;
