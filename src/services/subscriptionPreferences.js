const STORAGE_KEY = "core-observatory-subscription-preferences-v1";

export const moduleCatalog = [
  {
    id: "payments",
    name: "Servicio de Pagos",
    code: "svc.core.payments",
    events: ["PaymentRequested", "PaymentAuthorized", "PaymentRejected", "PaymentCaptured", "PaymentRefunded"],
  },
  {
    id: "orders",
    name: "Gestión de Pedidos",
    code: "svc.core.orders",
    events: ["OrderCreated", "OrderConfirmed", "OrderBilled", "OrderCancelled", "OrderCompleted"],
  },
  {
    id: "billing",
    name: "Facturación",
    code: "svc.core.billing",
    events: ["InvoiceRequested", "InvoiceGenerated", "InvoiceIssued", "InvoiceCancelled", "CreditNoteGenerated"],
  },
  {
    id: "authorization",
    name: "Autorización",
    code: "svc.core.authorization",
    events: ["AuthorizationRequested", "AuthorizationGranted", "AuthorizationRejected", "AuthorizationRevoked", "AuthorizationExpired"],
  },
  {
    id: "ledger",
    name: "Ledger",
    code: "svc.core.ledger",
    events: ["LedgerEntryRequested", "LedgerEntryRecorded", "LedgerEntryRejected", "BalanceUpdated", "SettlementRecorded"],
  },
  {
    id: "notifications",
    name: "Notificaciones",
    code: "svc.core.notifications",
    events: ["NotificationRequested", "NotificationQueued", "NotificationSent", "NotificationFailed", "NotificationDelivered"],
  },
];

export const eventKey = (moduleId, eventName) => `${moduleId}::${eventName}`;

const emptyPreferences = () => ({ moduleIds: [], eventKeys: [] });

const validModuleIds = new Set(moduleCatalog.map((module) => module.id));
const validEventKeys = new Set(
  moduleCatalog.flatMap((module) => module.events.map((eventName) => eventKey(module.id, eventName))),
);

function storage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function normalize(preferences) {
  const moduleIds = Array.isArray(preferences?.moduleIds)
    ? [...new Set(preferences.moduleIds)].filter((id) => validModuleIds.has(id))
    : [];

  const allowedEventKeys = new Set(
    moduleCatalog
      .filter((module) => moduleIds.includes(module.id))
      .flatMap((module) => module.events.map((eventName) => eventKey(module.id, eventName))),
  );

  const eventKeys = Array.isArray(preferences?.eventKeys)
    ? [...new Set(preferences.eventKeys)].filter(
        (key) => validEventKeys.has(key) && allowedEventKeys.has(key),
      )
    : [];

  return { moduleIds, eventKeys };
}

function persist(preferences) {
  const next = normalize(preferences);
  const target = storage();
  if (target) target.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getSubscriptionPreferences() {
  const target = storage();
  if (!target) return emptyPreferences();

  try {
    const raw = target.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : emptyPreferences();
  } catch {
    target.removeItem(STORAGE_KEY);
    return emptyPreferences();
  }
}

export function saveSelectedModules(moduleIds) {
  const current = getSubscriptionPreferences();
  return persist({ moduleIds, eventKeys: current.eventKeys });
}

export function saveSelectedEvents(eventKeys) {
  const current = getSubscriptionPreferences();
  return persist({ moduleIds: current.moduleIds, eventKeys });
}
