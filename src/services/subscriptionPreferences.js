const STORAGE_KEY = "core-observatory-subscription-preferences-v1";

// Módulos y eventos publicados definidos en el TPO Municipalidad UADE.
export const moduleCatalog = [
  {
    id: "ciudadanos-expedientes",
    name: "Ciudadanos, organizaciones y expedientes digitales",
    code: "Módulo 1",
    events: [
      "CiudadanoRegistrado",
      "CiudadanoActualizado",
      "DomicilioActualizado",
      "OrganizacionRegistrada",
      "RepresentacionOtorgada",
      "RepresentacionVencida",
      "DocumentacionSolicitada",
    ],
  },
  {
    id: "atencion-ciudadana",
    name: "Atención ciudadana, reclamos y solicitudes",
    code: "Módulo 2",
    events: [
      "ReclamoCreado",
      "ReclamoClasificado",
      "ReclamoDuplicadoDetectado",
      "ReclamoDerivado",
      "ReclamoAsignado",
      "InformacionAdicionalSolicitada",
      "ReclamoEscalado",
      "ReclamoVencido",
      "ReclamoResuelto",
      "ReclamoCerrado",
      "ReclamoReabierto",
    ],
  },
  {
    id: "obras-publicas",
    name: "Obras públicas, infraestructura y mantenimiento urbano",
    code: "Módulo 3",
    events: [
      "ProyectoObraCreado",
      "ObraAprobada",
      "ObraIniciada",
      "ObraSuspendida",
      "AvanceObraRegistrado",
      "ObraFinalizada",
      "OrdenTrabajoCreada",
      "OrdenTrabajoAsignada",
      "OrdenTrabajoIniciada",
      "OrdenTrabajoDemorada",
      "OrdenTrabajoFinalizada",
      "CorteCalleSolicitado",
    ],
  },
  {
    id: "habilitaciones",
    name: "Habilitaciones, inspecciones y control comercial",
    code: "Módulo 4",
    events: [
      "SolicitudHabilitacionIniciada",
      "DocumentacionHabilitacionObservada",
      "InspeccionProgramada",
      "InspeccionRealizada",
      "InspeccionDesfavorable",
      "HabilitacionProvisoriaOtorgada",
      "HabilitacionAprobada",
      "HabilitacionRechazada",
      "HabilitacionSuspendida",
      "HabilitacionVencida",
      "ClausuraDispuesta",
      "ClausuraLevantada",
      "TasaHabilitacionGenerada",
      "MultaComercialGenerada",
    ],
  },
  {
    id: "rentas",
    name: "Rentas, tributos, deudas y planes de pago",
    code: "Módulo 5",
    events: [
      "LiquidacionGenerada",
      "BoletaEmitida",
      "DeudaGenerada",
      "DeudaVencida",
      "PagoRegistrado",
      "PagoRevertido",
      "DeudaCancelada",
      "PlanPagoSolicitado",
      "PlanPagoOtorgado",
      "PlanPagoIncumplido",
      "ExencionSolicitada",
      "ExencionAprobada",
      "ExencionRechazada",
      "SaldoFavorGenerado",
    ],
  },
  {
    id: "ambiente-servicios-urbanos",
    name: "Ambiente, higiene y servicios urbanos",
    code: "Módulo 6",
    events: [
      "ServicioUrbanoProgramado",
      "ServicioUrbanoIniciado",
      "ServicioUrbanoDemorado",
      "ServicioUrbanoFinalizado",
      "ZonaNoAtendida",
      "ContenedorDesbordado",
      "ContenedorDanado",
      "RiesgoArboladoDetectado",
      "PodaProgramada",
      "IncumplimientoAmbientalDetectado",
      "ServicioUrbanoSolicitaReparacion",
    ],
  },
  {
    id: "transito",
    name: "Tránsito, estacionamiento y seguridad vial",
    code: "Módulo 7",
    events: [
      "InfraccionRegistrada",
      "InfraccionApelada",
      "InfraccionConfirmada",
      "InfraccionAnulada",
      "OperativoTransitoCreado",
      "AccidenteVialRegistrado",
      "IncidenteTransitoAtendido",
      "CorteCalleAutorizado",
      "CorteCalleRechazado",
      "CorteCalleActivado",
      "CorteCalleFinalizado",
      "VehiculoRetenido",
      "VehiculoLiberado",
    ],
  },
  {
    id: "desarrollo-social",
    name: "Desarrollo social, salud comunitaria y beneficios",
    code: "Módulo 8",
    events: [
      "ProgramaSocialCreado",
      "SolicitudBeneficioSocialCreada",
      "DocumentacionSocialSolicitada",
      "VisitaSocialProgramada",
      "VisitaSocialRealizada",
      "BeneficioSocialAprobado",
      "BeneficioSocialRechazado",
      "BeneficioSocialSuspendido",
      "BeneficioSocialFinalizado",
      "TurnoSaludMunicipalOtorgado",
      "AtencionComunitariaRegistrada",
      "SituacionVulnerabilidadCriticaDetectada",
    ],
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
