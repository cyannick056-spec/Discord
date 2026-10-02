const tabs=[['Appearance','Apariencia'],['Position','Posición'],['Shadows','Sombras'],['Material','Material'],['Light','Luz'],['Options','Opciones']] as const;
const el=(id:string)=>document.getElementById(id)!;
export function showObjectTab(id:string) {
  for(const [name] of tabs) {el('object'+name).hidden=name!==id;el('object'+name+'Tab').setAttribute('aria-selected',String(name===id));el('object'+name+'Tab').tabIndex=name===id?0:-1;}
  document.querySelector<HTMLElement>('.studio-scroll')!.scrollTop=0;
}
export function syncObjectTabs(furniture:boolean) {
  el('objectMaterialTab').hidden=!furniture;
  if(!furniture && el('objectMaterialTab').getAttribute('aria-selected')==='true') showObjectTab('Appearance');
}
export function initObjectTabs() {
  const inspector=el('studioObjectInspector'),header=inspector.querySelector('.studio-inspector-header')!;
  const nav=document.createElement('div');nav.className='object-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Configuración del objeto');header.append(nav);
  for(const [id,label] of tabs) {
    const tab=document.createElement('button');tab.type='button';tab.id='object'+id+'Tab';tab.textContent=label;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','object'+id);nav.append(tab);
    const panel=document.createElement('section');panel.id='object'+id;panel.className='object-tab-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);inspector.append(panel);
    tab.addEventListener('click',()=>showObjectTab(id));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key)) return;event.preventDefault();const visible=[...nav.querySelectorAll<HTMLButtonElement>('button')].filter(b=>!b.hidden),index=visible.indexOf(tab),next=visible[(index+(event.key==='ArrowRight'?1:visible.length-1))%visible.length];next.click();next.focus();});
  }
  const move=(target:string,...ids:string[])=>el('object'+target).append(...ids.map(el));
  move('Appearance','studioAppearance');move('Position','studioPosition','studioResting','studioPerspective');move('Material','studioMaterial');move('Light','studioLightFields');move('Options','studioObjectIdentity');
  el('studioAppearance').querySelector('.studio-fields')!.append(el('decorOpacity').closest('label')!);
  el('decorBrightness').closest('label')!.firstChild!.textContent='Brillo ';
  el('decorSaturation').closest('label')!.firstChild!.textContent='Saturación ';
  const shadow=el('studioContactOpacity').closest('details')!;shadow.open=true;shadow.id='studioObjectShadows';
  const outline=document.createElement('div');outline.className='studio-fields';const outlineLabel=el('decorShadow').closest('label')!;outlineLabel.classList.add('editor-wide');outline.append(outlineLabel);el('objectShadows').append(outline,shadow);
  for(const id of ['decorHidden','decorForeground','decorBehindTv','decorCopy','decorCopyAspect']) {const node=el(id);el('objectOptions').append(node.tagName==='BUTTON'?node:node.closest('label')!);}
  for(const id of ['studioAppearance','studioPosition','studioMaterial']) (el(id) as HTMLDetailsElement).open=true;
  el('objectLight').insertAdjacentHTML('afterbegin','<p class="studio-note">Esta luz pertenece al objeto seleccionado. Su color y alcance se guardan con él.</p>');
  showObjectTab('Appearance');
}
