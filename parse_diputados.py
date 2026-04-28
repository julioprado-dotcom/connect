#!/usr/bin/env python3
"""
Parse the elected officials text (from OEP/Unitel PDF) and generate
a structured JSON of all TITULAR diputados for the 2025-2030 period.
"""
import json
import re

# Read the extracted text
with open('/home/z/my-project/electos_2025.txt', 'r') as f:
    text = f.read()

# Split by pages
pages = text.split('Página')
departments = {
    'CHUQUISACA': {},
    'LA PAZ': {},
    'COCHABAMBA': {},
    'ORURO': {},
    'POTOSÍ': {},
    'TARIJA': {},
    'SANTA CRUZ': {},
    'BENI': {},
    'PANDO': {},
}

# Known party siglas
PARTY_MAP = {
    'PDC': 'Partido Demócrata Cristiano',
    'LIBRE': 'Libre',
    'AP': 'Acción Panaliberal',
    'UNIDAD': 'Unidad',
    'MAS IPSP': 'Movimiento al Socialismo - Instrumento Político por la Soberanía de los Pueblos',
    'APB SÚMATE': 'Acción Panaliberal Bolivia - Súmate',
    'BIA YUQUI': 'Bia Yuqui',
}

def is_valid_name(name):
    """Check if a string looks like a person's name"""
    if not name or len(name) < 5:
        return False
    invalid = ['CANDIDATO INHABILITADO', 'CANDIDATO CON RENUNCIA', 'SIN CANDIDATO',
               'Nombre completo', 'Titularidad', 'Posición', 'Circunscripción', 'Sigla']
    if any(n in name.upper() for n in invalid):
        return False
    # Should have at least 2 words and mostly letters/spaces
    words = name.strip().split()
    if len(words) < 2:
        return False
    alpha_count = sum(1 for c in name if c.isalpha() or c in 'áéíóúñüÁÉÍÓÚÑÜ ')
    if alpha_count < len(name) * 0.7:
        return False
    return True

def normalize_party(party):
    """Normalize party name"""
    party = party.strip()
    return PARTY_MAP.get(party, party)

# Parse the text line by line
lines = text.strip().split('\n')

current_dept = None
current_section = None  # SENADORES, DIPUTADOS PLURINOMINALES, DIPUTADOS UNINOMINALES, etc.
current_sigla = None
current_titularidad = None
current_circunscripcion = None
current_posicion = None

# For sections with different column order
# Chuquisaca diputados plurinominales: Sigla, Nombre completo (separate blocks)
# La Paz and later: Sigla, Posición, Titularidad (block), Nombre completo (separate block)
# Cochabamba and later: Sigla, Posición, Titularidad, Nombre completo (block), Nombre completo (block)

all_diputados = []

def add_diputado(name, partido, depto, tipo, circ=None, titularidad=None):
    if not is_valid_name(name):
        return
    all_diputados.append({
        'nombre': name.strip().title(),
        'departamento': depto,
        'partido_sigla': partido.strip(),
        'partido': normalize_party(partido),
        'tipo': tipo,  # plurinominal, uninominal, especial, supraestatal
        'circunscripcion': circ,
        'titularidad': titularidad,
        'redes_sociales': {},
        'foto_url': '',
        'fuente_url': 'https://estaticos.unitel.bo/binrepository/electos-2025_101-12895136_20250826185916.pdf'
    })

# State machine parser
dept_markers = [
    ('DEPARTAMENTO DE CHUQUISACA', 'CHUQUISACA'),
    ('DEPARTAMENTO DE LA PAZ', 'LA PAZ'),
    ('DEPARTAMENTO DE COCHABAMBA', 'COCHABAMBA'),
    ('DEPARTAMENTO DE ORURO', 'ORURO'),
    ('DEPARTAMENTO DE POTOSÍ', 'POTOSÍ'),
    ('DEPARTAMENTO DE TARIJA', 'TARIJA'),
    ('DEPARTAMENTO DE SANTA CRUZ', 'SANTA CRUZ'),
    ('DEPARTAMENTO DEL BENI', 'BENI'),
    ('DEPARTAMENTO DE PANDO', 'PANDO'),
]

KNOWN_PARTIES = {'PDC', 'LIBRE', 'AP', 'UNIDAD', 'MAS IPSP', 'APB SÚMATE', 'BIA YUQUI'}
TITULARIDADES = {'TITULAR', 'SUPLENTE'}
CIRCUNScripciones = set(str(i) for i in range(1, 70))

i = 0
# Simplified parser: look at the structure more carefully
# The text has clear section headers

# Let's re-parse using a section-based approach
sections = text.split('\n\n')

for section in sections:
    lines_in = section.strip().split('\n')
    if not lines_in:
        continue
    
    # Check for department marker
    for marker, dept_name in dept_markers:
        if marker in section:
            current_dept = dept_name
            current_section = None
            break
    
    if not current_dept:
        continue
    
    # Check for section type
    if 'DIPUTADOS PLURINOMINALES' in section:
        current_section = 'plurinominal'
        continue
    elif 'DIPUTADOS UNINOMINALES' in section:
        current_section = 'uninominal'
        continue
    elif 'DIPUTADOS POR CIRCUNCRIPCIÓN ESPECIAL' in section or 'DIPUTADOS POR CIRCUNSCRIPCIÓN ESPECIAL' in section:
        current_section = 'especial'
        continue
    elif 'REPRESENTANTES SUPRAESTATALES' in section:
        current_section = 'supraestatal'
        continue
    elif 'SENADORES' in section:
        current_section = 'senadores'
        continue
    
    if current_section == 'senadores':
        continue  # Skip senators

# Let me take a different approach - parse the raw text more carefully with regex
# Re-read the text and parse it section by section

text_clean = text.replace('\r\n', '\n').replace('\r', '\n')

# Find all department sections
dept_pattern = r'DEPARTAMENTO DE ([^\n]+)'
section_pattern = r'(DIPUTADOS PLURINOMINALES|DIPUTADOS UNINOMINALES|DIPUTADOS POR CIRCUNCRIPCIÓN ESPECIAL|DIPUTADOS POR CIRCUNSCRIPCIÓN ESPECIAL|REPRESENTANTES SUPRAESTATALES|SENADORES)'

# Split text into department blocks
dept_blocks = re.split(r'(?=DEPARTAMENTO DE )', text_clean)

all_results = []

for block in dept_blocks:
    if not block.strip():
        continue
    
    # Find department name
    dept_match = re.search(r'DEPARTAMENTO DE ([^\n]+)', block)
    if not dept_match:
        continue
    dept_name = dept_match.group(1).strip()
    
    # Find sections within department
    section_blocks = re.split(r'(?=(?:DIPUTADOS|REPRESENTANTES|SENADORES))', block)
    
    for sec_block in section_blocks:
        if not sec_block.strip():
            continue
        
        # Determine section type
        if 'DIPUTADOS PLURINOMINALES' in sec_block:
            sec_type = 'plurinominal'
        elif 'DIPUTADOS UNINOMINALES' in sec_block:
            sec_type = 'uninominal'
        elif 'CIRCUNSCRIPCIÓN ESPECIAL' in sec_block or 'CIRCUNCRIPCIÓN ESPECIAL' in sec_block:
            sec_type = 'especial'
        elif 'SUPRAESTATALES' in sec_block:
            sec_type = 'supraestatal'
        elif 'SENADORES' in sec_block:
            sec_type = 'senadores'
        else:
            continue
        
        if sec_type == 'senadores':
            continue  # Skip senators
        
        # Parse the section
        sec_lines = sec_block.strip().split('\n')
        
        # For plurinominales in early departments (Chuquisaca), format is:
        # Sigla block followed by Name block
        # For later departments, it's interleaved
        
        # Let's extract all siglas, names, titularidades from the section
        siglas = []
        names = []
        titularidades = []
        circs = []
        
        for line in sec_lines:
            line_stripped = line.strip()
            if line_stripped in KNOWN_PARTIES:
                siglas.append(line_stripped)
            elif line_stripped in TITULARIDADES:
                titularidades.append(line_stripped)
            elif line_stripped.isdigit() and 1 <= int(line_stripped) <= 70:
                circs.append(line_stripped)
            elif is_valid_name(line_stripped):
                names.append(line_stripped)
        
        # Now match siglas with names and titularidades
        # The pattern is: for each entry, there's a sigla, then titularidad, then name
        # But the order varies by section format
        
        if sec_type in ['plurinominal']:
            # For plurinominales: pairs of titular/suplente per sigla/position
            # Each name corresponds to the next sigla
            # Pattern: sigla, (titular, name), (suplente, name) repeating
            
            # Re-parse with sequential approach
            i = 0
            current_entries = []
            while i < len(sec_lines):
                line_s = sec_lines[i].strip()
                if line_s in KNOWN_PARTIES:
                    current_sigla = line_s
                    # Look for titularidad after this
                    for j in range(i+1, min(i+10, len(sec_lines))):
                        lj = sec_lines[j].strip()
                        if lj == 'TITULAR' or lj == 'SUPLENTE':
                            tit = lj
                            # Find name after titularidad
                            for k in range(j+1, min(j+5, len(sec_lines))):
                                lk = sec_lines[k].strip()
                                if is_valid_name(lk):
                                    add_diputado(lk, current_sigla, dept_name, sec_type, titularidad=tit)
                                    i = k
                                    break
                            break
                i += 1
                
        elif sec_type == 'uninominal':
            # Pattern: sigla, titularidad, name (all on separate lines)
            i = 0
            while i < len(sec_lines):
                line_s = sec_lines[i].strip()
                if line_s in KNOWN_PARTIES:
                    current_sigla = line_s
                    current_tit = None
                    current_circ = None
                    for j in range(i+1, min(i+10, len(sec_lines))):
                        lj = sec_lines[j].strip()
                        if lj in TITULARIDADES:
                            current_tit = lj
                        elif lj.isdigit() and 1 <= int(lj) <= 70:
                            current_circ = lj
                        elif is_valid_name(lj):
                            if current_tit:
                                add_diputado(lj, current_sigla, dept_name, sec_type, circ=current_circ, titularidad=current_tit)
                            i = j
                            break
                i += 1
                
        elif sec_type in ['especial', 'supraestatal']:
            # Pattern: sigla, posicion, titularidad, name (all on separate lines)
            i = 0
            while i < len(sec_lines):
                line_s = sec_lines[i].strip()
                if line_s in KNOWN_PARTIES:
                    current_sigla = line_s
                    current_tit = None
                    for j in range(i+1, min(i+10, len(sec_lines))):
                        lj = sec_lines[j].strip()
                        if lj in TITULARIDADES:
                            current_tit = lj
                        elif is_valid_name(lj):
                            if current_tit:
                                add_diputado(lj, current_sigla, dept_name, sec_type, titularidad=current_tit)
                            i = j
                            break
                i += 1

# Filter only TITULAR diputados
titulares = [d for d in all_diputados if d['titularidad'] == 'TITULAR']

# Remove titularidad field from output and clean up
output = []
seen = set()
for d in titulares:
    key = (d['nombre'], d['departamento'], d['partido_sigla'])
    if key not in seen:
        seen.add(key)
        output.append({
            'nombre': d['nombre'],
            'departamento': d['departamento'],
            'partido_sigla': d['partido_sigla'],
            'partido': d['partido'],
            'tipo_diputado': d['tipo'],
            'circunscripcion': d['circunscripcion'],
            'redes_sociales': {},
            'foto_url': '',
            'fuente_url': d['fuente_url']
        })

# Sort by department then name
dept_order = ['CHUQUISACA', 'LA PAZ', 'COCHABAMBA', 'ORURO', 'POTOSÍ', 'TARIJA', 'SANTA CRUZ', 'BENI', 'PANDO']
output.sort(key=lambda x: (dept_order.index(x['departamento']) if x['departamento'] in dept_order else 99, x['nombre']))

# Print summary
print(f"Total diputados titulares: {len(output)}")
for dept in dept_order:
    dept_count = len([d for d in output if d['departamento'] == dept])
    print(f"  {dept}: {dept_count}")

# Party breakdown
party_counts = {}
for d in output:
    p = d['partido_sigla']
    party_counts[p] = party_counts.get(p, 0) + 1
print("\nPor partido:")
for p, c in sorted(party_counts.items(), key=lambda x: -x[1]):
    print(f"  {p}: {c}")

# Save to JSON
with open('/home/z/my-project/diputados_2025_2030.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\nJSON guardado en /home/z/my-project/diputados_2025_2030.json")
