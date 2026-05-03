'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MonitorPlay, RefreshCw, ExternalLink, Maximize2, Minimize2, Monitor, Smartphone, Tablet } from 'lucide-react';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_SIZES: Record<DeviceMode, { label: string; width: string; maxWidth: string; icon: typeof Monitor }> = {
  desktop: { label: 'Escritorio', width: '100%', maxWidth: '100%', icon: Monitor },
  tablet: { label: 'Tablet', width: '768px', maxWidth: '768px', icon: Tablet },
  mobile: { label: 'Móvil', width: '375px', maxWidth: '375px', icon: Smartphone },
};

export function PreviewView() {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const device = DEVICE_SIZES[deviceMode];
  const DeviceIcon = device.icon;

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleOpenExternal = useCallback(() => {
    window.open('/dashboard', '_blank');
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
  }, []);

  // Reset loading on refreshKey change
  useEffect(() => {
    setIsLoading(true);
  }, [refreshKey]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MonitorPlay className="h-5 w-5 text-primary" />
            Vista Preview
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Previsualiza la interfaz del cliente DECODEX directamente desde el Centro de Comando.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Device toggles */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {(Object.keys(DEVICE_SIZES) as DeviceMode[]).map((mode) => {
              const d = DEVICE_SIZES[mode];
              const Icon = d.icon;
              const active = deviceMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setDeviceMode(mode)}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors
                    border-r border-border last:border-r-0
                    ${active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                  `}
                  title={d.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{d.label}</span>
                </button>
              );
            })}
          </div>

          <div className="w-px h-6 bg-border hidden sm:block" />

          {/* Action buttons */}
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={handleToggleFullscreen}
          >
            {isFullscreen ? (
              <><Minimize2 className="h-3.5 w-3.5" /> Comprimir</>
            ) : (
              <><Maximize2 className="h-3.5 w-3.5" /> Expandir</>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={handleOpenExternal}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </Button>
        </div>
      </div>

      {/* Info bar */}
      <Card className="border-dashed">
        <CardContent className="p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-[10px] gap-1">
                <DeviceIcon className="h-3 w-3" />
                {device.label}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                /dashboard
              </Badge>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                Interfaz del cliente final
              </span>
            </div>
            {isLoading && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Cargando preview...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview container */}
      <div
        className={`
          rounded-xl border border-border bg-muted/30 overflow-hidden transition-all duration-300
          ${isFullscreen ? 'fixed inset-0 z-[60] rounded-none' : 'relative'}
        `}
        style={!isFullscreen ? { minHeight: 'calc(100vh - 280px)' } : {}}
      >
        {/* Browser-like top bar */}
        <div className={`
          flex items-center gap-2 px-4 py-2 bg-muted border-b border-border
          ${isFullscreen ? 'justify-between' : ''}
        `}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400/80" />
              <div className="h-3 w-3 rounded-full bg-amber-400/80" />
              <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
            </div>
            <div className="ml-2 flex items-center gap-2 px-3 py-1 bg-background rounded-md border border-border text-xs text-muted-foreground min-w-0">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">localhost:3000/dashboard</span>
            </div>
          </div>
          {isFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleToggleFullscreen}
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Cerrar pantalla completa
            </Button>
          )}
        </div>

        {/* iframe wrapper with responsive sizing */}
        <div
          className="flex justify-center bg-background overflow-auto"
          style={{
            height: isFullscreen ? 'calc(100vh - 41px)' : 'calc(100vh - 310px)',
            minHeight: isFullscreen ? undefined : '500px',
          }}
        >
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0A1628' }}>
                  <MonitorPlay className="h-5 w-5 text-white animate-pulse" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Cargando vista preview...</p>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            key={refreshKey}
            src="/dashboard"
            onLoad={handleIframeLoad}
            title="DECODEX Preview — Vista Cliente"
            className={`
              bg-white dark:bg-background border-0 transition-all duration-300
              ${isLoading ? 'opacity-0' : 'opacity-100'}
            `}
            style={{
              width: device.width,
              maxWidth: device.maxWidth,
              height: '100%',
              border: deviceMode !== 'desktop' ? '1px solid var(--border)' : 'none',
              borderRadius: deviceMode !== 'desktop' ? '0 0 8px 8px' : '0',
            }}
          />
        </div>
      </div>
    </div>
  );
}
