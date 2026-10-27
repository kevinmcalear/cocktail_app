#!/usr/bin/env bash
# Sets Resend's API key as a Supabase function secret on the linked project,
# then deploys the functions that send email. Kevin runs this once (and again
# to rotate the key):
#
#   npm run email:setup
#
# It opens Resend's API keys page, waits while you create a key (Sending
# access, domain babyvom.it) and copy it, then reads it from the clipboard.
# The key is never printed, never passed on a command line, and the clipboard
# is cleared afterwards. Needs the Supabase CLI linked to the project
# (`supabase link`); run it from that checkout.
set -euo pipefail
cd "$(dirname "$0")/.."

# The functions that email people through _shared/resend.ts.
FUNCTIONS=(send-bar-invite venue-delete-email)

ref_file=supabase/.temp/project-ref
if [[ ! -s $ref_file ]]; then
  echo "This checkout isn't linked to a Supabase project. Run \`supabase link\` here, or run this from your main checkout." >&2
  exit 1
fi
ref=$(<"$ref_file")

open "https://resend.com/api-keys"
echo "Resend's API keys page is open. Create a key with Sending access for babyvom.it, copy it,"
read -r -p "then press Return here. " _

key=$(pbpaste | tr -d '[:space:]')
if [[ ! $key =~ ^re_[A-Za-z0-9_]+$ ]]; then
  echo "The clipboard doesn't hold a Resend key (they start with re_). Copy it and run this again." >&2
  exit 1
fi

# An env file only this user can read, gone when the script ends.
env_file=$(mktemp)
trap 'rm -f "$env_file"' EXIT
chmod 600 "$env_file"
printf 'RESEND_API_KEY=%s\n' "$key" >"$env_file"
unset key
pbcopy </dev/null

supabase secrets set --project-ref "$ref" --env-file "$env_file" >/dev/null
echo "RESEND_API_KEY is set on the project."

for fn in "${FUNCTIONS[@]}"; do
  supabase functions deploy "$fn" --project-ref "$ref"
done
echo "Done: ${FUNCTIONS[*]} now send from invites@babyvom.it through Resend."
