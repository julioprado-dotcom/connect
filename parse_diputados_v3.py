#!/usr/bin/env python3
"""
Final robust parser for elected diputados 2025-2030 from OEP/Unitel PDF text.
Handles two distinct formats:
1. Early format (Chuquisaca, La Paz): Sigla/Name pairs first, then Titularidad block
2. Later format (Cochabamba+): Sigla, Posición, Titularidad block, then Name block
"""
import json
import re

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

def clean(s):
    return s.strip()

dept_order = ['CHUQUISACA', 'LA PAZ', 'COCHABAMBA', 'ORURO', 'POTOSÍ', 'TARIJA', 'SANTA CRUZ', 'BENI', 'PANDO']

# Split into department blocks
dept_blocks = re.split(r'(?=DEPARTAMENTO DE [^\n]+|DEPARTAMENTO DEL [^\n]+)', text)

all_titulares = []

for block in dept_blocks:
    if not block.strip():
        continue
    
    # Find department
    dept = None
    for d in dept_order:
        if f'DEPARTAMENTO DE {d}' in block or f'DEPARTAMENTO DEL {d}' in block:
            dept = d
            break
    if not dept:
        continue
    
    # Split into section blocks
    sec_blocks = re.split(r'(?=\nDIPUTADOS PLURINOMINALES|\nDIPUTADOS UNINOMINALES|\nDIPUTADOS POR CIRCUNCRIPCIÓN|\nDIPUTADOS POR CIRCUNSCRIPCIÓN|\nREPRESENTANTES SUPRAESTATALES|\nSENADORES)', block)
    
    for sec in sec_blocks:
        if not sec.strip():
            continue
        
        # Determine section type
        if 'DIPUTADOS PLURINOMINALES' in sec:
            sec_type = 'plurinominal'
        elif 'DIPUTADOS UNINOMINALES' in sec:
            sec_type = 'uninominal'
        elif 'CIRCUNSCRIPCIÓN ESPECIAL' in sec or 'CIRCUNCRIPCIÓN ESPECIAL' in sec:
            sec_type = 'especial'
        elif 'SUPRAESTATALES' in sec:
            sec_type = 'supraestatal'
        elif 'SENADORES' in sec:
            continue  # Skip senators
        else:
            continue
        
        sec_lines = [clean(l) for l in sec.strip().split('\n') if clean(l)]
        
        # Filter out non-data lines
        data_lines = [l for l in sec_lines 
                      if l not in ('Sigla', 'Nombre completo', 'Posición', 'Titularidad', 
                                   'Circunscripción', 'Posición Titularidad', 
                                   'DIPUTADOS PLURINOMINALES', 'DIPUTADOS UNINOMINALES',
                                   'REPRESENTANTES SUPRAESTATALES', 'SENADORES')
                      and not l.startswith('Página')
                      and not l.startswith('DEPARTAMENTO')
                      and 'CIRCUNSCRIPCIÓN' not in l and 'CIRCUNCRIPCIÓN' not in l]
        
        # Remove section headers that remain
        data_lines = [l for l in data_lines if l not in ('DIPUTADOS PLURINOMINALES', 'DIPUTADOS UNINOMINALES')]
        
        # === FORMAT DETECTION ===
        # Format A (Chuquisaca, La Paz plurinominales): 
        #   PDC, NAME, PDC, NAME, ... then TITULAR, SUPLENTE, ...
        # Format B (Cochabamba+ plurinominales):
        #   PARTY, POS, TITULAR, ... then NAME, NAME, ...
        # Format C (uninominales - most):
        #   PARTY, TITULAR, NAME or PARTY TITULAR, NAME
        # Format D (especial, supraestatal - most):
        #   PARTY, POS, TITULAR, NAME
        
        if sec_type == 'plurinominal':
            # Check if it's Format A or B
            # Format A: first few lines alternate between party and name
            # Format B: first few lines are party, number, titularidad
            
            # Find first party line
            first_party_idx = None
            for idx, l in enumerate(data_lines):
                if is_party(l):
                    first_party_idx = idx
                    break
            
            if first_party_idx is None:
                continue
            
            # Look at the pattern after first party
            next_line = data_lines[first_party_idx + 1] if first_party_idx + 1 < len(data_lines) else ''
            
            if is_name(next_line):
                # Format A: party, name, party, name...
                # Then titularidades in separate block
                pairs = []  # (party, name)
                i = first_party_idx
                while i < len(data_lines):
                    if is_party(data_lines[i]):
                        party = data_lines[i]
                        # Next line should be name
                        if i + 1 < len(data_lines) and is_name(data_lines[i + 1]):
                            name = data_lines[i + 1]
                            pairs.append((party, name))
                            i += 2
                        else:
                            i += 1
                    elif data_lines[i] in ('TITULAR', 'SUPLENTE'):
                        # We've hit the titularidad block
                        break
                    elif 'TITULAR' in data_lines[i]:
                        # "UNIDAD TITULAR" combined
                        for p in KNOWN_PARTIES:
                            if data_lines[i].startswith(p):
                                remainder = data_lines[i][len(p):].strip()
                                if remainder == 'TITULAR':
                                    # Name might be appended or on next line
                                    # Check if rest of line has name
                                    rest_after_tit = data_lines[i][len(p) + len('TITULAR'):].strip()
                                    if is_name(rest_after_tit):
                                        pairs.append((p, rest_after_tit))
                                    elif i + 1 < len(data_lines) and is_name(data_lines[i + 1]):
                                        pairs.append((p, data_lines[i + 1]))
                                        i += 1
                                break
                        i += 1
                    else:
                        i += 1
                
                # Now process titularidad block
                tit_block_start = None
                for idx, l in enumerate(data_lines):
                    if l in ('TITULAR', 'SUPLENTE') and not is_name(l):
                        # Find the start of the titularidad block
                        # Look backwards to find where names end
                        tit_block_start = idx
                        break
                
                if tit_block_start is not None:
                    tit_vals = []
                    for idx in range(tit_block_start, len(data_lines)):
                        if data_lines[idx] == 'TITULAR':
                            tit_vals.append('TITULAR')
                        elif data_lines[idx] == 'SUPLENTE':
                            tit_vals.append('SUPLENTE')
                        elif is_name(data_lines[idx]):
                            break  # New section starts
                
                    # Match: pairs[0] -> tit_vals[0], pairs[1] -> tit_vals[1], etc.
                    for idx, (party, name) in enumerate(pairs):
                        if idx < len(tit_vals) and tit_vals[idx] == 'TITULAR':
                            all_titulares.append({
                                'nombre': name, 'departamento': dept,
                                'partido_sigla': party, 'partido': PARTY_MAP.get(party, party),
                                'tipo': sec_type, 'circunscripcion': None,
                            })
                else:
                    # No titularidad block found - try to use position block
                    # Look for position numbers after pairs
                    pos_block = []
                    in_pos = False
                    for idx, l in enumerate(data_lines):
                        if l.isdigit() and not in_pos:
                            in_pos = True
                            pos_block.append(l)
                        elif in_pos:
                            if l.isdigit():
                                pos_block.append(l)
                            else:
                                break
                    
                    # Without titularidad info, include all pairs
                    for party, name in pairs:
                        all_titulares.append({
                            'nombre': name, 'departamento': dept,
                            'partido_sigla': party, 'partido': PARTY_MAP.get(party, party),
                            'tipo': sec_type, 'circunscripcion': None,
                        })
            
            else:
                # Format B: party, pos, titularidad blocks, then name block
                # Parse sigla/pos/tit blocks first
                entries = []
                i = first_party_idx
                while i < len(data_lines):
                    if is_party(data_lines[i]):
                        party = data_lines[i]
                        pos = None
                        tit = None
                        j = i + 1
                        while j < len(data_lines) and j < i + 6:
                            if data_lines[j].isdigit():
                                pos = data_lines[j]
                            elif data_lines[j] in ('TITULAR', 'SUPLENTE'):
                                tit = data_lines[j]
                                break
                            elif is_name(data_lines[j]):
                                # We've hit the name block
                                break
                            j += 1
                        entries.append({'party': party, 'pos': pos, 'tit': tit, 'name': None})
                        i = j
                    else:
                        i += 1
                
                # Now find the name block
                # Names are listed sequentially, corresponding to entries
                # Find where names start
                name_start = None
                for idx in range(first_party_idx, len(data_lines)):
                    if is_name(data_lines[idx]):
                        name_start = idx
                        break
                
                if name_start is not None:
                    names = []
                    for idx in range(name_start, len(data_lines)):
                        if is_name(data_lines[idx]):
                            names.append(data_lines[idx])
                        else:
                            break
                    
                    for idx, entry in enumerate(entries):
                        if idx < len(names):
                            entry['name'] = names[idx]
                
                # Also look for names that appear after titularidad blocks
                # Sometimes names are interleaved differently
                if not any(e['name'] for e in entries):
                    # Try alternate: names come right after each TITULAR/SUPLENTE
                    pass
                
                for e in entries:
                    if e['name'] and e['tit'] == 'TITULAR':
                        all_titulares.append({
                            'nombre': e['name'], 'departamento': dept,
                            'partido_sigla': e['party'], 'partido': PARTY_MAP.get(e['party'], e['party']),
                            'tipo': sec_type, 'circunscripcion': None,
                        })
        
        elif sec_type == 'uninominal':
            # Parse: party, titularidad, name (possibly with "PARTY TITULAR" on same line)
            i = 0
            while i < len(data_lines):
                line = data_lines[i]
                
                if is_party(line):
                    party = line
                    rest_of_line = ''
                    if len(line) > len(party):
                        rest_of_line = line[len(party):].strip()
                    
                    tit = None
                    name = None
                    circ = None
                    
                    if 'TITULAR' in rest_of_line:
                        tit = 'TITULAR'
                        rest_after = rest_of_line.replace('TITULAR', '').strip()
                        if is_name(rest_after):
                            name = rest_after
                    elif 'SUPLENTE' in rest_of_line:
                        tit = 'SUPLENTE'
                    else:
                        # Look at next lines
                        for j in range(i + 1, min(i + 8, len(data_lines))):
                            nl = data_lines[j]
                            if nl == 'TITULAR':
                                tit = 'TITULAR'
                            elif nl == 'SUPLENTE':
                                tit = 'SUPLENTE'
                            elif nl.isdigit() and 1 <= int(nl) <= 70:
                                circ = nl
                            elif is_name(nl):
                                name = nl
                                i = j
                                break
                            elif is_party(nl):
                                break
                    
                    if name and tit == 'TITULAR':
                        all_titulares.append({
                            'nombre': name, 'departamento': dept,
                            'partido_sigla': party, 'partido': PARTY_MAP.get(party, party),
                            'tipo': sec_type, 'circunscripcion': circ,
                        })
                
                i += 1
        
        elif sec_type in ('especial', 'supraestatal'):
            # Similar to uninominal but with position
            i = 0
            while i < len(data_lines):
                line = data_lines[i]
                
                if is_party(line):
                    party = line
                    tit = None
                    name = None
                    
                    for j in range(i + 1, min(i + 8, len(data_lines))):
                        nl = data_lines[j]
                        if nl == 'TITULAR':
                            tit = 'TITULAR'
                        elif nl == 'SUPLENTE':
                            tit = 'SUPLENTE'
                        elif nl.isdigit():
                            pass  # position
                        elif is_name(nl):
                            name = nl
                            i = j
                            break
                        elif is_party(nl):
                            break
                    
                    if name and tit == 'TITULAR':
                        all_titulares.append({
                            'nombre': name, 'departamento': dept,
                            'partido_sigla': party, 'partido': PARTY_MAP.get(party, party),
                            'tipo': sec_type, 'circunscripcion': None,
                        })
                
                i += 1

# Deduplicate
seen = set()
unique = []
for r in all_titulares:
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
    print(f"  {d}: {count}")

party_counts = {}
for r in unique:
    p = r['partido_sigla']
    party_counts[p] = party_counts.get(p, 0) + 1
print("\nPor partido:")
for p, c in sorted(party_counts.items(), key=lambda x: -x[1]):
    print(f"  {p}: {c}")

# Build final JSON
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
