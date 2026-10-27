#!/usr/bin/env bash
# `supabase start` for CI, tried up to four times. The security shards and the
# snapshot job start together and each pulls about ten images from ghcr.io at
# once, and GitHub's registry answers the burst with "toomanyrequests" (asking
# for a retry a millisecond later) while the CLI gives up on the first refusal.
# A retry pulls only what's still missing. Uses $SUPABASE_EXCLUDE from the job.
set -u
for try in 1 2 3 4; do
  supabase start -x "$SUPABASE_EXCLUDE" && exit 0
  [ "$try" = 4 ] && exit 1
  echo "supabase start failed (try $try of 4), trying again in $((try * 15))s"
  sleep $((try * 15))
done
