---
Task ID: 1
Agent: main
Task: Implement hierarchical ejes temáticos with dimensions

Work Log:
- Added parentId + dimension fields to EjeTematico schema
- Ran Prisma migration (db push + generate)
- Updated EjeItem type with parentId, dimension, children
- Rewrote /api/ejes with hierarchy support, PUT for editing, dimension filtering
- Changed navigation label: Clasificadores → Ejes Temáticos
- Rewrote ClasificadoresView with hierarchy, dimension badges, filters, edit mode
- Added 28 sub-clasificaciones across all ejes with dimensions
- Updated seed route to create sub-clasificaciones
- Build verified successfully

Stage Summary:
- Ejes temáticos now have 2-level hierarchy (root + children)
- 5 dimensions: produccion, precio, conflicto, regulacion, infraestructura
- UI shows dimension-colored badges, hierarchical card layout
- Full CRUD: add (root or child), edit, toggle, soft-delete
- Seed creates 28 sub-clasificaciones linked by parent slug
