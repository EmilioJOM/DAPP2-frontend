import { useState } from "react";
import { authService } from "../services/auth";

export default function UserProfile({ user, onClose, onUserChange, onLogout }) {
  const [nombre,setNombre]=useState(user.nombre||user.usuario||"");
  const [email,setEmail]=useState(user.email||"");
  const [avatar,setAvatar]=useState(user.avatar||"");
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [status,setStatus]=useState({type:"idle",message:""});
  const loading=status.type==="loading";

  const save=async(e)=>{
    e.preventDefault(); setStatus({type:"loading",message:"Guardando..."});
    try {
      const updated=await authService.updateProfile({...user,nombre,email,avatar});
      onUserChange(updated); setStatus({type:"success",message:"Perfil actualizado."});
    } catch { setStatus({type:"error",message:"No se pudo actualizar el perfil."}); }
  };

  const changePassword=async(e)=>{
    e.preventDefault();
    if(newPassword.length<8){setStatus({type:"error",message:"La nueva contraseña debe tener al menos 8 caracteres."});return;}
    setStatus({type:"loading",message:"Actualizando contraseña..."});
    try {
      await authService.changePassword({currentPassword,newPassword});
      setCurrentPassword(""); setNewPassword("");
      setStatus({type:"success",message:"Contraseña actualizada."});
    } catch { setStatus({type:"error",message:"No se pudo cambiar la contraseña."}); }
  };

  return <div className="user-dialog-backdrop" onMouseDown={onClose}>
    <section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={e=>e.stopPropagation()}>
      <button className="user-dialog-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
      <header className="profile-head">
        <div className="profile-avatar">{avatar?<img src={avatar} alt="Avatar del usuario"/>:<span>♙</span>}</div>
        <div><h2 id="profile-title">Perfil de usuario</h2><p>{user.usuario}</p></div>
      </header>
      {status.message&&<p className={`auth-status ${status.type}`} role="status">{status.message}</p>}
      <form className="profile-form" onSubmit={save}>
        <label>Nombre<input value={nombre} onChange={e=>setNombre(e.target.value)}/></label>
        <label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Avatar (URL)<input value={avatar} onChange={e=>setAvatar(e.target.value)} placeholder="https://..."/></label>
        <label>Roles asignados<div className="roles-readonly">{(user.roles||["Operador"]).map(role=><span key={role}>{role}</span>)}</div></label>
        <button className="primary" disabled={loading}>Guardar perfil</button>
      </form>
      <form className="profile-form password-change" onSubmit={changePassword}>
        <h3>Cambiar contraseña</h3>
        <label>Contraseña actual<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
        <label>Nueva contraseña<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
        <button disabled={loading||!currentPassword||!newPassword}>Cambiar contraseña</button>
      </form>
      <button className="profile-logout" type="button" onClick={onLogout}>Cerrar sesión</button>
    </section>
  </div>;
}
