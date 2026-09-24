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

  // Avatars live under avatars/<user id>/.
  const avatars = caller.admin.storage.from("avatars");
  const { data: files, error: listError } = await avatars.list(userId);
  if (listError) throw listError;
  if (files.length > 0) {
    const { error: removeError } = await avatars.remove(files.map((file) => `${userId}/${file.name}`));
    if (removeError) throw removeError;
  }

  const { error: deleteError } = await caller.admin.auth.admin.deleteUser(userId);
  if (deleteError) throw deleteError;

  return { deleted: true };
});
