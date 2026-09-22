import { useState } from "react";
import { Link } from "react-router";
import {
  eventKey,
  getSubscriptionPreferences,
  moduleCatalog,
  saveSelectedEvents,
} from "../services/subscriptionPreferences";

export default function EventosSuscriptos(){
  const initial=getSubscriptionPreferences();
  const modules=moduleCatalog.filter((module)=>initial.moduleIds.includes(module.id));
  const [selectedEvents,setSelectedEvents]=useState(initial.eventKeys);
  const [saved,setSaved]=useState(false);

  const toggle=(key)=>{
    setSaved(false);
    setSelectedEvents((current)=>current.includes(key)
      ? current.filter((item)=>item!==key)
      : [...current,key]);
  };

  const apply=()=>{
    const next=saveSelectedEvents(selectedEvents);
    setSelectedEvents(next.eventKeys);
    setSaved(true);
  };

  if(!modules.length){
    return <div className="screen subscribed">
      <div className="crumb">Observatory / Eventos Suscriptos</div>
      <div className="empty-selection">
        <h2>No hay módulos seleccionados</h2>
        <p>Primero elegí uno o más módulos en Suscripciones.</p>
        <Link className="primary empty-selection-link" to="/suscripciones">Ir a Suscripciones</Link>
      </div>
    </div>;
  }

  return <div className="screen subscribed">
    <div className="crumb">Observatory / Eventos Suscriptos</div>
    <header className="page-head subscribed-head">
      <div>
        <h1>Eventos Suscriptos</h1>
        <p>Elegí los eventos que querés seguir dentro de los módulos seleccionados.</p>
      </div>
      <span className="badge">{selectedEvents.length} eventos seleccionados</span>
    </header>

    <div className="module-grid">
      {modules.map((module)=><section className="module-card" key={module.id}>
        <h3>{module.name}</h3>
        <div className="module-card-code">{module.code}</div>
        {module.events.map((eventName)=>{
          const key=eventKey(module.id,eventName);
          return <label key={key}>
            <input type="checkbox" checked={selectedEvents.includes(key)} onChange={()=>toggle(key)}/>
            <span>{eventName}</span>
          </label>;
        })}
      </section>)}
    </div>

    <button className="primary apply" type="button" onClick={apply}>Aplicar</button>
    {saved&&<p className="selection-status success" role="status">Eventos guardados. El Historial mostrará únicamente estos eventos.</p>}
  </div>;
}
