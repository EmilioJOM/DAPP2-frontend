import { useMemo, useState } from "react";
import { authService } from "../services/auth";

const emailOk = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const passwordRules = (value) => ({
  length: value.length >= 8,
  upper: /[A-Z]/.test(value),
  lower: /[a-z]/.test(value),
  number: /\d/.test(value),
  symbol: /[^A-Za-z0-9]/.test(value),
});
const strongPassword = (value) => Object.values(passwordRules(value)).every(Boolean);

function PasswordStrength({ value }) {
  const rules=passwordRules(value);
  return <div className="password-rules" aria-live="polite">
    <span className={rules.length?"ok":""}>✓ 8+ caracteres</span>
    <span className={rules.upper?"ok":""}>✓ Mayúscula</span>
    <span className={rules.lower?"ok":""}>✓ Minúscula</span>
    <span className={rules.number?"ok":""}>✓ Número</span>
    <span className={rules.symbol?"ok":""}>✓ Símbolo</span>
  </div>;
}

export default function Login({ onLogin }) {
  const params=new URLSearchParams(window.location.search);
  const resetToken=params.get("token");
  const [view,setView]=useState(resetToken?"reset":"login");
  const [usuario,setUsuario]=useState("");
  const [email,setEmail]=useState("");
  const [contrasena,setContrasena]=useState("");
  const [confirmar,setConfirmar]=useState("");
  const [status,setStatus]=useState({type:"idle",message:""});
  const loading=status.type==="loading";
  const validPassword=useMemo(()=>strongPassword(contrasena),[contrasena]);

  const go=(next)=>{setStatus({type:"idle",message:""});setContrasena("");setConfirmar("");setView(next);};
  const run=async(action,success)=>{
    setStatus({type:"loading",message:"Procesando..."});
    try{const result=await action();setStatus({type:"success",message:success});return result;}
    catch(error){setStatus({type:"error",message:error?.response?.data?.message||"No se pudo completar la operación. Intentá nuevamente."});}
  };

  const submitLogin=async(e)=>{
    e.preventDefault();
    if(!usuario.trim()||!contrasena){setStatus({type:"error",message:"Completá usuario y contraseña."});return;}
    const result=await run(()=>authService.login({usuario:usuario.trim(),contrasena,email}),"Acceso correcto. Redirigiendo...");
    if(result) onLogin(result);
  };
  const submitRegister=async(e)=>{
    e.preventDefault();
    if(!usuario.trim()||!emailOk(email)||!validPassword||contrasena!==confirmar){setStatus({type:"error",message:"Revisá los campos marcados antes de continuar."});return;}
    const result=await run(()=>authService.register({usuario:usuario.trim(),email,contrasena}),"Cuenta creada. Ya podés iniciar sesión.");
    if(result){setContrasena("");setConfirmar("");setView("login");}
  };
  const submitRecovery=async(e)=>{
    e.preventDefault();
    if(!emailOk(email)){setStatus({type:"error",message:"Ingresá un correo electrónico válido."});return;}
    await run(()=>authService.requestPasswordReset(email),"Si el correo existe, recibirás instrucciones para recuperar tu cuenta.");
  };
  const submitReset=async(e)=>{
    e.preventDefault();
    if(!resetToken){setStatus({type:"error",message:"El enlace de recuperación no contiene un token válido."});return;}
    if(!validPassword||contrasena!==confirmar){setStatus({type:"error",message:"La contraseña no cumple los requisitos o no coincide."});return;}
    const result=await run(()=>authService.resetPassword(resetToken,contrasena),"Contraseña actualizada correctamente.");
    if(result){setContrasena("");setConfirmar("");setView("login");}
  };

  const Status=()=>status.message?<p className={`auth-status ${status.type}`} role="status">{status.message}</p>:null;

  return <div className="login-screen">
    <div className="login-preview-nav"><span>1. Historial de eventos</span><span>2. Eventos Suscriptos</span><span>3. Métricas</span><span>4. Suscripciones</span><span>●</span></div>
    <div className="login-overlay">
      {view==="login"&&<form className="login-card auth-card-wide" onSubmit={submitLogin}>
        <div className="login-avatar"><i/><b/></div><h2>Iniciar sesión</h2><Status/>
        <input value={usuario} onChange={e=>setUsuario(e.target.value)} placeholder="Usuario" autoComplete="username" aria-label="Usuario"/>
        <input type="password" value={contrasena} onChange={e=>setContrasena(e.target.value)} placeholder="Contraseña" autoComplete="current-password" aria-label="Contraseña"/>
        <button className="login-submit" disabled={loading}>{loading?"Ingresando...":"Iniciar Sesión"}</button>
        <div className="auth-links"><button type="button" onClick={()=>go("forgot")}>¿Olvidaste tu contraseña?</button><span>¿No tenés cuenta? <button type="button" onClick={()=>go("register")}>Registrarse</button></span></div>
      </form>}
      {view==="register"&&<form className="login-card auth-card-wide" onSubmit={submitRegister}>
        <button className="login-close" type="button" onClick={()=>go("login")}>×</button><div className="login-avatar"><i/><b/></div><h2>Crear cuenta</h2><Status/>
        <input className={usuario&&!usuario.trim()?"invalid":""} value={usuario} onChange={e=>setUsuario(e.target.value)} placeholder="Usuario"/>
        <input className={email&&!emailOk(email)?"invalid":""} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo electrónico"/>
        <input className={contrasena&&!validPassword?"invalid":""} type="password" value={contrasena} onChange={e=>setContrasena(e.target.value)} placeholder="Contraseña"/>
        <PasswordStrength value={contrasena}/>
        <input className={confirmar&&confirmar!==contrasena?"invalid":""} type="password" value={confirmar} onChange={e=>setConfirmar(e.target.value)} placeholder="Confirmar contraseña"/>
        {confirmar&&confirmar!==contrasena&&<p className="auth-error">Las contraseñas no coinciden.</p>}
        <button className="login-submit" disabled={loading||!usuario.trim()||!emailOk(email)||!validPassword||contrasena!==confirmar}>{loading?"Creando...":"Registrarse"}</button>
        <div className="auth-links"><button type="button" onClick={()=>go("login")}>← Volver a iniciar sesión</button></div>
      </form>}
      {view==="forgot"&&<form className="login-card auth-card-wide" onSubmit={submitRecovery}>
        <button className="login-close" type="button" onClick={()=>go("login")}>×</button><div className="login-avatar"><i/><b/></div><h2>Recuperar contraseña</h2>
        <p className="auth-help">Ingresá el correo asociado a tu cuenta. El backend enviará un enlace con token.</p><Status/>
        <input className={email&&!emailOk(email)?"invalid":""} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo electrónico"/>
        <button className="login-submit" disabled={loading||!emailOk(email)}>{loading?"Enviando...":"Enviar instrucciones"}</button>
        <div className="auth-links"><button type="button" onClick={()=>go("login")}>← Volver a iniciar sesión</button></div>
      </form>}
      {view==="reset"&&<form className="login-card auth-card-wide" onSubmit={submitReset}>
        <div className="login-avatar"><i/><b/></div><h2>Nueva contraseña</h2>
        <p className="auth-help">Definí una nueva contraseña para recuperar el acceso.</p><Status/>
        <input className={contrasena&&!validPassword?"invalid":""} type="password" value={contrasena} onChange={e=>setContrasena(e.target.value)} placeholder="Nueva contraseña"/>
        <PasswordStrength value={contrasena}/>
        <input className={confirmar&&confirmar!==contrasena?"invalid":""} type="password" value={confirmar} onChange={e=>setConfirmar(e.target.value)} placeholder="Confirmar nueva contraseña"/>
        <button className="login-submit" disabled={loading||!resetToken||!validPassword||contrasena!==confirmar}>{loading?"Actualizando...":"Guardar contraseña"}</button>
      </form>}
    </div>
  </div>;
}
