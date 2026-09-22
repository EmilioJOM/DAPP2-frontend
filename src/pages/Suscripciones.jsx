import { useState } from "react";
import {
  getSubscriptionPreferences,
  moduleCatalog,
  saveSelectedModules,
} from "../services/subscriptionPreferences";

export default function Suscripciones(){
  const initial=getSubscriptionPreferences();
  const [selected,setSelected]=useState(initial.moduleIds);
  const [saved,setSaved]=useState(false);

  const toggle=(moduleId)=>{
    setSaved(false);
    setSelected((current)=>current.includes(moduleId)
      ? current.filter((id)=>id!==moduleId)
      : [...current,moduleId]);
  };

  const apply=()=>{
    const next=saveSelectedModules(selected);
    setSelected(next.moduleIds);
    setSaved(true);
  };

  return <div className="screen subscriptions">
    <div className="crumb">Observatory / Suscripciones / Selección de módulos</div>
    <header className="page-head">
      <div>
        <h1>Suscripciones</h1>
        <p>Seleccioná los módulos que querés observar. En Eventos Suscriptos vas a elegir qué eventos seguir dentro de estos módulos.</p>
      </div>
      <span className="badge">{selected.length} de {moduleCatalog.length} módulos seleccionados</span>
    </header>

    <div className="subscription-selector-grid">
      {moduleCatalog.map((module)=><label className={`module-choice ${selected.includes(module.id)?"selected":""}`} key={module.id}>
        <input type="checkbox" checked={selected.includes(module.id)} onChange={()=>toggle(module.id)}/>
        <span>
          <strong>{module.name}</strong>
          <code>{module.code}</code>
          <small>{module.events.length} tipos de evento disponibles</small>
        </span>
      </label>)}
    </div>

    <div className="selection-actions">
      <span className="selection-summary">Los eventos de un módulo deseleccionado también dejan de formar parte de la suscripción.</span>
      <button className="primary" type="button" onClick={apply}>Aplicar módulos</button>
    </div>
    {saved&&<p className="selection-status success" role="status">Selección de módulos guardada. Continuá en Eventos Suscriptos para elegir los eventos.</p>}
  </div>;
}
