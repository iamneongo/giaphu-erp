import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

import { getSql } from "../db/neon";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type Row = Record<string, unknown>;

type GlobalTelegramSchemaState = typeof globalThis & {
  __giaPhuTelegramSchemaReady?: boolean;
  __giaPhuTelegramDialogsCache?: Map<string, { expiresAt: number; dialogs: TelegramDialogDto[] }>;
};

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const TELEGRAM_DIALOGS_CACHE_TTL_MS = 15_000;

export const TELEGRAM_LOGIN_PENDING_COOKIE_NAME = "gp_telegram_login_pending";
export const TELEGRAM_LOGIN_PENDING_MAX_AGE = 600;

export function readCookieValue(request: Request, name: string): string {
  const header = request.headers.get("cookie") ?? "";
  return (
    header
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function getDialogsCache() {
  const state = globalThis as GlobalTelegramSchemaState;
  state.__giaPhuTelegramDialogsCache ??= new Map();
  return state.__giaPhuTelegramDialogsCache;
}

function requireOrganizationId(value: unknown) {
  const organizationId = text(value).trim();
  if (!organizationId) throw new Error("Thiếu tổ chức đang hoạt động.");
  return organizationId;
}

function requireClerkUserId(value: unknown) {
  const userId = text(value).trim();
  if (!userId) throw new Error("Thiếu người dùng đang đăng nhập.");
  return userId;
}

// --- Encryption helpers (session strings + pending-login cookie payload) ---

function getEncryptionKey(): Buffer {
  const raw = process.env.TELEGRAM_SESSION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Missing TELEGRAM_SESSION_ENCRYPTION_KEY. Add a 32-byte base64 key to .env.local.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TELEGRAM_SESSION_ENCRYPTION_KEY must decode to exactly 32 bytes (base64).");
  }
  return key;
}

function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // base64url (no +, /, =) so the token survives untouched as a cookie value and in URLs.
  return [iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptSecret(encoded: string): string {
  const [ivPart, tagPart, dataPart] = text(encoded).split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid encrypted payload.");
  }
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
  return plaintext.toString("utf8");
}

export function encryptTelegramSession(sessionString: string) {
  return encryptSecret(sessionString);
}

export function decryptTelegramSession(encoded: string) {
  return decryptSecret(encoded);
}

export type PendingTelegramLogin = {
  step: "code" | "password";
  partialSession: string;
  phoneNumber: string;
  phoneCodeHash: string;
  clerkUserId: string;
  organizationId: string;
  createdAt: number;
};

export function encryptPendingLogin(payload: PendingTelegramLogin) {
  return encryptSecret(JSON.stringify(payload));
}

export function decryptPendingLogin(token: string): PendingTelegramLogin {
  return JSON.parse(decryptSecret(token)) as PendingTelegramLogin;
}

function isPendingLoginExpired(pending: PendingTelegramLogin) {
  return Date.now() - pending.createdAt > TELEGRAM_LOGIN_PENDING_MAX_AGE * 1000;
}

// --- Schema ---

export async function ensureTelegramSchema() {
  const state = globalThis as GlobalTelegramSchemaState;
  if (state.__giaPhuTelegramSchemaReady) return;

  const sql = getSql();
  await sql`create table if not exists gp_telegram_accounts (
    id bigserial primary key,
    organization_id text not null default '',
    clerk_user_id text not null,
    encrypted_session text not null default '',
    phone_number text not null default '',
    telegram_user_id text not null default '',
    display_name text not null default '',
    username text not null default '',
    status text not null default 'disconnected',
    connected_at timestamptz,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
  )`;
  await sql`create unique index if not exists gp_telegram_accounts_org_user_idx
    on gp_telegram_accounts (organization_id, clerk_user_id)`;

  await sql`create table if not exists gp_telegram_pending_logins (
    id bigserial primary key,
    organization_id text not null default '',
    clerk_user_id text not null,
    encrypted_payload text not null default '',
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
  )`;
  await sql`create unique index if not exists gp_telegram_pending_logins_org_user_idx
    on gp_telegram_pending_logins (organization_id, clerk_user_id)`;

  state.__giaPhuTelegramSchemaReady = true;
}

// --- Data access ---

export type TelegramAccountStatus = "connected" | "disconnected" | "password_needed";

export type TelegramAccountRow = {
  organizationId: string;
  clerkUserId: string;
  encryptedSession: string;
  phoneNumber: string;
  telegramUserId: string;
  displayName: string;
  username: string;
  status: TelegramAccountStatus;
  connectedAt: string;
};

function telegramAccountFromRow(row: Row): TelegramAccountRow {
  return {
    organizationId: text(row.organization_id),
    clerkUserId: text(row.clerk_user_id),
    encryptedSession: text(row.encrypted_session),
    phoneNumber: text(row.phone_number),
    telegramUserId: text(row.telegram_user_id),
    displayName: text(row.display_name),
    username: text(row.username),
    status: (text(row.status) || "disconnected") as TelegramAccountStatus,
    connectedAt: row.connected_at ? new Date(row.connected_at as string).toISOString() : "",
  };
}

export async function getTelegramAccount(
  organizationId: unknown,
  clerkUserId: unknown,
): Promise<TelegramAccountRow | null> {
  await ensureTelegramSchema();
  const sql = getSql();
  const orgId = requireOrganizationId(organizationId);
  const userId = requireClerkUserId(clerkUserId);
  const rows = (await sql`
    select * from gp_telegram_accounts
    where organization_id = ${orgId} and clerk_user_id = ${userId}
    limit 1
  `) as Row[];
  const row = rows[0];
  return row ? telegramAccountFromRow(row) : null;
}

export async function saveTelegramAccount(
  organizationId: unknown,
  clerkUserId: unknown,
  fields: {
    encryptedSession: string;
    phoneNumber?: string;
    telegramUserId?: string;
    displayName?: string;
    username?: string;
    status: TelegramAccountStatus;
  },
) {
  await ensureTelegramSchema();
  const sql = getSql();
  const orgId = requireOrganizationId(organizationId);
  const userId = requireClerkUserId(clerkUserId);
  const connectedAt = fields.status === "connected" ? new Date() : null;

  await sql`
    insert into gp_telegram_accounts (
      organization_id, clerk_user_id, encrypted_session, phone_number,
      telegram_user_id, display_name, username, status, connected_at, updated_at
    )
    values (
      ${orgId}, ${userId}, ${fields.encryptedSession}, ${fields.phoneNumber ?? ""},
      ${fields.telegramUserId ?? ""}, ${fields.displayName ?? ""}, ${fields.username ?? ""},
      ${fields.status}, ${connectedAt}, now()
    )
    on conflict (organization_id, clerk_user_id) do update set
      encrypted_session = excluded.encrypted_session,
      phone_number = excluded.phone_number,
      telegram_user_id = excluded.telegram_user_id,
      display_name = excluded.display_name,
      username = excluded.username,
      status = excluded.status,
      connected_at = case when excluded.status = 'connected' then now() else gp_telegram_accounts.connected_at end,
      updated_at = now()
  `;
}

export async function clearTelegramAccount(organizationId: unknown, clerkUserId: unknown) {
  await ensureTelegramSchema();
  const sql = getSql();
  const orgId = requireOrganizationId(organizationId);
  const userId = requireClerkUserId(clerkUserId);
  await sql`
    update gp_telegram_accounts
    set encrypted_session = '', status = 'disconnected', connected_at = null, updated_at = now()
    where organization_id = ${orgId} and clerk_user_id = ${userId}
  `;
}

export async function savePendingTelegramLogin(organizationId: unknown, clerkUserId: unknown, pending: PendingTelegramLogin) {
  await ensureTelegramSchema();
  const sql = getSql();
  const orgId = requireOrganizationId(organizationId);
  const userId = requireClerkUserId(clerkUserId);
  const encryptedPayload = encryptPendingLogin(pending);

  await sql`
    insert into gp_telegram_pending_logins (organization_id, clerk_user_id, encrypted_payload, updated_at)
    values (${orgId}, ${userId}, ${encryptedPayload}, now())
    on conflict (organization_id, clerk_user_id) do update set
      encrypted_payload = excluded.encrypted_payload,
      updated_at = now()
  `;
}

export async function getPendingTelegramLogin(
  organizationId: unknown,
  clerkUserId: unknown,
): Promise<PendingTelegramLogin | null> {
  await ensureTelegramSchema();
  const sql = getSql();
  const orgId = requireOrganizationId(organizationId);
  const userId = requireClerkUserId(clerkUserId);
  const rows = (await sql`
    select encrypted_payload from gp_telegram_pending_logins
    where organization_id = ${orgId} and clerk_user_id = ${userId}
    limit 1
  `) as Row[];
  const row = rows[0];
  if (!row) return null;

  try {
    const pending = decryptPendingLogin(text(row.encrypted_payload));
    if (isPendingLoginExpired(pending)) {
      await clearPendingTelegramLogin(orgId, userId);
      return null;
    }
    return pending;
  } catch {
    await clearPendingTelegramLogin(orgId, userId);
    return null;
  }
}

export async function clearPendingTelegramLogin(organizationId: unknown, clerkUserId: unknown) {
  await ensureTelegramSchema();
  const sql = getSql();
  const orgId = requireOrganizationId(organizationId);
  const userId = requireClerkUserId(clerkUserId);
  await sql`
    delete from gp_telegram_pending_logins
    where organization_id = ${orgId} and clerk_user_id = ${userId}
  `;
}

// --- GramJS client lifecycle ---

function requireApiCredentials() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = text(process.env.TELEGRAM_API_HASH).trim();
  if (!apiId || Number.isNaN(apiId) || !apiHash) {
    throw new Error(
      "Missing TELEGRAM_API_ID/TELEGRAM_API_HASH. Add your my.telegram.org app credentials to .env.local.",
    );
  }
  return { apiId, apiHash };
}

export function createGramClient(sessionString: string) {
  const { apiId, apiHash } = requireApiCredentials();
  return new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 2,
  });
}

async function withTelegramClient<T>(
  sessionString: string,
  callback: (client: TelegramClient) => Promise<T>,
): Promise<T> {
  const client = createGramClient(sessionString);
  try {
    await client.connect();
    return await callback(client);
  } finally {
    await client.disconnect();
  }
}

async function withStoredTelegramClient<T>(
  encryptedSession: string,
  callback: (client: TelegramClient) => Promise<T>,
): Promise<T> {
  return withTelegramClient(decryptTelegramSession(encryptedSession), callback);
}

async function finalizeTelegramSession(client: TelegramClient) {
  const me = await client.getMe();
  const fullSession = (client.session as StringSession).save();
  const displayName = [me.firstName ?? "", me.lastName ?? ""].filter(Boolean).join(" ").trim() || text(me.username);

  return {
    encryptedSession: encryptTelegramSession(fullSession),
    telegramUserId: text(me.id?.toString?.() ?? me.id),
    displayName,
    username: text(me.username ?? ""),
  };
}

// --- Login flow (phone -> code -> optional 2FA password) ---

export async function initiateTelegramLogin(phoneNumber: string) {
  const { apiId, apiHash } = requireApiCredentials();
  const client = createGramClient("");
  try {
    await client.connect();
    const result = await client.sendCode({ apiId, apiHash }, phoneNumber);
    return {
      partialSession: (client.session as StringSession).save(),
      phoneCodeHash: result.phoneCodeHash,
    };
  } finally {
    await client.disconnect();
  }
}

export async function completeTelegramCodeSignIn(pending: PendingTelegramLogin, code: string) {
  const client = createGramClient(pending.partialSession);
  try {
    await client.connect();
    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: pending.phoneNumber,
          phoneCodeHash: pending.phoneCodeHash,
          phoneCode: code,
        }),
      );
    } catch (error) {
      if (isSessionPasswordNeeded(error)) {
        return {
          status: "password_needed" as const,
          partialSession: (client.session as StringSession).save(),
        };
      }
      throw error;
    }

    const finalized = await finalizeTelegramSession(client);
    return { status: "connected" as const, ...finalized };
  } finally {
    await client.disconnect();
  }
}

export async function completeTelegramPasswordSignIn(pending: PendingTelegramLogin, password: string) {
  const { apiId, apiHash } = requireApiCredentials();
  const client = createGramClient(pending.partialSession);
  let capturedError: unknown;
  try {
    await client.connect();
    try {
      await client.signInWithPassword(
        { apiId, apiHash },
        {
          password: async () => password,
          onError: async (err) => {
            capturedError = err;
            return true;
          },
        },
      );
    } catch (error) {
      throw capturedError ?? error;
    }

    const finalized = await finalizeTelegramSession(client);
    return { status: "connected" as const, ...finalized };
  } finally {
    await client.disconnect();
  }
}

export async function logoutTelegramSession(encryptedSession: string) {
  if (!encryptedSession) return;
  try {
    await withStoredTelegramClient(encryptedSession, async (client) => {
      await client.invoke(new Api.auth.LogOut());
    });
  } catch (error) {
    console.error("Telegram logout failed (best-effort)", error);
  }
}

// --- Dialogs & messages (view + quick reply) ---

export type TelegramDialogDto = {
  id: string;
  title: string;
  isGroup: boolean;
  isChannel: boolean;
  unreadCount: number;
  avatarUrl: string;
  topicId?: number;
  parentDialogId?: string;
  lastMessage: { text: string; date: string; outgoing: boolean } | null;
};

export type TelegramMessageDto = {
  id: number;
  text: string;
  date: string;
  outgoing: boolean;
  senderName: string;
};

function senderDisplayName(sender: unknown): string {
  if (!sender || typeof sender !== "object") return "";
  const entity = sender as { firstName?: string; lastName?: string; title?: string; username?: string };
  const fullName = [entity.firstName, entity.lastName].filter(Boolean).join(" ").trim();
  return fullName || entity.title || entity.username || "";
}

async function resolveDialogEntity(client: TelegramClient, dialogId: string) {
  const dialogs = await client.getDialogs({ limit: 250 });
  const match = dialogs.find((dialog) => dialog.id?.toString() === dialogId);
  if (!match) throw new Error("Không tìm thấy cuộc trò chuyện này.");
  return match.entity ?? match.inputEntity;
}

async function resolveDialog(client: TelegramClient, dialogId: string) {
  const dialogs = await client.getDialogs({ limit: 250 });
  const match = dialogs.find((dialog) => dialog.id?.toString() === dialogId);
  if (!match) throw new Error("KhÃ´ng tÃ¬m tháº¥y cuá»™c trÃ² chuyá»‡n nÃ y.");
  return match;
}

export async function listTelegramDialogs(encryptedSession: string, limit = 100): Promise<TelegramDialogDto[]> {
  const cacheKey = `${encryptedSession}:${limit}`;
  const cache = getDialogsCache();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.dialogs;
  }

  return withStoredTelegramClient(encryptedSession, async (client) => {
    const dialogs = await client.getDialogs({ limit });
    const serialized = dialogs.map((dialog) => ({
      id: text(dialog.id?.toString?.() ?? dialog.id),
      title: text(dialog.title ?? senderDisplayName(dialog.entity) ?? "") || "(Khong co ten)",
      isGroup: Boolean(dialog.isGroup),
      isChannel: Boolean(dialog.isChannel),
      unreadCount: Number(dialog.unreadCount ?? 0),
      avatarUrl: "",
      lastMessage: dialog.message
        ? {
            text: text(dialog.message.message ?? ""),
            date: dialog.message.date ? new Date(dialog.message.date * 1000).toISOString() : "",
            outgoing: Boolean(dialog.message.out),
          }
        : null,
    }));

    cache.set(cacheKey, { dialogs: serialized, expiresAt: Date.now() + TELEGRAM_DIALOGS_CACHE_TTL_MS });
    return serialized;
  });
}

export async function listTelegramTopics(
  encryptedSession: string,
  dialogId: string,
  limit = 50,
): Promise<TelegramDialogDto[]> {
  return withStoredTelegramClient(encryptedSession, async (client) => {
    const dialog = await resolveDialog(client, dialogId);
    const entity = dialog.entity ?? dialog.inputEntity;

    let forumTopics: Api.messages.ForumTopics;
    try {
      forumTopics = await client.invoke(
        new Api.channels.GetForumTopics({
          channel: entity,
          offsetDate: 0,
          offsetId: 0,
          offsetTopic: 0,
          limit,
        }),
      );
    } catch (error) {
      if (isTelegramTopicsUnavailable(error)) {
        return [];
      }
      throw error;
    }

    const messageById = new Map(
      forumTopics.messages
        .filter((message): message is Api.Message => message instanceof Api.Message)
        .map((message) => [Number(message.id), message]),
    );

    return forumTopics.topics
      .filter((topic): topic is Api.ForumTopic => topic instanceof Api.ForumTopic)
      .filter((topic) => !topic.hidden)
      .map((topic) => {
        const message = messageById.get(Number(topic.topMessage));
        return {
          id: `${dialogId}:${Number(topic.id)}`,
          title: text(topic.title ?? "") || (Number(topic.id) === 1 ? "General" : "Topic"),
          isGroup: true,
          isChannel: false,
          unreadCount: Number(topic.unreadCount ?? 0),
          avatarUrl: "",
          topicId: Number(topic.id),
          parentDialogId: dialogId,
          lastMessage: message
            ? {
                text: text(message.message ?? ""),
                date: message.date ? new Date(message.date * 1000).toISOString() : "",
                outgoing: Boolean(message.out),
              }
            : null,
        };
      });
  });
}

export async function downloadDialogAvatar(encryptedSession: string, dialogId: string): Promise<Buffer | null> {
  return withStoredTelegramClient(encryptedSession, async (client) => {
    const entity = await resolveDialogEntity(client, dialogId);
    const result = await client.downloadProfilePhoto(entity, { isBig: false });
    if (!result || typeof result === "string" || result.length === 0) {
      return null;
    }
    return result;
  });
}

export async function listTelegramMessages(
  encryptedSession: string,
  dialogId: string,
  topicId?: number,
  limit = 30,
): Promise<TelegramMessageDto[]> {
  return withStoredTelegramClient(encryptedSession, async (client) => {
    const entity = await resolveDialogEntity(client, dialogId);
    const messages = await client.getMessages(entity, topicId ? { limit, replyTo: topicId } : { limit });
    return messages
      .slice()
      .reverse()
      .map((message) => ({
        id: Number(message.id),
        text: text(message.message ?? ""),
        date: message.date ? new Date(message.date * 1000).toISOString() : "",
        outgoing: Boolean(message.out),
        senderName: senderDisplayName(message.sender),
      }));
  });
}

export async function sendTelegramMessage(
  encryptedSession: string,
  dialogId: string,
  messageText: string,
  topicId?: number,
): Promise<TelegramMessageDto> {
  return withStoredTelegramClient(encryptedSession, async (client) => {
    const entity = await resolveDialogEntity(client, dialogId);
    const sent = await client.sendMessage(entity, topicId ? { message: messageText, topMsgId: topicId } : { message: messageText });
    return {
      id: Number(sent.id),
      text: text(sent.message ?? messageText),
      date: sent.date ? new Date(sent.date * 1000).toISOString() : new Date().toISOString(),
      outgoing: true,
      senderName: "",
    };
  });
}

// --- Error translation ---

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "errorMessage" in (error as Record<string, unknown>)) {
    return text((error as { errorMessage?: unknown }).errorMessage);
  }
  return error instanceof Error ? error.message : text(error);
}

export function isSessionPasswordNeeded(error: unknown) {
  return errorCode(error).includes("SESSION_PASSWORD_NEEDED");
}

function isTelegramTopicsUnavailable(error: unknown) {
  const code = errorCode(error);
  return (
    code.includes("CHANNEL_FORUM_MISSING") ||
    code.includes("CHANNEL_INVALID") ||
    code.includes("CHAT_ID_INVALID") ||
    code.includes("TOPIC_DELETED")
  );
}

export function telegramErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code.includes("PHONE_NUMBER_INVALID")) return "Số điện thoại không hợp lệ.";
  if (code.includes("PHONE_NUMBER_BANNED")) return "Số điện thoại này đã bị Telegram khóa.";
  if (code.includes("PHONE_CODE_INVALID")) return "Mã xác thực không đúng.";
  if (code.includes("PHONE_CODE_EXPIRED")) return "Mã xác thực đã hết hạn, vui lòng gửi lại mã.";
  if (code.includes("PASSWORD_HASH_INVALID")) return "Mật khẩu 2 lớp (2FA) không đúng.";

  const floodMatch = code.match(/FLOOD_WAIT_(\d+)/);
  if (floodMatch) return `Telegram yêu cầu chờ ${floodMatch[1]} giây trước khi thử lại.`;

  return "Có lỗi xảy ra khi kết nối Telegram. Vui lòng thử lại.";
}
