#!/usr/bin/env python3
"""
Build final JSON matching deputy data with profile URLs from Wayback Machine.
"""
import json
import re

# Load manually extracted deputy data
with open('/home/z/my-project/diputados_2025_2030.json', 'r') as f:
    diputados = json.load(f)

# Load wayback HTML to extract profile URLs
with open('/home/z/my-project/wayback_diputados.html', 'r') as f:
    html = f.read()

# Extract all profile URLs
profile_urls = set(re.findall(r'(diputados\.gob\.bo/diputados/[^/"\' >]+)/', html))

# Function to normalize name for URL matching
def name_to_slug(name):
    """Convert name to URL slug format"""
    name = name.lower().strip()
    # Remove accents
    replacements = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'ü': 'u', 'ñ': 'n', 'Ñ': 'n', 'Á': 'a', 'É': 'e', 'Í': 'i',
        'Ó': 'o', 'Ú': 'u', 'Ü': 'u',
    }
    for old, new in replacements.items():
        name = name.replace(old, new)
    # Replace special chars
    name = name.replace("'", '').replace('-', ' ').replace('.', ' ')
    # Split into parts and rejoin
    parts = name.split()
    return '-'.join(parts)

# Build profile URL map
profile_map = {}
for url in profile_urls:
    slug = url.split('/diputados/')[-1].rstrip('/')
    profile_map[slug] = url

# Match each deputy with their profile URL
for d in diputados:
    slug = name_to_slug(d['nombre'])
    
    # Direct match
    if slug in profile_map:
        d['perfil_url'] = f"https://{profile_map[slug]}"
        continue
    
    # Try partial matching (handle title case differences, etc.)
    found = False
    for pslug, purl in profile_map.items():
        # Normalize both
        norm_slug = slug.replace('-', '').replace(' ', '')
        norm_pslug = pslug.replace('-', '').replace(' ', '')
        if norm_slug == norm_pslug:
            d['perfil_url'] = f"https://{purl}"
            found = True
            break
    
    if not found:
        # Try first 3 words
        words = slug.split('-')
        for length in [len(words), min(4, len(words)), min(3, len(words))]:
            partial = '-'.join(words[:length])
            for pslug, purl in profile_map.items():
                if pslug.startswith(partial):
                    d['perfil_url'] = f"https://{purl}"
                    found = True
                    break
            if found:
                break
    
    if not found:
        d['perfil_url'] = ''

# Count matched
matched = sum(1 for d in diputados if d['perfil_url'])
print(f"Matched {matched}/{len(diputados)} deputies with profile URLs")

# Unmatched deputies
unmatched = [d['nombre'] for d in diputados if not d['perfil_url']]
if unmatched:
    print(f"\nUnmatched deputies ({len(unmatched)}):")
    for name in unmatched:
        print(f"  - {name} (slug: {name_to_slug(name)})")

# Add institutional social media
INSTITUTIONAL_SOCIAL = {
    'facebook': 'https://www.facebook.com/PresidenciadelaCamaradeDiputadosdeBolivia',
    'twitter': 'https://x.com/Diputados_Bol',
    'youtube': 'https://www.youtube.com/c/C%C3%A1maradeDiputadosBolivia',
    'tiktok': 'https://www.tiktok.com/@camaradediputadosbo',
}

# Build final output
output = []
for d in diputados:
    output.append({
        'nombre': d['nombre'],
        'departamento': d['departamento'],
        'partido_sigla': d['partido_sigla'],
        'partido': d['partido'],
        'tipo_diputado': d['tipo_diputado'],
        'circunscripcion': d['circunscripcion'],
        'redes_sociales': {},
        'foto_url': '',
        'perfil_url': d['perfil_url'],
        'fuente_url': d['fuente_url']
    })

# Re-sort
dept_order = ['CHUQUISACA', 'LA PAZ', 'COCHABAMBA', 'ORURO', 'POTOSÍ', 'TARIJA', 'SANTA CRUZ', 'BENI', 'PANDO']
output.sort(key=lambda x: (
    dept_order.index(x['departamento']) if x['departamento'] in dept_order else 99,
    {'plurinominal': 0, 'uninominal': 1, 'especial': 2, 'supraestatal': 3}.get(x['tipo_diputado'], 4),
    x['nombre']
))

# Save
with open('/home/z/my-project/diputados_2025_2030.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\nFinal JSON: {len(output)} diputados titulares con {matched} perfiles vinculados")

# Also add metadata
metadata = {
    'descripcion': 'Lista de diputados titulares de la Asamblea Legislativa Plurinacional de Bolivia, periodo constitucional 2025-2030. Datos extraídos del documento oficial del OEP (Tribunal Supremo Electoral) publicado por Unitel.',
    'fuente_principal': 'https://estaticos.unitel.bo/binrepository/electos-2025_101-12895136_20250826185916.pdf',
    'fuente_perfiles': 'https://diputados.gob.bo/diputados-home/ (accesible vía Internet Archive)',
    'fecha_extraccion': '2026-04-28',
    'total_diputados': len(output),
    'redes_institucionales': INSTITUTIONAL_SOCIAL,
    'nota': 'El sitio diputados.gob.bo estaba fuera de servicio al momento de la extracción. Los perfiles individuales fueron verificados vía Internet Archive (Wayback Machine). Las redes sociales individuales no están disponibles públicamente en los perfiles del sitio de la Cámara.'
}

final = {
    'metadata': metadata,
    'diputados': output
}

with open('/home/z/my-project/diputados_2025_2030_completo.json', 'w', encoding='utf-8') as f:
    json.dump(final, f, ensure_ascii=False, indent=2)

print(f"Guardado archivo completo: diputados_2025_2030_completo.json")
