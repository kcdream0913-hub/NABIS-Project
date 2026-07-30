// Shared E2E topology constants. The hub seeds three verified pilot accounts and
// two DM threads directly in prod; the values below are stable identifiers, NOT
// secrets (thread ids are not sensitive — access is gated by RLS, not obscurity).
// Account A's credentials (E2E_EMAIL / E2E_PASSWORD) and the foreign path
// (E2E_FOREIGN_ATTACHMENT_PATH) come from env/secrets and are NEVER committed.

// The hub-seeded A<->B thread. Account A is a participant. Every authenticated
// attachment flow drives this thread (no thread is created at runtime), and the
// teardown scopes its cleanup to it.
export const THREAD_AB = "9e53b15d-9266-424c-9803-9becbca829b1";

// Private DM-attachment bucket. Object path = {thread_id}/{uploader_id}/{name}.
export const ATTACHMENT_BUCKET = "message-attachments";

// Post-media bucket (feed images/video + posters). Object path = {uploader_id}/{name}.
export const POST_MEDIA_BUCKET = "post-media";
