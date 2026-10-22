import { requireUser } from "../_shared/auth.ts";
import { HttpError, serveJson } from "../_shared/http.ts";

/**
 * Permanently deletes the caller's account. See the account_deletion
 * migration for what is removed and what stays with each bar.
 */
serveJson("delete-account", async (req) => {
  const caller = await requireUser(req);
  const userId = caller.user.id;

  const { error: prepareError } = await caller.admin.rpc("prepare_account_deletion", { p_user_id: userId });
  if (prepareError) {
    // Raised on purpose, e.g. "Make someone else an admin of <bar> ...".
    if (prepareError.code === "P0001") throw new HttpError(409, prepareError.message);
    throw prepareError;
  }

  // Avatars and Tell us photos live under <bucket>/<user id>/. A page at a
  // time until the folder is empty. Before the Tell us migration has run there
  // is no feedback bucket, and nothing in it to remove.
  for (const bucket of ["avatars", "feedback"]) {
    const files = caller.admin.storage.from(bucket);
    while (true) {
      const { data, error: listError } = await files.list(userId, { limit: 100 });
      if (listError) {
        if (bucket === "feedback" && /not found/i.test(listError.message)) break;
        throw listError;
      }
      // Files only (a folder entry has no id); stop when a page removes nothing.
      const paths = data.filter((file) => file.id).map((file) => `${userId}/${file.name}`);
      if (paths.length === 0) break;
      const { data: removed, error: removeError } = await files.remove(paths);
      if (removeError) throw removeError;
      if (!removed?.length) break;
    }
  }

  const { error: deleteError } = await caller.admin.auth.admin.deleteUser(userId);
  if (deleteError) throw deleteError;

  return { deleted: true };
});
