'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, CheckCircle2, FileBarChart, Mail, FileText } from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { PRODUCTOS, COMBOS } from '@/constants/products';
import { ALL_PRODUCTS, PRODUCT_CATEGORIES, CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';

export function ProductosView() {
  return (
    <div className="space-y-6">
      {/* Overview KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          icon={<Package className="h-5 w-5" />}
          value={ALL_PRODUCTS.length}
          label="Productos totales"
          colorClass="text-primary"
        />
        <KPICard
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={ALL_PRODUCTS.filter(p => p.estado === 'operativo').length}
          label="Operativos"
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <KPICard
          icon={<FileBarChart className="h-5 w-5" />}
          value={COMBOS.length}
          label="Combos"
          colorClass="text-purple-600 dark:text-purple-400"
        />
        <KPICard
          icon={<Mail className="h-5 w-5" />}
          value={4}
          label="Canales"
          subtext="WhatsApp, Email, Web, PDF"
          colorClass="text-sky-600 dark:text-sky-400"
        />
      </div>

      {/* Products by category */}
      {PRODUCT_CATEGORIES.map((cat) => {
        const catProducts = ALL_PRODUCTS.filter(p => p.categoria === cat.id);
        if (catProducts.length === 0) return null;
        return (
          <Card key={cat.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
                <CardTitle className="text-sm font-semibold">{catProducts.length} producto{catProducts.length > 1 ? 's' : ''}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catProducts.map((prod) => {
                  const ProdIcon = prod.icon;
                  const prodConfig = PRODUCTOS[prod.tipo];
                  return (
                    <div key={prod.tipo} className="p-4 rounded-lg border border-border hover:border-primary/30 transition-all hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        <div
                          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: prod.color + '20' }}
                        >
                          <ProdIcon className="h-5 w-5" style={{ color: prod.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{prod.nombre}</p>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              prod.estado === 'operativo'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : prod.estado === 'definido'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-stone-100 text-stone-500'
                            }`}>
                              {prod.estado === 'operativo' ? '✅ Operativo' : prod.estado === 'definido' ? '⚠️ Definido' : '📋 Pendiente'}
                            </span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${cat.color}`}>
                            {cat.label}
                          </span>
                        </div>
                      </div>
                      {prodConfig && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-muted-foreground leading-relaxed">{prodConfig.descripcion}</p>
                          <div className="flex items-center flex-wrap gap-3 text-[10px] text-muted-foreground">
                            <span>🕐 {prodConfig.horarioEnvio}</span>
                            <span>📋 {prodConfig.longitudPaginas} pág.</span>
                            <span>⏱ {prodConfig.longitudMinLectura} min lectura</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {prodConfig.canales.map((canal) => (
                              <Badge key={canal} variant="secondary" className="text-[9px] px-1.5 py-0">
                                {CANAL_LABELS[canal] || canal}
                              </Badge>
                            ))}
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              {FRECUENCIA_LABELS[prodConfig.frecuencia] || prodConfig.frecuencia}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Combos section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
            Combos de Productos
          </CardTitle>
          <CardDescription className="text-xs">
            {COMBOS.length} combos disponibles — desde Bs {Math.min(...COMBOS.map(c => c.precioMensual)).toLocaleString()} hasta Bs {Math.max(...COMBOS.map(c => c.precioMensual)).toLocaleString()}/mes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMBOS.map((combo) => (
              <div key={combo.id} className="p-4 rounded-xl border-2 border-primary/20 hover:border-primary/40 transition-all bg-gradient-to-br from-primary/[0.02] to-transparent">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-foreground">{combo.nombre}</h4>
                  <Badge className="text-[10px] bg-primary text-primary-foreground font-bold">
                    Bs {combo.precioMensual.toLocaleString()}/mes
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{combo.descripcion}</p>
                <Separator className="my-3" />
                <div className="flex flex-wrap gap-1.5">
                  {combo.productos.map((tipo) => {
                    const prodInfo = ALL_PRODUCTS.find(p => p.tipo === tipo);
                    const ProdIcon = prodInfo?.icon || FileText;
                    return (
                      <span key={tipo} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-muted font-medium text-muted-foreground">
                        <ProdIcon className="h-3 w-3" style={{ color: prodInfo?.color }} />
                        {PRODUCTOS[tipo]?.nombreCorto || tipo.replace(/_/g, ' ')}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
