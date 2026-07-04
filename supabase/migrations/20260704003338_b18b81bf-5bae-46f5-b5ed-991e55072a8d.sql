
revoke execute on function public.handle_new_user() from public, authenticated, anon;
revoke execute on function public.send_money(text, numeric, text) from public;
revoke execute on function public.top_up(numeric) from public;
