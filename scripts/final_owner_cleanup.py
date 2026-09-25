from pathlib import Path
p=Path('src/main.jsx')
s=p.read_text(encoding='utf-8')
# The new fixed header owns the only hamburger. Remove the obsolete floating button.
s=s.replace('{!mobileMenu&&!mobileOverlayOpen&&<button type="button" className="mobile-menu-floating" onClick={()=>setMobileMenu(true)} aria-label="Open menu"><span></span><span></span><span></span></button>}','')
# Use the product name consistently inside the drawer.
s=s.replace('<div><b>GYMOS</b><small>{profile.full_name}</small></div>','<div><b>GYM MANAGER</b><small>{profile.full_name}</small></div>')
# The dashboard hero is the useful description; remove the old generic dashboard subtitle.
s=s.replace('<p>{pageHelp[tab]}</p>','{tab!=="Dashboard"&&<p>{pageHelp[tab]}</p>}')
p.write_text(s,encoding='utf-8')
print('Final owner shell cleanup applied')
