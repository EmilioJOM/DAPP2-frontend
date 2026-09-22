import { Link, useSearchParams } from "react-router";
import { moduleCatalog } from "../services/subscriptionPreferences";

const globalKpis=[['Throughput Global','Tasa bruta de ingestión y emisión medida en eventos por segundo (eps).'],['Latencia por Servicio','Distribución de percentiles de procesamiento p50 / p95 / p99 extremo a extremo.'],['Tasas DLQ y Fallos','Monitoreo del ratio de descarte y volumen encolado en Dead Letter Queues por microservicio.'],['Kafka & Particiones','Retención, consumer lag, balance de particiones y réplicas sincronizadas (ISR) por cluster.']];
const moduleKpis=[['Throughput del Módulo','Tasa de eventos procesados por segundo para este módulo.'],['Latencia del Módulo','Percentiles p50 / p95 / p99 de procesamiento del módulo.'],['Fallos y DLQ','Tasa de errores y eventos derivados a Dead Letter Queue.'],['Eventos Observados','Tipos de evento publicados o consumidos por el módulo.']];

export default function Metricas(){
  const [searchParams]=useSearchParams();
  const moduleId=searchParams.get("module");
  const module=moduleCatalog.find((item)=>item.id===moduleId);
  const scoped=Boolean(module);
  const kpis=scoped?moduleKpis:globalKpis;

  return <div className="screen metrics">
    <div className="crumb">OBSERVATORY / TELEMETRÍA / {scoped?module.name.toUpperCase():"MÉTRICAS CORE"}</div>
    <header className="page-head">
      <div>
        <b>▥ ESTADO: NO DEFINIDO — SEC. 12 DE ESPECIFICACIÓN FUNCIONAL</b>
        <h1>{scoped?`Métricas: ${module.name}`:"Métricas del Core de Microservicios"}</h1>
        {scoped&&<code>{module.code}</code>}
      </div>
      <div className="metrics-head-actions">
        <span className="badge">PENDIENTE DE DEFINICIÓN DE CONTRATO (SPRINT 2)</span>
        {scoped&&<Link className="metrics-global-link" to="/metrics">Ver métricas globales</Link>}
      </div>
    </header>
    {moduleId&&!module&&<div className="notice">El módulo solicitado no existe. Se muestran las métricas globales.</div>}
    <section className="hero-panel"><div><span className="badge">PIPELINE DE PROMETHEUS & OPENTELEMETRY</span><h2>{scoped?`Telemetría de ${module.name}`:"Métricas y Telemetría en proceso de especificación"}</h2><p>{scoped?`Vista reservada para las métricas propias de ${module.name}. La fuente real se conectará cuando esté disponible el contrato de telemetría.`:"La visualización gráfica de rendimiento se encuentra reservada hasta completar el mapeo de contratos de ingesta."}</p><div className="notice">ⓘ <b>Ruta técnica reservada: /metrics{scoped?`?module=${module.id}`:""}</b><br/>La telemetría en tiempo real se activará automáticamente una vez formalizados los contratos.</div></div><div className="pipeline">{scoped?<><b>{module.code}</b>　→　OTEL PROCESSOR　···　CORE OBSERVATORY<br/><small>{module.events.length} tipos de evento configurados</small></>:<>KAFKA CLUSTER　→　<b>OTEL PROCESSOR</b>　···　CORE OBSERVATORY<br/><small>Contrato de telemetría pendiente de homologación</small></>}</div></section>
    <h3 className="section-title">▣ {scoped?`Indicadores de ${module.name}`:"Indicadores y KPIs bajo relevamiento"}</h3>
    <div className="kpi-grid">{kpis.map(([t,d])=><article className="kpi" key={t}><b>{t}</b><p>{d}</p><code>{scoped?module.code:"SPEC: Core.Bus.Metric"}</code></article>)}</div>
    <section className="chart-panel"><h2>{scoped?`Telemetría del módulo ${module.name}`:"Maqueta de Interfaz Telemetría"}</h2><div className="chart-grid"><div className="fake-chart"><b>Tasa de Transferencia Egress/Ingress</b><div className="bars">▂ ▅ ▃ ▆ ▄ ▇ ▅ ▃ ▆</div></div><div className="fake-chart"><b>Latencia Media End-to-End</b><div className="linechart">╱╱╱╱╱╱╱</div></div><div className="fake-chart"><b>{scoped?"Tasa de Fallos":"Tasa de Fallos por Módulo"}</b>{scoped?<><p>{module.name}　0.12%</p><progress value="12" max="100"/><p>DLQ　0.03%</p><progress value="3" max="100"/></>:<><p>Auth Service　0.12%</p><progress value="12" max="100"/><p>Orders Service　0.85%</p><progress value="55" max="100"/></>}</div></div></section>
  </div>;
}
