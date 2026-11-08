'use client';
import { useEffect, useRef, useState } from 'react';
import { MonitorCog, Moon, Sun, Check, ChevronDown } from 'lucide-react';

const OPTIONS = [
  {value:'auto', label:'Как на устройстве', Icon:MonitorCog},
  {value:'light', label:'Светлая', Icon:Sun},
  {value:'dark', label:'Тёмная', Icon:Moon},
];
export function ThemeToggle({ theme, preference, onSelect }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = event => {if (!root.current?.contains(event.target)) setOpen(false);};
    const onKey = event => {if (event.key === 'Escape') setOpen(false);};
    document.addEventListener('pointerdown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {document.removeEventListener('pointerdown', onClick);document.removeEventListener('keydown', onKey);};
  }, [open]);
  const CurrentIcon = preference === 'auto' ? MonitorCog : theme === 'dark' ? Moon : Sun;
  return <div className="theme-control" ref={root}>
    <button type="button" className="icon-button" onClick={()=>setOpen(v=>!v)}
      aria-haspopup="true" aria-expanded={open} aria-label={`Тема: ${OPTIONS.find(x=>x.value===preference)?.label}. Изменить`} title="Тема оформления">
      <CurrentIcon aria-hidden="true" size={21}/>
    </button>
    {open && <div className="theme-menu" role="group" aria-label="Тема оформления">
      {OPTIONS.map(({value,label,Icon})=><button key={value} type="button" className="theme-option"
        aria-pressed={preference===value} onClick={()=>{onSelect(value);setOpen(false);}}>
        <Icon size={19} aria-hidden="true"/><span>{label}</span>{preference===value&&<Check size={17} aria-hidden="true"/>}
      </button>)}
    </div>}
  </div>;
}
