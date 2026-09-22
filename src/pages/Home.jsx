import { useState } from "react";
import { Link } from "react-router";
import JsonModal from "../components/JsonModal";
import { eventKey, getSubscriptionPreferences, moduleCatalog } from "../services/subscriptionPreferences";

function rowsForModule(module, selectedKeys) {
  const selectedEvents=module.events.filter((eventName)=>selectedKeys.includes(eventKey(module.id,eventName)));
  return selectedEvents.flatMap((eventName,eventIndex)=>Array.from({length:3},(_,rowIndex)=>{
    const n=(eventIndex*3)+rowIndex+1;
    return {
      id:`${module.id}-${eventName}-${rowIndex+1}`,
      n,
      name:eventName,
      date:`21/09/2026 2${rowIndex}:0${eventIndex}`,
      type:"Domain.Event",
      state:(eventIndex+rowIndex)%5===4?"Error":"OK",
      description:(eventIndex+rowIndex)%5===4?"Procesamiento con error":"Procesamiento completado",
    };
  }));
}

function EventTable({ module, rows, onJson }) {
  return <section className="panel">
    <h3>HISTORIAL: {module.name} <code>{module.code}</code></h3>
    <table>
      <thead><tr><th>Número de evento</th><th>Nombre del evento</th><th>Fecha de entrada</th><th>Tipo de evento</th><th>Estado del evento</th><th>Descripción de procesamiento</th><th>Json</th><th>Reenviar</th></tr></thead>
      <tbody>{rows.map((row)=><tr key={row.id}>
        <td>{row.n}</td><td>{row.name}</td><td>{row.date}</td><td>{row.type}</td><td>● {row.state}</td><td>{row.description}</td>
        <td><button className="json-btn" onClick={()=>onJson({id:row.id,nombre:row.name,fechaEntrada:row.date,tipo:row.type,estado:row.state,descripcion:row.description,modulo:module.name})}>{"{}"} JSON</button></td>
        <td><button className="round-btn">↻</button></td>
      </tr>)}</tbody>
    </table>
    <div className="pager">Mostrando {rows.length} eventos seleccionados</div>
  </section>;
}

export default function Home(){
  const [json,setJson]=useState(null);
  const preferences=getSubscriptionPreferences();
  const modules=moduleCatalog.filter((module)=>preferences.moduleIds.includes(module.id));
  const histories=modules
    .map((module)=>({module,rows:rowsForModule(module,preferences.eventKeys)}))
    .filter(({rows})=>rows.length>0);

  return <div className="screen history">
    <div className="crumb">Página Principal / Historial de eventos</div>
    {!modules.length&&<div className="empty-selection">
      <h2>No hay módulos seleccionados</h2>
      <p>Seleccioná los módulos que querés observar antes de consultar el historial.</p>
      <Link className="primary empty-selection-link" to="/suscripciones">Ir a Suscripciones</Link>
    </div>}
    {modules.length>0&&!histories.length&&<div className="empty-selection">
      <h2>No hay eventos seleccionados</h2>
      <p>Ya elegiste módulos. Ahora seleccioná los eventos que querés incluir en el historial.</p>
      <Link className="primary empty-selection-link" to="/eventos-suscriptos">Ir a Eventos Suscriptos</Link>
    </div>}
    {histories.map(({module,rows})=><EventTable key={module.id} module={module} rows={rows} onJson={setJson}/>)}
    <JsonModal data={json} onClose={()=>setJson(null)}/>
  </div>;
}
