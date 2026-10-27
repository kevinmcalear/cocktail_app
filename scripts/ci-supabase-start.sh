#!/usr/bin/env bash
# `supabase start` for CI, tried up to six times over about five minutes. The security shards and the
# snapshot job start together and each pulls about ten images from ghcr.io at
# once, and GitHub's registry answers the burst with "toomanyrequests" (asking
# for a retry a millisecond later) while the CLI gives up on the first refusal.
# A retry pulls only what's still missing, and each try gets a few more. Uses
# $SUPABASE_EXCLUDE from the job. The shards also cache the images (ci.yml).
set -u
for try in 1 2 3 4 5 6; do
  supabase start -x "$SUPABASE_EXCLUDE" && exit 0
  [ "$try" = 6 ] && exit 1
  echo "supabase start failed (try $try of 6), trying again in $((try * 20))s"
  sleep $((try * 20))
done
