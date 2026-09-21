import { useState } from "react";
import JsonModal from "../components/JsonModal";

const rows = Array.from({ length: 7 }, (_, i) => ({ n: i + 1, name: `Nombre ${i + 1}`, date: `03/07/2023 10:0${i}`, type: "Tipo de evento", state: i === 3 ? "Error" : "OK" }));

function EventTable({ title, onJson }) {
  return <section className="panel"><h3>HISTORIAL MODULO X: {title}</h3><table><thead><tr><th>Número de evento</th><th>Nombre del evento</th><th>Fecha de entrada</th><th>Tipo de evento</th><th>Estado del evento</th><th>Descripción de procesamiento</th><th>Json</th><th>Reenviar</th></tr></thead><tbody>{rows.map(r=><tr key={r.n}><td>{r.n}</td><td>{r.name}</td><td>{r.date}</td><td>{r.type}</td><td>● {r.state}</td><td>Procesamiento completado</td><td><button className="json-btn" onClick={()=>onJson({ id:r.n, nombre:r.name, fechaEntrada:r.date, tipo:r.type, estado:r.state, descripcion:"Procesamiento completado", modulo:title })}>{"{}"} JSON</button></td><td><button className="round-btn">↻</button></td></tr>)}</tbody></table><div className="pager">‹　1　2　3　4　5　6　7　8　9　10　11　›</div></section>
}

export default function Home(){
  const [json, setJson] = useState(null);
  return <div className="screen history"><div className="crumb">Página Principal / Historial de eventos</div><EventTable title="Salida" onJson={setJson}/><EventTable title="Entrada" onJson={setJson}/><JsonModal data={json} onClose={()=>setJson(null)}/></div>
}
