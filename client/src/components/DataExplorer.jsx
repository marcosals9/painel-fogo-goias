import React, { useState, useMemo } from 'react';
import { X, Download, Filter, Database, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DataExplorer({ isOpen, onClose, fireEvents, date }) {
  const [search, setSearch]           = useState('');
  const [filterUF, setFilterUF]       = useState('GOIAS');
  const [sortKey, setSortKey]         = useState('municipio');
  const [sortDir, setSortDir]         = useState('asc');
  const [expandedRowId, setExpandedRowId] = useState(null);

  // Bloqueia o scroll do body quando o drawer estiver aberto
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setFilterUF('GOIAS');
      setSearch('');
      setExpandedRowId(null);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Lista única de UFs para o select
  const ufs = useMemo(() => {
    const set = new Set((fireEvents || []).map(e => e.uf).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [fireEvents]);

  // Filtragem + ordenação
  const filtered = useMemo(() => {
    let data = fireEvents || [];

    if (filterUF === 'GOIAS') {
      data = data.filter(e => e.isGoias !== false);
    } else if (filterUF === 'OUTROS') {
      data = data.filter(e => e.isGoias === false);
    } else if (filterUF !== 'TODOS') {
      data = data.filter(e => e.uf === filterUF);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(e =>
        (e.municipio || '').toLowerCase().includes(q) ||
        (e.uf || '').toLowerCase().includes(q) ||
        (e.ucText || '').toLowerCase().includes(q)
      );
    }

    data = [...data].sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [fireEvents, search, filterUF, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20 inline ml-0.5" />;
    return sortDir === 'asc'
      ? <ChevronUp   className="w-3 h-3 inline ml-0.5 text-primary" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5 text-primary" />;
  };

  const exportCSV = () => {
    const header = ['Município','UF','Goiás?','Tamanho (ha)','Detecções','Duração (h)','UC','Lat','Lng','Data Inicial', 'Data Máxima'];
    const rows = filtered.map(e => [
      e.municipio ?? '',
      e.uf ?? '',
      e.isGoias !== false ? 'Sim' : 'Não',
      e.tamanho_ha ?? '',
      e.qtd_deteccoes ?? '',
      e.duracao_h ?? '',
      e.ucText ?? '',
      e.lat ?? '',
      e.lng ?? '',
      e.dt_minima ?? '',
      e.dt_maxima ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'dados_fogo.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const total = (fireEvents || []).length;
  const goias = (fireEvents || []).filter(e => e.isGoias !== false).length;

  const thCls = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide cursor-pointer select-none hover:bg-muted/70 whitespace-nowrap";
  const tdCls = "px-3 py-1.5 text-xs border-b border-border/40";

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[900] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-[910] w-full max-w-5xl bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Database className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">Explorador de Dados KML</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {date && (
                  <>
                    <span className="font-medium text-foreground">Período: {date.split('-').reverse().join('/')}</span>
                    <span className="mx-2 text-muted-foreground/40">&bull;</span>
                  </>
                )}
                <span className="font-semibold text-foreground">{filtered.length}</span> exibidos
                &nbsp;de&nbsp;
                <span className="font-semibold text-foreground">{total}</span> totais
                &nbsp;·&nbsp;
                <span className="text-green-600 font-semibold">{goias}</span> em Goiás
                &nbsp;·&nbsp;
                <span className="text-orange-500 font-semibold">{total - goias}</span> fora de Goiás
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="flex flex-row items-center justify-center h-8 w-8 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={onClose} title="Fechar (ESC)">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b bg-card flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

          {/* Busca */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar município, UF ou UC..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 h-8 text-sm"
            />
          </div>

          {/* Filtro Unificado UF/Região */}
          <select
            value={filterUF}
            onChange={e => setFilterUF(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="TODOS">🌎 Todos os Estados</option>
            <option value="GOIAS">✅ Apenas Goiás</option>
            <option value="OUTROS">❌ Fora de Goiás</option>
            <optgroup label="Por UF Específica">
              {ufs.filter(u => u !== 'TODOS').map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </optgroup>
          </select>

          {/* Reset */}
          {(search || filterUF !== 'TODOS') && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(''); setFilterUF('TODOS'); }}>
              Limpar filtros
            </Button>
          )}

          <div className="flex-1 min-w-[20px]" />

          {/* Exportar */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="h-8 w-8 p-0 flex items-center justify-center bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700 shadow-sm shrink-0"
            title="Exportar dados filtrados para Excel (.csv)"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted z-10 shadow-sm">
              <tr>
                <th className={thCls} onClick={() => toggleSort('municipio')}><div className="flex items-center gap-1 whitespace-nowrap">Município <SortIcon col="municipio"/></div></th>
                <th className={thCls} onClick={() => toggleSort('uf')}><div className="flex items-center gap-1 whitespace-nowrap">UF <SortIcon col="uf"/></div></th>
                <th className={thCls + " text-center"}><div className="whitespace-nowrap">Goiás?</div></th>
                <th className={thCls} onClick={() => toggleSort('tamanho_ha')}><div className="flex items-center gap-1 whitespace-nowrap">Área (ha) <SortIcon col="tamanho_ha"/></div></th>
                <th className={thCls} onClick={() => toggleSort('qtd_deteccoes')}><div className="flex items-center gap-1 whitespace-nowrap">Detecções <SortIcon col="qtd_deteccoes"/></div></th>
                <th className={thCls} onClick={() => toggleSort('duracao_h')}><div className="flex items-center gap-1 whitespace-nowrap">Duração (h) <SortIcon col="duracao_h"/></div></th>
                <th className={thCls}><div className="whitespace-nowrap">UC</div></th>
                <th className={thCls} onClick={() => toggleSort('dt_maxima')}><div className="flex items-center gap-1 whitespace-nowrap">Período do Evento <SortIcon col="dt_maxima"/></div></th>
                <th className={thCls}><div className="whitespace-nowrap">Lat / Lng</div></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">
                    Nenhum evento encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : filtered.map((e, i) => (
                <React.Fragment key={e.id ?? i}>
                  <tr 
                    className={`cursor-pointer transition-colors ${e.isGoias !== false ? '' : 'opacity-60'} ${expandedRowId === (e.id ?? i) ? 'bg-slate-200 dark:bg-slate-800' : 'hover:bg-muted/50'}`}
                    onClick={() => setExpandedRowId(expandedRowId === (e.id ?? i) ? null : (e.id ?? i))}
                  >
                    <td className={tdCls + " font-medium max-w-[160px] break-words"}>{e.municipio || 'N/A'}</td>
                    <td className={tdCls}>
                      <span className="font-bold px-1.5 py-0.5 rounded text-xs bg-muted">{e.uf || 'N/A'}</span>
                    </td>
                    <td className={tdCls + " text-center"}>
                      {e.isGoias !== false
                        ? <span className="text-green-600 font-bold text-xs">✓ Sim</span>
                        : <span className="text-red-500 font-bold text-xs">✗ Não</span>
                      }
                    </td>
                    <td className={tdCls + " text-right"}>{e.tamanho_ha != null ? e.tamanho_ha.toLocaleString('pt-BR') : '—'}</td>
                    <td className={tdCls + " text-center"}>{e.qtd_deteccoes ?? '—'}</td>
                    <td className={tdCls + " text-center"}>{e.duracao_h != null ? e.duracao_h : '—'}</td>
                    <td className={tdCls}>
                      {e.uc
                        ? <span className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 px-1.5 py-0.5 rounded font-medium">{e.ucText}</span>
                        : <span className="text-muted-foreground text-[11px]">Não</span>
                      }
                    </td>
                    <td className={tdCls + " whitespace-nowrap text-[11px]"}>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Início: {e.dt_minima ? new Date(e.dt_minima).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                        <span className="font-semibold text-foreground">Fim: {e.dt_maxima ? new Date(e.dt_maxima).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                      </div>
                    </td>
                    <td className={tdCls + " text-right font-mono text-[10px] text-muted-foreground whitespace-nowrap"}>
                      {e.lat != null ? e.lat.toFixed(4) : ''}, {e.lng != null ? e.lng.toFixed(4) : ''}
                    </td>
                  </tr>
                  {expandedRowId === (e.id ?? i) && (
                    <tr className="bg-muted/10">
                      <td colSpan={9} className="p-0 border-b-2 border-primary/20">
                        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-gradient-to-br from-white to-slate-50 shadow-inner">
                          <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1"><Database className="w-3 h-3"/> ID do Evento</strong><p className="font-mono text-xs">{e.id || 'N/A'}</p></div>
                          <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Município / Estado</strong><p className="font-semibold text-sm">{e.municipio} - {e.uf}</p></div>
                          <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Pertence a Goiás?</strong><p className="font-semibold">{e.isGoias !== false ? 'Sim' : 'Não'}</p></div>
                          <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Unidade de Conservação</strong><p className="font-semibold">{e.ucText !== 'N/A' ? e.ucText : 'Nenhuma área protegida atingida'}</p></div>
                          <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Área Estimada (hectares)</strong><p className="font-semibold text-sm">{e.tamanho_ha != null ? e.tamanho_ha : 'N/A'}</p></div>
                          <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Qtd. Detecções (Pixels)</strong><p className="font-semibold">{e.qtd_deteccoes || 0}</p></div>
                          <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Duração Total (horas)</strong><p className="font-semibold">{e.duracao_h != null ? e.duracao_h : 'N/A'}</p></div>
                          <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Coordenadas (Lat, Lng)</strong><p className="font-medium font-mono text-xs">{e.lat}, {e.lng}</p></div>
                          <div className="space-y-1 md:col-span-2"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Bioma</strong><p className="font-medium">{e.bioma || 'Cerrado'}</p></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer com resumo */}
        <div className="px-5 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex gap-4">
          <span>Total: <strong className="text-foreground">{total}</strong></span>
          <span>Goiás: <strong className="text-green-600">{goias}</strong></span>
          <span>Fora de GO: <strong className="text-orange-500">{total - goias}</strong></span>
          <span>Filtrados: <strong className="text-primary">{filtered.length}</strong></span>
        </div>
      </div>
    </>
  );
}
