#!/usr/bin/env python3
"""
Improved parser for the OEP/Unitel elected officials document.
Extracts ALL titular diputados (plurinominales + uninominales + especiales + supraestatales).
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
SKIP_NAMES = {'CANDIDATO INHABILITADO', 'CANDIDATO CON RENUNCIA', 'SIN CANDIDATO'}

def is_name(s):
    """Check if string looks like a person name."""
    s = s.strip()
    if not s or len(s) < 5:
        return False
    if s in SKIP_NAMES:
        return False
    # Must have at least 2 words, mostly alphabetic
    words = s.split()
    if len(words) < 2:
        return False
    alpha = sum(1 for c in s if c.isalpha() or c in 'áéíóúñüÁÉÍÓÚÑÜ\'- ')
    return alpha > len(s) * 0.6

def is_titularidad(s):
    return s.strip() in ('TITULAR', 'SUPLENTE')

def is_circunscripcion(s):
    return s.strip().isdigit() and 1 <= int(s.strip()) <= 70

def is_posicion(s):
    return s.strip().isdigit() and 1 <= int(s.strip()) <= 10

def is_party(s):
    return s.strip() in KNOWN_PARTIES

def clean(s):
    return s.strip()

# Parse the text line by line with a state machine
lines = text.split('\n')
results = []

current_dept = None
current_section = None  # 'senadores', 'plurinominal', 'uninominal', 'especial', 'supraestatal'

# For each entry we're building
entry = {}

def reset_entry():
    global entry
    entry = {'sigla': None, 'titularidad': None, 'circunscripcion': None, 'posicion': None, 'nombre': None}

def flush_entry():
    global entry
    if entry.get('nombre') and entry.get('sigla') and entry.get('titularidad') == 'TITULAR' and is_name(entry['nombre']):
        results.append({
            'nombre': entry['nombre'].strip(),
            'departamento': current_dept,
            'partido_sigla': entry['sigla'],
            'partido': PARTY_MAP.get(entry['sigla'], entry['sigla']),
            'tipo': current_section,
            'circunscripcion': entry.get('circunscripcion'),
        })

reset_entry()

dept_order = ['CHUQUISACA', 'LA PAZ', 'COCHABAMBA', 'ORURO', 'POTOSÍ', 'TARIJA', 'SANTA CRUZ', 'BENI', 'PANDO']

for i, raw_line in enumerate(lines):
    line = clean(raw_line)
    if not line:
        continue
    
    # Check for department
    dept_found = False
    for d in dept_order:
        if f'DEPARTAMENTO DE {d}' in line or f'DEPARTAMENTO DEL {d}' in line:
            current_dept = d
            current_section = None
            reset_entry()
            dept_found = True
            break
    if dept_found:
        continue
    
    # Check for section headers
    if 'DIPUTADOS PLURINOMINALES' in line:
        current_section = 'plurinominal'
        reset_entry()
        continue
    if 'DIPUTADOS UNINOMINALES' in line:
        current_section = 'uninominal'
        reset_entry()
        continue
    if 'CIRCUNCRIPCIÓN ESPECIAL' in line or 'CIRCUNSCRIPCIÓN ESPECIAL' in line:
        current_section = 'especial'
        reset_entry()
        continue
    if 'SUPRAESTATALES' in line:
        current_section = 'supraestatal'
        reset_entry()
        continue
    if 'SENADORES' in line:
        current_section = 'senadores'
        reset_entry()
        continue
    
    # Skip if we're in senators section
    if current_section == 'senadores':
        continue
    if current_dept is None:
        continue
    
    # Skip header words
    if line in ('Sigla', 'Nombre completo', 'Posición', 'Titularidad', 'Circunscripción', 'Posición Titularidad'):
        continue
    # Skip page markers
    if line.startswith('Página'):
        continue
    
    # Process line content
    if is_party(line):
        # New entry starts
        flush_entry()
        reset_entry()
        entry['sigla'] = line
    elif is_titularidad(line):
        entry['titularidad'] = line
    elif is_circunscripcion(line):
        entry['circunscripcion'] = line
    elif is_posicion(line) and current_section in ('plurinominal', 'especial', 'supraestatal'):
        entry['posicion'] = line
    elif is_name(line):
        # This could be a name - check context
        if entry['sigla'] is not None and entry['titularidad'] is not None:
            # We have sigla and titularidad, this is the name
            entry['nombre'] = line
            flush_entry()
            reset_entry()
        elif entry['sigla'] is not None and entry['titularidad'] is None:
            # In some sections, name comes before titularidad (early plurinominales)
            # But let's check the next few lines for TITULAR/SUPLENTE
            # Peek ahead
            found_tit = False
            for j in range(i+1, min(i+5, len(lines))):
                next_line = clean(lines[j])
                if next_line == 'TITULAR':
                    entry['titularidad'] = 'TITULAR'
                    entry['nombre'] = line
                    flush_entry()
                    reset_entry()
                    found_tit = True
                    break
                elif next_line == 'SUPLENTE':
                    entry['titularidad'] = 'SUPLENTE'
                    entry['nombre'] = line
                    flush_entry()
                    reset_entry()
                    found_tit = True
                    break
                elif is_name(next_line):
                    break  # This line is NOT a name, next one is
            if not found_tit:
                # Try another pattern: maybe it's "UNIDAD TITULAR" on same line
                pass
    elif 'TITULAR' in line and is_party_possible(line):
        # Handle "UNIDAD TITULAR" on same line
        pass

# Handle "UNIDAD TITULAR" pattern - re-parse
# Let's also handle cases where party and titularidad are on same line
for i, raw_line in enumerate(lines):
    line = clean(raw_line)
    if not line:
        continue
    
    # Pattern: "PARTY TITULAR" or "PARTY SUPLENTE" on same line
    for party in KNOWN_PARTIES:
        if line.startswith(party + ' TITULAR'):
            rest = line[len(party):].strip()
            name_part = rest.replace('TITULAR', '').strip()
            if is_name(name_part):
                # Check next line for actual name
                for j in range(i+1, min(i+3, len(lines))):
                    next_line = clean(lines[j])
                    if is_name(next_line):
                        results.append({
                            'nombre': next_line,
                            'departamento': current_dept,
                            'partido_sigla': party,
                            'partido': PARTY_MAP.get(party, party),
                            'tipo': current_section,
                            'circunscripcion': None,
                        })
                        break

# Deduplicate
seen = set()
unique_results = []
for r in results:
    key = (r['nombre'], r['departamento'], r['partido_sigla'], r['tipo'])
    if key not in seen:
        seen.add(key)
        unique_results.append(r)

# Sort
unique_results.sort(key=lambda x: (
    dept_order.index(x['departamento']) if x['departamento'] in dept_order else 99,
    x['nombre']
))

# Summary
print(f"Total diputados titulares: {len(unique_results)}")
for dept in dept_order:
    count = len([r for r in unique_results if r['departamento'] == dept])
    print(f"  {dept}: {count}")

party_counts = {}
for r in unique_results:
    p = r['partido_sigla']
    party_counts[p] = party_counts.get(p, 0) + 1
print("\nPor partido:")
for p, c in sorted(party_counts.items(), key=lambda x: -x[1]):
    print(f"  {p}: {c}")

# Build final output
output = []
for r in unique_results:
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
