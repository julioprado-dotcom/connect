import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, Radio, BarChart3, FileText } from 'lucide-react';

const actions = [
  {
    href: '/agente/nuevo-cliente',
    icon: ClipboardList,
    title: 'Nuevo Cliente + Contrato',
    description: 'Registrar un cliente y crear contratos de productos',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    href: '/agente/suscriptor',
    icon: Radio,
    title: 'Suscriptor Gratuito',
    description: 'Registrar un suscriptor gratuito para El Radar',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    href: '/agente/registros',
    icon: BarChart3,
    title: 'Mis Registros',
    description: 'Ver clientes y contratos recientes',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  },
  {
    href: '/dashboard',
    icon: FileText,
    title: 'Vista Cliente',
    description: 'Previsualizar el dashboard que ve el cliente',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
];

export default function AgenteHomePage() {
  return (
    <div className="space-y-6 pb-4">
      {/* Welcome */}
      <div>
        <h1 className="text-lg font-bold text-foreground">Portal del Agente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bienvenido. Selecciona una acci&oacute;n para comenzar.
        </p>
      </div>

      {/* Action cards */}
      <div className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href} className="block">
              <Card className="transition-shadow hover:shadow-md active:scale-[0.98]">
                <CardContent className="flex items-center gap-4">
                  <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${action.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{action.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                  <span className="text-muted-foreground text-lg">&rarr;</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
