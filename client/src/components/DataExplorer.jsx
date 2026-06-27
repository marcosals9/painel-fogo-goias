import React, { useState, useMemo } from 'react';
import { X, Download, Filter, Database, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DataExplorer({ isOpen, onClose, fireEvents, date }) {
  const [search, setSearch]           = useState('');
  const [filterUF, setFilterUF]       = useState('TODOS');
  const [filterGoias, setFilterGoias] = useState('TODOS'); // TODOS | GOIAS | OUTROS
  const [sortKey, setSortKey]         = useState('municipio');
  const [sortDir, setSortDir]         = useState('asc');

  // Bloqueia o scroll do body quando o drawer estiver aberto
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
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

    if (filterGoias === 'GOIAS')  data = data.filter(e => e.isGoias !== false);
    if (filterGoias === 'OUTROS') data = data.filter(e => e.isGoias === false);
    if (filterUF !== 'TODOS')     data = data.filter(e => e.uf === filterUF);

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
  }, [fireEvents, search, filterUF, filterGoias, sortKey, sortDir]);

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
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-bold text-base flex items-center gap-2">
                Explorador de Dados KML
                {date && (
                  <span className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20 border px-2 py-0.5 rounded-full whitespace-nowrap">
                    Período: {date.split('-').reverse().join('/')} (BRT)
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
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
            <Button variant="outline" size="sm" className="flex flex-row items-center gap-1.5 h-8" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </Button>
            <Button variant="ghost" size="icon" className="flex flex-row items-center justify-center h-8 w-8" onClick={onClose}>
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

          {/* Filtro Goiás */}
          <select
            value={filterGoias}
            onChange={e => setFilterGoias(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="TODOS">🌎 Todos os Estados</option>
            <option value="GOIAS">✅ Apenas Goiás</option>
            <option value="OUTROS">❌ Fora de Goiás</option>
          </select>

          {/* Filtro UF */}
          <select
            value={filterUF}
            onChange={e => setFilterUF(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {ufs.map(uf => (
              <option key={uf} value={uf}>{uf === 'TODOS' ? 'Todas as UFs' : uf}</option>
            ))}
          </select>

          {/* Reset */}
          {(search || filterUF !== 'TODOS' || filterGoias !== 'TODOS') && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(''); setFilterUF('TODOS'); setFilterGoias('TODOS'); }}>
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted z-10 shadow-sm">
              <tr>
                <th className={thCls} onClick={() => toggleSort('municipio')}>Município <SortIcon col="municipio"/></th>
                <th className={thCls} onClick={() => toggleSort('uf')}>UF <SortIcon col="uf"/></th>
                <th className={thCls + " text-center"}>Goiás?</th>
                <th className={thCls} onClick={() => toggleSort('tamanho_ha')}>Área (ha) <SortIcon col="tamanho_ha"/></th>
                <th className={thCls} onClick={() => toggleSort('qtd_deteccoes')}>Detecções <SortIcon col="qtd_deteccoes"/></th>
                <th className={thCls} onClick={() => toggleSort('duracao_h')}>Duração (h) <SortIcon col="duracao_h"/></th>
                <th className={thCls}>UC</th>
                <th className={thCls} onClick={() => toggleSort('dt_maxima')}>Período do Evento <SortIcon col="dt_maxima"/></th>
                <th className={thCls}>Lat / Lng</th>
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
                <tr key={e.id ?? i} className={`hover:bg-muted/50 transition-colors ${e.isGoias !== false ? '' : 'opacity-60'}`}>
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
                  <td className={tdCls + " text-[10px] text-muted-foreground whitespace-nowrap font-mono"}>
                    {e.lat?.toFixed(4)}, {e.lng?.toFixed(4)}
                  </td>
                </tr>
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
