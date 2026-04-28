#!/usr/bin/env python3
"""
Manual data entry from the OEP/Unitel PDF text. 
Since the PDF-to-text conversion has inconsistent formatting across sections,
the most reliable approach is to manually extract the data.
"""
import json

PARTY_MAP = {
    'PDC': 'Partido Demócrata Cristiano',
    'LIBRE': 'Libre',
    'AP': 'Acción Panaliberal',
    'UNIDAD': 'Unidad',
    'MAS IPSP': 'Movimiento al Socialismo - IPSP',
    'APB SÚMATE': 'APB Súmate',
    'BIA YUQUI': 'Bia Yuqui',
}

# Manually extracted from the PDF text (electos_2025.txt)
# Format: (nombre, partido, departamento, tipo, circunscripcion)
# Only TITULAR diputados included
diputados_raw = [
    # ===== CHUQUISACA =====
    # Plurinominales (4 titulares: positions 1,1,1,1)
    ('Roberto Julio Castro Salazar', 'PDC', 'CHUQUISACA', 'plurinominal', None),
    ('Sindy Karina Donaire Oropeza', 'AP', 'CHUQUISACA', 'plurinominal', None),
    ('William Marcelo Solis Valencia', 'LIBRE', 'CHUQUISACA', 'plurinominal', None),
    ('Maria Elena Vildozo Eyzaguirre', 'UNIDAD', 'CHUQUISACA', 'plurinominal', None),
    # Uninominales (5 titulares)
    ('Iber Antonio Pino O\'Barrio', 'LIBRE', 'CHUQUISACA', 'uninominal', '1'),
    ('Santiago Ticona Yupari', 'LIBRE', 'CHUQUISACA', 'uninominal', '2'),
    ('Roberto Carlos Rodriguez Llanqui', 'PDC', 'CHUQUISACA', 'uninominal', '3'),
    ('Anahi Nayely Rocha Rodas', 'PDC', 'CHUQUISACA', 'uninominal', '4'),
    ('Yhercina Mendez Tarifa', 'PDC', 'CHUQUISACA', 'uninominal', '5'),
    
    # ===== LA PAZ =====
    # Plurinominales (14 titulares from the pairs)
    ('Sandra Arminda Rivero Maldonado', 'PDC', 'LA PAZ', 'plurinominal', None),
    ('Oscar Alejandro Garcia Hoyos', 'PDC', 'LA PAZ', 'plurinominal', None),
    ('Sonia Siñani Callisaya', 'PDC', 'LA PAZ', 'plurinominal', None),
    ('Hinosencio Adalid Carbajal Miranda', 'MAS IPSP', 'LA PAZ', 'plurinominal', None),
    ('Maria Esther Gongora Miranda', 'APB SÚMATE', 'LA PAZ', 'plurinominal', None),
    ('Juan Carlos Poma Tapia', 'AP', 'LA PAZ', 'plurinominal', None),
    ('Sandra Virginia Surco Aruquipa', 'AP', 'LA PAZ', 'plurinominal', None),
    ('Sergio Luis Vasquez Jordan', 'LIBRE', 'LA PAZ', 'plurinominal', None),
    ('Maria Angelica Villena Guachalla', 'LIBRE', 'LA PAZ', 'plurinominal', None),
    ('Felipe Daza Rodriguez', 'LIBRE', 'LA PAZ', 'plurinominal', None),
    ('Cecilia Katherine Vargas Vasquez', 'LIBRE', 'LA PAZ', 'plurinominal', None),
    ('Cecilia Isabel Requena Zarate', 'UNIDAD', 'LA PAZ', 'plurinominal', None),
    ('Carlos Silvestre Alarcon Mondionio', 'UNIDAD', 'LA PAZ', 'plurinominal', None),
    ('Andrea Alejandra Ballivian Vargas', 'UNIDAD', 'LA PAZ', 'plurinominal', None),
    # Uninominales (14 titulares)
    ('Edgar Manolo Rojas Paz', 'PDC', 'LA PAZ', 'uninominal', '6'),
    ('Alejandro Jorge Reyes Careaga', 'UNIDAD', 'LA PAZ', 'uninominal', '7'),
    ('Juan Fernando Del Granado Cosio', 'UNIDAD', 'LA PAZ', 'uninominal', '8'),
    ('Nathaly Abril Chuquimia Rivas', 'PDC', 'LA PAZ', 'uninominal', '9'),
    ('Victor Huaranca Mamani', 'PDC', 'LA PAZ', 'uninominal', '10'),
    ('Catherine Pinto Veneros', 'PDC', 'LA PAZ', 'uninominal', '11'),
    ('Hidelberto Marquez Marca', 'PDC', 'LA PAZ', 'uninominal', '12'),
    ('Dionicia Maxima Chura Ticona', 'PDC', 'LA PAZ', 'uninominal', '13'),
    ('Constancio Gutierrez Catacora', 'PDC', 'LA PAZ', 'uninominal', '14'),
    ('Liz Betty Balhuarte Piluy', 'PDC', 'LA PAZ', 'uninominal', '15'),
    ('Armin Lluta Chuquimia', 'LIBRE', 'LA PAZ', 'uninominal', '16'),
    ('Ruth Miriam Solano Mamani', 'PDC', 'LA PAZ', 'uninominal', '17'),
    ('Edwin Valda Abalo', 'PDC', 'LA PAZ', 'uninominal', '18'),
    ('Danitza Mejia Figueredo', 'PDC', 'LA PAZ', 'uninominal', '19'),
    # Especial (1 titular)
    ('Walter Pinto Mollinedo', 'PDC', 'LA PAZ', 'especial', None),
    # Supraestatal (1 titular)
    ('Rene Daniel Camacho Quezada', 'PDC', 'LA PAZ', 'supraestatal', None),
    
    # ===== COCHABAMBA =====
    # Plurinominales (8 titulares from the pairs)
    ('Wilder Veliz Armas', 'APB SÚMATE', 'COCHABAMBA', 'plurinominal', None),
    ('Judith Rosario Garcia Coca', 'APB SÚMATE', 'COCHABAMBA', 'plurinominal', None),
    ('Claudia Mallon Vargas', 'APB SÚMATE', 'COCHABAMBA', 'plurinominal', None),
    ('Wanda Ximena Medrano Hervas', 'AP', 'COCHABAMBA', 'plurinominal', None),
    ('Freddy Camacho Calizaya', 'LIBRE', 'COCHABAMBA', 'plurinominal', None),
    ('Miriam Lineth Rodriguez Vallejos', 'LIBRE', 'COCHABAMBA', 'plurinominal', None),
    ('Diego Andres Brañez Leaños', 'LIBRE', 'COCHABAMBA', 'plurinominal', None),
    ('Edwin Huiza Sandagorda', 'LIBRE', 'COCHABAMBA', 'plurinominal', None),
    # Uninominales (8 titulares)
    ('Oscar Ricardo Bustamante De La Zerda', 'LIBRE', 'COCHABAMBA', 'uninominal', '20'),
    ('Ofelia Alejandra Zurita Medrano', 'LIBRE', 'COCHABAMBA', 'uninominal', '21'),
    ('Claudia Estela Ramirez Estevez', 'PDC', 'COCHABAMBA', 'uninominal', '22'),
    ('Milka Rojas Grageda', 'PDC', 'COCHABAMBA', 'uninominal', '23'),
    ('Eliana Condori Tola', 'AP', 'COCHABAMBA', 'uninominal', '24'),
    ('Alicia Rojas Vargas', 'PDC', 'COCHABAMBA', 'uninominal', '25'),
    ('Rori Terrazas Montaño', 'PDC', 'COCHABAMBA', 'uninominal', '26'),
    ('Veronica Lafuente Vasquez', 'PDC', 'COCHABAMBA', 'uninominal', '27'),
    # Circunscripcion 28: TITULAR = CANDIDATO CON RENUNCIA, SUPLENTE = Alejandro Julian Lopez Ramirez
    # Note: The titular resigned, so we include the suplente who would take office
    ('Alejandro Julian Lopez Ramirez', 'PDC', 'COCHABAMBA', 'uninominal', '28'),
    # Especial (1 titular)
    ('Eliseo Antezana Nuñez', 'BIA YUQUI', 'COCHABAMBA', 'especial', None),
    
    # ===== ORURO =====
    # Plurinominales (4 titulares)
    ('Yasmin Estivariz Villarroel', 'PDC', 'ORURO', 'plurinominal', None),
    ('Freddy Castillo Chavez', 'PDC', 'ORURO', 'plurinominal', None),
    ('Maria Antonieta Alcon Sanchez', 'LIBRE', 'ORURO', 'plurinominal', None),
    ('Brizeida Karen Veliz Muñoz', 'LIBRE', 'ORURO', 'plurinominal', None),
    # Uninominales (4 titulares)
    ('Ximena Arispe Bernabe', 'PDC', 'ORURO', 'uninominal', '29'),
    ('Macedonio Vargas Gabriel', 'PDC', 'ORURO', 'uninominal', '30'),
    ('Shirley Vargas Paco', 'PDC', 'ORURO', 'uninominal', '31'),
    ('Ramiro Florencio Alanoca Condori', 'PDC', 'ORURO', 'uninominal', '32'),
    # Especial (1 titular)
    ('Zacarias Huarachi Lopez', 'AP', 'ORURO', 'especial', None),
    # Supraestatal (1 titular)
    ('Edzon Bladimir Choque Lazaro', 'PDC', 'ORURO', 'supraestatal', None),
    
    # ===== POTOSÍ =====
    # Plurinominales (7 titulares)
    ('Emilio Barrera Ramos', 'PDC', 'POTOSÍ', 'plurinominal', None),
    ('Liliana Marcela Villena Romero', 'PDC', 'POTOSÍ', 'plurinominal', None),
    ('Herminio Fernandez Thola', 'PDC', 'POTOSÍ', 'plurinominal', None),
    ('Christian Mendez Gutierrez', 'LIBRE', 'POTOSÍ', 'plurinominal', None),
    ('Lissa Amanda Claros Lora', 'LIBRE', 'POTOSÍ', 'plurinominal', None),
    ('Edgar Jose Zegarra Bernal', 'LIBRE', 'POTOSÍ', 'plurinominal', None),
    # Note: Position 3 LIBRE titular = Edgar Jose Zegarra Bernal
    # Uninominales (7 titulares)
    ('Kattia Juvenila Arando Sandoval', 'PDC', 'POTOSÍ', 'uninominal', '33'),
    ('Judith Oporto Mamani', 'PDC', 'POTOSÍ', 'uninominal', '34'),
    ('Sandra Reina Vilacahua Romano', 'PDC', 'POTOSÍ', 'uninominal', '35'),
    ('Erodita Apala Villca', 'PDC', 'POTOSÍ', 'uninominal', '36'),
    # Circunscripcion 36: SUPLENTE = CANDIDATO INHABILITADO
    ('Maria Jose Soruco Chacon', 'UNIDAD', 'POTOSÍ', 'uninominal', '37'),
    ('Pamela Jaldin Velez', 'LIBRE', 'POTOSÍ', 'uninominal', '38'),
    ('Basilia Cruz Bernal', 'AP', 'POTOSÍ', 'uninominal', '39'),
    
    # ===== TARIJA =====
    # Plurinominales (4 titulares)
    ('Diego Esteban Mateo Avila Navajas', 'PDC', 'TARIJA', 'plurinominal', None),
    ('Maria Isabel Moreno Cortez', 'LIBRE', 'TARIJA', 'plurinominal', None),
    ('Cesar Mentasti Padilla', 'LIBRE', 'TARIJA', 'plurinominal', None),
    ('Leonor Rosalva Romero Gutierrez', 'UNIDAD', 'TARIJA', 'plurinominal', None),
    # Uninominales (4 titulares)
    ('Richard Nilson Lopez Martinez', 'UNIDAD', 'TARIJA', 'uninominal', '40'),
    ('Marina Isabel Cachambi Alvarez', 'UNIDAD', 'TARIJA', 'uninominal', '41'),
    ('Cintya Lidia Ruiz Farfan', 'UNIDAD', 'TARIJA', 'uninominal', '42'),
    ('Ruddy Javier Pantaleon Saravia', 'PDC', 'TARIJA', 'uninominal', '43'),
    # Especial (1 titular)
    ('Rene Arebayo Corimayo', 'PDC', 'TARIJA', 'especial', None),
    # Supraestatal (1 titular)
    ('Daniel Roberto Marañon Tovar', 'UNIDAD', 'TARIJA', 'supraestatal', None),
    
    # ===== SANTA CRUZ =====
    # Plurinominales (13 titulares)
    ('Ricardo Xavier Rada Zeballos', 'PDC', 'SANTA CRUZ', 'plurinominal', None),
    ('Diana Romero Saavedra', 'PDC', 'SANTA CRUZ', 'plurinominal', None),
    ('Gabriel Angel Justiniano Castro', 'PDC', 'SANTA CRUZ', 'plurinominal', None),
    ('Marlene Miranda Palma', 'PDC', 'SANTA CRUZ', 'plurinominal', None),
    ('Mario Lima Paz', 'PDC', 'SANTA CRUZ', 'plurinominal', None),
    ('David Antonio Montaño Iriarte', 'APB SÚMATE', 'SANTA CRUZ', 'plurinominal', None),
    ('Rolando Santos Pacheco Chavez', 'AP', 'SANTA CRUZ', 'plurinominal', None),
    ('Maria Khaline Moreno Cardenas', 'UNIDAD', 'SANTA CRUZ', 'plurinominal', None),
    ('Andres Lombardo Medina Sotomayor', 'UNIDAD', 'SANTA CRUZ', 'plurinominal', None),
    ('Clotilde Padilla Solis', 'UNIDAD', 'SANTA CRUZ', 'plurinominal', None),
    ('Alvaro Bernardo Cazasola Soria Galvarro', 'UNIDAD', 'SANTA CRUZ', 'plurinominal', None),
    ('Denisse Janine Balladares Villamor', 'UNIDAD', 'SANTA CRUZ', 'plurinominal', None),
    ('Carlos Hernan Arrien Cronembold', 'UNIDAD', 'SANTA CRUZ', 'plurinominal', None),
    ('Gabriela Apaza Cespedes', 'UNIDAD', 'SANTA CRUZ', 'plurinominal', None),
    # Uninominales (13 titulares)
    ('Roger Blanco Mustafa', 'LIBRE', 'SANTA CRUZ', 'uninominal', '44'),
    ('Rafael Dario Lopez Mercado', 'LIBRE', 'SANTA CRUZ', 'uninominal', '45'),
    ('Glenda Marlene Aguilera Padilla', 'LIBRE', 'SANTA CRUZ', 'uninominal', '46'),
    ('Esther Salvatierra Landivar', 'LIBRE', 'SANTA CRUZ', 'uninominal', '47'),
    ('Juana Mendez Cababa', 'LIBRE', 'SANTA CRUZ', 'uninominal', '48'),
    ('Lucero Celeste Justiniano Oropeza', 'LIBRE', 'SANTA CRUZ', 'uninominal', '49'),
    ('Rolando Kobayashi Rojas', 'LIBRE', 'SANTA CRUZ', 'uninominal', '50'),
    ('Patricia Magin Arancibia Ibañez', 'LIBRE', 'SANTA CRUZ', 'uninominal', '51'),
    ('Flavia Barbery Ramos', 'LIBRE', 'SANTA CRUZ', 'uninominal', '52'),
    ('Helen Patricia Patiño Butron', 'PDC', 'SANTA CRUZ', 'uninominal', '53'),
    ('Germain Caballero Vargas', 'LIBRE', 'SANTA CRUZ', 'uninominal', '54'),
    ('Alexandra Edith Boero Gareca', 'LIBRE', 'SANTA CRUZ', 'uninominal', '55'),
    ('Reinaldo Seas Pimentel', 'LIBRE', 'SANTA CRUZ', 'uninominal', '56'),
    ('Kelly Andrea Velarde Arancibia', 'UNIDAD', 'SANTA CRUZ', 'uninominal', '57'),
    # Especial (1 titular)
    ('Wilson Añez Yamba', 'LIBRE', 'SANTA CRUZ', 'especial', None),
    # Supraestatal (1 titular)
    ('Mario Antonio Herrera Sanchez', 'LIBRE', 'SANTA CRUZ', 'supraestatal', None),
    
    # ===== BENI =====
    # Plurinominales (4 titulares)
    ('Erick Nelson Soruco Alpire', 'PDC', 'BENI', 'plurinominal', None),
    ('Ernesto Suarez Sattori', 'LIBRE', 'BENI', 'plurinominal', None),
    ('Claudia Cardenas Velasquez', 'LIBRE', 'BENI', 'plurinominal', None),
    ('Ana Karina Velasco Añez', 'LIBRE', 'BENI', 'plurinominal', None),
    # Uninominales (4 titulares)
    ('Pablo Ernesto Avila Quaino', 'UNIDAD', 'BENI', 'uninominal', '58'),
    ('Salma Tobias Paz', 'UNIDAD', 'BENI', 'uninominal', '59'),
    ('Carmen Ruelas Pardo', 'UNIDAD', 'BENI', 'uninominal', '60'),
    ('Raul Alfonso Parraga Melendez', 'UNIDAD', 'BENI', 'uninominal', '61'),
    # Especial (1 titular)
    ('Pablo Maito Moye', 'LIBRE', 'BENI', 'especial', None),
    # Supraestatal (1 titular - but is CANDIDATO INHABILITADO for SUPLENTE)
    ('Sergio Bastian Giesse Rougcher', 'UNIDAD', 'BENI', 'supraestatal', None),
    
    # ===== PANDO =====
    # Plurinominales (2 titulares)
    ('Cintia Monica Puerta Campos', 'PDC', 'PANDO', 'plurinominal', None),
    ('Carol Carlo Duran', 'UNIDAD', 'PANDO', 'plurinominal', None),
    # Note: PDC position 1 TITULAR = CANDIDATO INHABILITADO (suplente Marlene Gonzales Coper)
    ('Marlene Gonzales Coper', 'PDC', 'PANDO', 'plurinominal', None),
    # Uninominales (2 titulares)
    ('Litzie Nadir Orellana Arcienega', 'LIBRE', 'PANDO', 'uninominal', '62'),
    ('Carlos Hugo Idagua Flores', 'LIBRE', 'PANDO', 'uninominal', '63'),
    # Especial (1 titular)
    ('Adelia Cruz Paz', 'MAS IPSP', 'PANDO', 'especial', None),
    # Supraestatal (1 titular)
    ('Nathaly Solares Tuesta', 'LIBRE', 'PANDO', 'supraestatal', None),
]

# Build JSON
output = []
for (nombre, partido, dept, tipo, circ) in diputados_raw:
    output.append({
        'nombre': nombre.title(),
        'departamento': dept,
        'partido_sigla': partido,
        'partido': PARTY_MAP.get(partido, partido),
        'tipo_diputado': tipo,
        'circunscripcion': circ,
        'redes_sociales': {},
        'foto_url': '',
        'fuente_url': 'https://estaticos.unitel.bo/binrepository/electos-2025_101-12895136_20250826185916.pdf'
    })

# Sort
dept_order = ['CHUQUISACA', 'LA PAZ', 'COCHABAMBA', 'ORURO', 'POTOSÍ', 'TARIJA', 'SANTA CRUZ', 'BENI', 'PANDO']
output.sort(key=lambda x: (
    dept_order.index(x['departamento']) if x['departamento'] in dept_order else 99,
    {'plurinominal': 0, 'uninominal': 1, 'especial': 2, 'supraestatal': 3}.get(x['tipo_diputado'], 4),
    x['nombre']
))

# Summary
print(f"Total diputados titulares: {len(output)}")
for d in dept_order:
    count = len([r for r in output if r['departamento'] == d])
    tipos = {}
    for r in [r for r in output if r['departamento'] == d]:
        t = r['tipo_diputado']
        tipos[t] = tipos.get(t, 0) + 1
    print(f"  {d}: {count} (pluri:{tipos.get('plurinominal',0)}, uni:{tipos.get('uninominal',0)}, esp:{tipos.get('especial',0)}, supra:{tipos.get('supraestatal',0)})")

party_counts = {}
for r in output:
    p = r['partido_sigla']
    party_counts[p] = party_counts.get(p, 0) + 1
print("\nPor partido:")
for p, c in sorted(party_counts.items(), key=lambda x: -x[1]):
    print(f"  {p}: {c}")

# Save
with open('/home/z/my-project/diputados_2025_2030.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\nJSON guardado: {len(output)} diputados titulares")
