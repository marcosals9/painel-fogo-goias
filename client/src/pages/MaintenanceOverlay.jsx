import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function MaintenanceOverlay() {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <CardTitle className="text-2xl text-slate-100">Sistema em Manutenção</CardTitle>
          <CardDescription className="text-slate-400">
            Painel de Controle de Fogo de Goiás
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pt-4 pb-6">
          <p className="text-slate-300">
            Estamos realizando atualizações importantes no sistema no momento.
            O painel estará indisponível por um curto período.
          </p>
          <p className="text-sm text-slate-500 mt-6">
            Agradecemos a sua compreensão e paciência.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
