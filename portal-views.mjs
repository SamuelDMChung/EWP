/* V1.23 WEB — visual workspace preferences, not database permissions. */
export function portalViewFromUrl(url=location.href){
  const view=new URL(url).searchParams.get('view');
  return view==='sales'||view==='ewp'?view:'all';
}
export function setWorkspaceView(view,{updateUrl=false}={}){
  const selected=['all','ewp','sales'].includes(view)?view:'all';
  for(const button of document.querySelectorAll('[data-workspace-view]')){
    const active=button.dataset.workspaceView===selected;
    button.classList.toggle('is-selected',active);
    button.setAttribute('aria-pressed',String(active));
  }
  for(const group of document.querySelectorAll('[data-workspace-group]')){
    group.hidden=selected!=='all' && group.dataset.workspaceGroup!==selected;
  }
  // Preserve the pre-existing Sales view navigation behavior (hide EWP
  // Tools nav link only). The header is not an access-control boundary.
  for(const link of document.querySelectorAll('.ewp-portal-nav__link[data-workspace-role="staff"]')){
    link.hidden=selected==='sales';
  }
  // Preserve a selected Portal view if users click Portal while already there.
  const homeHref=selected==='all'?'./':`./?view=${selected}`;
  for(const link of document.querySelectorAll('.ewp-portal-nav__brand, .ewp-portal-nav__links > .ewp-portal-nav__link'))link.setAttribute('href',homeHref);
  if(updateUrl){
    const url=new URL(location.href);
    if(selected==='all')url.searchParams.delete('view');
    else url.searchParams.set('view',selected);
    if(url.href!==location.href)history.pushState({workspaceView:selected},'',url.href);
  }
  return selected;
}
