#!/usr/bin/env python3
"""
Manual parsing of OEP/Unitel PDF with carefully handled per-section logic.
Reads the text file and extracts titular diputados with correct pairing.
"""
import json

with open('/home/z/my-project/electos_2025.txt', 'r') as f:
    text = f.read()

PARTY_MAP = {
    'PDC': 'Partido Demócrata Cristiano',
    'LIBRE': 'Libre',
    'AP': 'Acción Panaliberal',
    'UNIDAD': 'Unidad',
    'MAS IPSP': 'Movimiento al Socialismo - IPSP',
    'APB SÚMATE': 'APB Súmate',
    'BIA YUQUI': 'Bia Yuqui',
}

KNOWN_PARTIES = {'PDC', 'LIBRE', 'AP', 'UNIDAD', 'MAS IPSP', 'APB SÚMATE', 'BIA YUQUI'}
SKIP_ENTRIES = {'CANDIDATO INHABILITADO', 'CANDIDATO CON RENUNCIA', 'SIN CANDIDATO'}

def is_name(s):
    s = s.strip()
    if not s or len(s) < 5 or s in SKIP_ENTRIES:
        return False
    words = s.split()
    if len(words) < 2:
        return False
    alpha = sum(1 for c in s if c.isalpha() or c in "áéíóúñüÁÉÍÓÚÑÜ'-. ")
    return alpha > len(s) * 0.6

def is_party(s):
    return s.strip() in KNOWN_PARTIES

# Read all lines
lines = [l.strip() for l in text.split('\n')]

# We'll parse section by section, tracking state manually
# Strategy: collect ALL items per section then pair them correctly

dept_order = ['CHUQUISACA', 'LA PAZ', 'COCHABAMBA', 'ORURO', 'POTOSÍ', 'TARIJA', 'SANTA CRUZ', 'BENI', 'PANDO']

all_diputados = []
current_dept = None
current_sec = None

def add(name, partido, dept, tipo, circ=None):
    name = name.strip()
    if not is_name(name):
        return
    all_diputados.append({
        'nombre': name, 'departamento': dept,
        'partido_sigla': partido.strip(), 'partido': PARTY_MAP.get(partido.strip(), partido.strip()),
        'tipo': tipo, 'circunscripcion': circ,
    })

i = 0
while i < len(lines):
    line = lines[i]
    
    # Department detection
    new_dept = None
    for d in dept_order:
        if f'DEPARTAMENTO DE {d}' in line or f'DEPARTAMENTO DEL {d}' in line:
            new_dept = d
            break
    if new_dept:
        current_dept = new_dept
        current_sec = None
        i += 1
        continue
    
    # Section detection
    if 'DIPUTADOS PLURINOMINALES' in line:
        current_sec = 'plurinominal'
        i += 1
        continue
    if 'DIPUTADOS UNINOMINALES' in line:
        current_sec = 'uninominal'
        i += 1
        continue
    if 'CIRCUNCRIPCIÓN ESPECIAL' in line or 'CIRCUNSCRIPCIÓN ESPECIAL' in line:
        current_sec = 'especial'
        i += 1
        continue
    if 'SUPRAESTATALES' in line:
        current_sec = 'supraestatal'
        i += 1
        continue
    if 'SENADORES' in line:
        current_sec = 'skip'
        i += 1
        continue
    
    if current_sec == 'skip' or current_dept is None:
        i += 1
        continue
    
    # Skip non-data lines
    if line in ('Sigla', 'Nombre completo', 'Posición', 'Titularidad', 'Circunscripción', 
                'Posición Titularidad', '') or line.startswith('Página'):
        i += 1
        continue
    
    # ---- PLURINOMINALES ----
    if current_sec == 'plurinominal':
        if is_party(line):
            # Could be followed by: name, or position/titularidad
            party = line
            j = i + 1
            
            # Collect items until next party or section end
            items = []
            while j < len(lines):
                nl = lines[j].strip()
                if is_party(nl) or nl.startswith('DIPUTADOS') or nl.startswith('SENADORES') or nl.startswith('REPRESENTANTES') or nl.startswith('DEPARTAMENTO') or nl.startswith('Página') or 'CIRCUNSCRIPCIÓN' in nl or 'CIRCUNCRIPCIÓN' in nl:
                    break
                items.append(nl)
                j += 1
            
            # Now interpret items
            # Format A (Chuquisaca, La Paz): NAME, (next_party, NAME), ...
            # Format B (Cochabamba+, Oruro+): POS, TIT, NAME (or pos block, then tit block, then name block)
            
            if items and is_name(items[0]):
                # Format A: first item is a name
                name = items[0]
                # We don't know titularidad yet, but we can look further ahead
                # For now, collect all names with their parties, then match with titularidades
                # The pattern alternates: PARTY, NAME, PARTY, NAME, then TITULAR, SUPLENTE blocks
                
                # Collect pairs
                pairs = [(party, name)]
                k = 0
                while k < len(items):
                    if is_party(items[k]) and k + 1 < len(items) and is_name(items[k + 1]):
                        pairs.append((items[k], items[k + 1]))
                        k += 2
                    elif items[k] in ('TITULAR', 'SUPLENTE'):
                        # Found titularidad block
                        # Extract all tit/sup
                        tit_block = []
                        for m in range(k, len(items)):
                            if items[m] == 'TITULAR':
                                tit_block.append('TITULAR')
                            elif items[m] == 'SUPLENTE':
                                tit_block.append('SUPLENTE')
                            elif items[m].isdigit():
                                pass  # position
                            else:
                                break
                        
                        # Match pairs with titularidades
                        for idx, (p, n) in enumerate(pairs):
                            if idx < len(tit_block) and tit_block[idx] == 'TITULAR':
                                add(n, p, current_dept, current_sec)
                        break
                    elif items[k].isdigit():
                        # Position number
                        k += 1
                    elif 'TITULAR' in items[k] or 'SUPLENTE' in items[k]:
                        k += 1
                    else:
                        k += 1
                
                i = j - 1  # Will be incremented below
            else:
                # Format B: items start with numbers (positions) or TITULAR/SUPLENTE
                pos = None
                tit = None
                
                for item in items:
                    if item.isdigit():
                        pos = item
                    elif item == 'TITULAR':
                        tit = 'TITULAR'
                    elif item == 'SUPLENTE':
                        tit = 'SUPLENTE'
                    elif is_name(item):
                        if tit == 'TITULAR':
                            add(item, party, current_dept, current_sec)
                        # After name, reset tit for next entry
                        tit = None
                        pos = None
                
                i = j - 1
        
        elif is_name(line):
            # Name without preceding party on this line
            # Look ahead for titularidad
            name = line
            j = i + 1
            while j < len(lines) and j < i + 5:
                nl = lines[j].strip()
                if nl == 'TITULAR':
                    # Need to find party - look back
                    for k in range(i - 1, max(i - 10, 0), -1):
                        if is_party(lines[k]):
                            add(name, lines[k], current_dept, current_sec)
                            break
                    break
                elif nl == 'SUPLENTE':
                    break
                elif is_party(nl) or nl.startswith('DIPUTADOS'):
                    break
                j += 1
        
        i += 1
        continue
    
    # ---- UNINOMINALES ----
    if current_sec == 'uninominal':
        if is_party(line):
            party = line
            rest = line[len(party):].strip() if len(line) > len(party) else ''
            
            tit = None
            name = None
            circ = None
            
            if 'TITULAR' in rest:
                tit = 'TITULAR'
                rest = rest.replace('TITULAR', '').strip()
                if is_name(rest):
                    name = rest
            elif 'SUPLENTE' in rest:
                tit = 'SUPLENTE'
            
            if not name:
                j = i + 1
                while j < len(lines) and j < i + 10:
                    nl = lines[j].strip()
                    if is_party(nl) or nl.startswith('DIPUTADOS') or nl.startswith('SENADORES') or nl.startswith('REPRESENTANTES') or nl.startswith('DEPARTAMENTO') or nl.startswith('Página') or 'CIRCUNSCRIPCIÓN' in nl or 'CIRCUNCRIPCIÓN' in nl:
                        break
                    if nl == 'TITULAR':
                        tit = 'TITULAR'
                    elif nl == 'SUPLENTE':
                        tit = 'SUPLENTE'
                    elif nl.isdigit() and 1 <= int(nl) <= 70:
                        circ = nl
                    elif is_name(nl):
                        name = nl
                        break
                    j += 1
            
            if name and tit == 'TITULAR':
                add(name, party, current_dept, current_sec, circ)
        
        i += 1
        continue
    
    # ---- ESPECIAL / SUPRAESTATAL ----
    if current_sec in ('especial', 'supraestatal'):
        if is_party(line):
            party = line
            tit = None
            name = None
            
            j = i + 1
            while j < len(lines) and j < i + 10:
                nl = lines[j].strip()
                if is_party(nl) or nl.startswith('DIPUTADOS') or nl.startswith('SENADORES') or nl.startswith('REPRESENTANTES') or nl.startswith('DEPARTAMENTO') or nl.startswith('Página') or 'CIRCUNSCRIPCIÓN' in nl or 'CIRCUNCRIPCIÓN' in nl:
                    break
                if nl == 'TITULAR':
                    tit = 'TITULAR'
                elif nl == 'SUPLENTE':
                    tit = 'SUPLENTE'
                elif nl.isdigit():
                    pass  # position
                elif is_name(nl):
                    name = nl
                    break
                j += 1
            
            if name and tit == 'TITULAR':
                add(name, party, current_dept, current_sec)
        
        i += 1
        continue
    
    i += 1

# Deduplicate
seen = set()
unique = []
for r in all_diputados:
    key = (r['nombre'], r['departamento'], r['partido_sigla'])
    if key not in seen:
        seen.add(key)
        unique.append(r)

# Sort
unique.sort(key=lambda x: (
    dept_order.index(x['departamento']) if x['departamento'] in dept_order else 99,
    x['nombre']
))

# Summary
print(f"Total diputados titulares: {len(unique)}")
for d in dept_order:
    count = len([r for r in unique if r['departamento'] == d])
    tipos = {}
    for r in [r for r in unique if r['departamento'] == d]:
        t = r['tipo']
        tipos[t] = tipos.get(t, 0) + 1
    print(f"  {d}: {count} (pluri:{tipos.get('plurinominal',0)}, uni:{tipos.get('uninominal',0)}, esp:{tipos.get('especial',0)}, supra:{tipos.get('supraestatal',0)})")

party_counts = {}
for r in unique:
    p = r['partido_sigla']
    party_counts[p] = party_counts.get(p, 0) + 1
print("\nPor partido:")
for p, c in sorted(party_counts.items(), key=lambda x: -x[1]):
    print(f"  {p}: {c}")

# Save
output = []
for r in unique:
    output.append({
        'nombre': r['nombre'].title(),
        'departamento': r['departamento'],
        'partido_sigla': r['partido_sigla'],
        'partido': r['partido'],
        'tipo_diputado': r['tipo'],
        'circunscripcion': r.get('circunscripcion'),
        'redes_sociales': {},
        'foto_url': '',
        'fuente_url': 'https://estaticos.unitel.bo/binrepository/electos-2025_101-12895136_20250826185916.pdf'
    })

with open('/home/z/my-project/diputados_2025_2030.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\nJSON guardado: {len(output)} diputados titulares")
